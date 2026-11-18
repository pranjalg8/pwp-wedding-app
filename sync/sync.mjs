// PwP wedding sync: pulls new messages from the user's own already-authenticated
// wacli store for their own WhatsApp groups, and mirrors them into Supabase.
//
// Run manually: npm run sync
// Scheduled via launchd (see sync/com.pranjal.pwpsync.plist.example).
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — copy .env.example to .env and fill it in.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CURSOR_FILE = path.join(import.meta.dirname, 'cursors.local.json');
const GROUP_NAME_PREFIX = 'PwP'; // discover groups by name, not a hardcoded JID list
const CHAT_NAMES_KEY = '_chatNames';
const EDGE_IDS_KEY = '_edgeMsgIds';
const UPSERT_BATCH = 500;

function loadCursors() {
  if (!existsSync(CURSOR_FILE)) return {};
  return JSON.parse(readFileSync(CURSOR_FILE, 'utf8'));
}

function saveCursors(cursors) {
  writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 2));
}

function wacliJson(args) {
  const out = execFileSync('wacli', [...args, '--json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  return JSON.parse(out);
}

function discoverGroups() {
  const res = wacliJson(['groups', 'list']);
  if (!res.success) throw new Error('wacli groups list failed: ' + JSON.stringify(res.error));
  return res.data.filter((g) => (g.Name || '').startsWith(GROUP_NAME_PREFIX));
}

function exportMessagesSince(jid, afterIso, tmpDir) {
  const outFile = path.join(tmpDir, 'export.json');
  const args = ['messages', 'export', '--chat', jid, '--limit', '5000', '--output', outFile];
  if (afterIso) args.push('--after', afterIso);
  execFileSync('wacli', args, { encoding: 'utf8' });
  const parsed = JSON.parse(readFileSync(outFile, 'utf8'));
  return parsed?.data?.messages ?? [];
}

function toRow(m, chatName) {
  return {
    chat_jid: m.ChatJID,
    chat_name: chatName,
    msg_id: m.MsgID,
    sender_name: m.SenderName || null,
    from_me: !!m.FromMe,
    timestamp: m.Timestamp,
    text: m.Text || null,
    media_type: m.MediaType || null,
    media_caption: m.MediaCaption || null,
  };
}

async function main() {
  console.log('wacli sync (pulling latest WhatsApp messages)...');
  try {
    execFileSync('wacli', ['sync'], { encoding: 'utf8', timeout: 5 * 60 * 1000 });
  } catch (err) {
    console.warn('wacli sync failed/skipped (continuing with local store as-is):', err.message);
  }

  const groups = discoverGroups();
  console.log(`Found ${groups.length} "${GROUP_NAME_PREFIX}*" groups.`);

  const cursors = loadCursors();
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'pwp-sync-'));
  let totalNew = 0;
  const perGroupCounts = [];

  try {
    // Extra bookkeeping kept in the cursor file next to the per-chat timestamps (keys that are not JIDs):
    //   CHAT_NAMES_KEY  the group name last written to messages.chat_name, so the rename runs only when it changes
    //   EDGE_IDS_KEY    the ids of the messages at each chat's cursor timestamp (see the rewind below)
    const names = (cursors[CHAT_NAMES_KEY] ??= {});
    const edgeIds = (cursors[EDGE_IDS_KEY] ??= {});
    for (const g of groups) {
      const jid = g.JID;
      const after = cursors[jid];
      // wacli's per-message ChatName is sometimes the raw JID; the group list has the real name.
      if (names[jid] !== g.Name) {
        const { error: renameError } = await supabase.from('messages').update({ chat_name: g.Name }).eq('chat_jid', jid).neq('chat_name', g.Name);
        if (renameError) console.error(`Chat name update failed for ${g.Name}:`, renameError.message);
        else names[jid] = g.Name;
      }

      // Timestamps are whole seconds and --after is exclusive, so a message that arrived in the same second as the
      // cursor, after the last run, would never be exported. Ask from one second earlier and drop what was already
      // synced: anything before the cursor, and the messages at the cursor second that the last run saw.
      const seen = new Set(edgeIds[jid] ?? []);
      const afterMs = after ? Date.parse(after) : NaN;
      const exportAfter = Number.isNaN(afterMs) ? after : new Date(afterMs - 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const messages = exportMessagesSince(jid, exportAfter, tmpDir).filter((m) => {
        if (Number.isNaN(afterMs)) return true;
        const t = Date.parse(m.Timestamp);
        return t > afterMs || (t === afterMs && !seen.has(m.MsgID));
      });
      if (messages.length === 0) continue;

      // Upsert in batches: one request with thousands of rows can time out on the free tier.
      const rows = messages.map((m) => toRow(m, g.Name));
      let failed = null;
      for (let i = 0; i < rows.length && !failed; i += UPSERT_BATCH) {
        const { error } = await supabase.from('messages').upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict: 'msg_id' });
        if (error) failed = error;
      }
      if (failed) {
        // The cursor is not moved, so the next run tries the whole set again; the upsert makes that safe.
        console.error(`Upsert failed for ${g.Name}:`, failed.message);
        continue;
      }

      const latest = messages.reduce((max, m) => (m.Timestamp > max ? m.Timestamp : max), after || '');
      const latestMs = Date.parse(latest);
      const atLatest = messages.filter((m) => Date.parse(m.Timestamp) === latestMs).map((m) => m.MsgID);
      edgeIds[jid] = latestMs === afterMs ? [...seen, ...atLatest] : atLatest;
      cursors[jid] = latest;
      totalNew += rows.length;
      perGroupCounts.push(`${g.Name}: ${rows.length}`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  saveCursors(cursors);

  const { error: statusError } = await supabase
    .from('sync_status')
    .upsert({ id: 1, last_run_at: new Date().toISOString(), last_new_messages: totalNew });
  if (statusError) console.error('Failed to write sync_status:', statusError.message);

  if (totalNew > 0) {
    const { error: auditError } = await supabase.from('audit_log').insert({
      actor_type: 'sync',
      actor_name: 'wacli',
      table_name: 'messages',
      action: 'insert',
      after: { total_new: totalNew, per_group: perGroupCounts },
    });
    if (auditError) console.error('Failed to write audit_log row:', auditError.message);
  }

  console.log(`Synced ${totalNew} new messages across ${perGroupCounts.length} groups.`);
  if (perGroupCounts.length) console.log(perGroupCounts.join('\n'));
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
