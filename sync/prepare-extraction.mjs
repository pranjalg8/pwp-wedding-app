// Builds a "work packet" of everything new in the topic chats since the last extraction run,
// for the update-planner skill to read. Images are copied to a private folder OUTSIDE the repo
// and deleted again by finish-extraction.mjs, because receipts carry personal details.
//
//   node prepare-extraction.mjs --init-now      # first time: start tracking from now, process nothing old
//   node prepare-extraction.mjs                 # packet of everything since each chat's cursor
//   node prepare-extraction.mjs --since 2026-10-03T00:00:00Z   # override the cursor (testing)
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in sync/.env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const MAX_PER_CHAT = Number(opt('--max') ?? 400);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp']);

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

const topics = must(await supabase.from('topics').select('id, key, label, chat_match, sort_order').order('sort_order'), 'topics');
const topicChats = must(await supabase.from('messages').select('chat_jid, chat_name'), 'messages').reduce((m, r) => m.set(r.chat_jid, r.chat_name), new Map());

// topic <-> chat: a chat belongs to a topic when its name contains the topic's chat_match
const chatsByTopic = new Map();
for (const t of topics) {
  if (!t.chat_match) continue;
  const needle = t.chat_match.toLowerCase();
  const chats = [...topicChats].filter(([, name]) => name?.toLowerCase().includes(needle)).map(([jid, name]) => ({ jid, name }));
  if (chats.length) chatsByTopic.set(t.key, chats);
}
const allChats = [...new Map([...chatsByTopic.values()].flat().map((c) => [c.jid, c])).values()];

const cursors = new Map(must(await supabase.from('extraction_cursor').select('*'), 'extraction_cursor').map((c) => [c.chat_jid, c.last_processed_at]));

if (flag('--init-now')) {
  const now = new Date().toISOString();
  const rows = allChats.filter((c) => !cursors.has(c.jid)).map((c) => ({ chat_jid: c.jid, last_processed_at: now }));
  if (rows.length) must(await supabase.from('extraction_cursor').upsert(rows), 'init cursors');
  console.log(`Cursors set to now for ${rows.length} chat(s). Next run will only look at newer messages.`);
  process.exit(0);
}

const sinceOverride = opt('--since');
const missing = allChats.filter((c) => !cursors.has(c.jid) && !sinceOverride);
if (missing.length) {
  console.error(`No cursor for: ${missing.map((c) => c.name).join(', ')}.\nRun with --init-now to start from now, or pass --since <ISO time>.`);
  process.exit(1);
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(homedir(), '.pwp-extract', runId);
mkdirSync(path.join(runDir, 'images'), { recursive: true, mode: 0o700 });

const wacliJson = (a) => JSON.parse(execFileSync('wacli', [...a, '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const ist = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

const packet = { run_id: runId, generated_at: new Date().toISOString(), topics: [], cursors_after: {} };
let msgCount = 0;
let imgCount = 0;

for (const t of topics) {
  const chats = chatsByTopic.get(t.key);
  if (!chats) continue;
  const items = must(
    await supabase.from('planning_items').select('id, title, type, status, amount, amount_kind, amount_note, detail, updated_at').eq('topic_id', t.id).order('created_at'),
    'items'
  );
  const messages = [];
  for (const c of chats) {
    const since = sinceOverride ?? cursors.get(c.jid);
    const rows = must(
      await supabase.from('messages').select('msg_id, timestamp, sender_name, from_me, text, media_type, media_caption').eq('chat_jid', c.jid).gt('timestamp', since).order('timestamp').limit(MAX_PER_CHAT),
      'new messages'
    );
    if (!rows.length) continue;

    // local file paths for downloaded media come from wacli, not Supabase
    const media = new Map();
    try {
      const local = wacliJson(['messages', 'list', '--chat', c.jid, '--after', since.slice(0, 10), '--asc', '--limit', '1000']).data;
      for (const m of Array.isArray(local) ? local : local.messages ?? []) if (m.LocalPath) media.set(m.MsgID, m.LocalPath);
    } catch {
      // wacli unavailable: images simply won't be included
    }

    for (const r of rows) {
      let image = null;
      const lp = media.get(r.msg_id);
      if (lp && existsSync(lp) && IMAGE_EXT.has(path.extname(lp).toLowerCase())) {
        const dest = `${r.msg_id}.jpg`;
        copyFileSync(lp, path.join(runDir, 'images', dest));
        image = `images/${dest}`;
        imgCount++;
      }
      messages.push({
        msg_id: r.msg_id,
        when_ist: ist(r.timestamp),
        sender: r.from_me ? 'Pranjal' : r.sender_name || 'unknown',
        chat: c.name,
        text: r.text,
        media_type: r.media_type,
        image,
      });
      msgCount++;
    }
    packet.cursors_after[c.jid] = rows[rows.length - 1].timestamp;
  }
  if (messages.length) packet.topics.push({ key: t.key, label: t.label, topic_id: t.id, items, messages });
}

writeFileSync(path.join(runDir, 'packet.json'), JSON.stringify(packet, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ run_id: runId, run_dir: runDir, topics_with_news: packet.topics.map((t) => `${t.key}:${t.messages.length}`), messages: msgCount, images: imgCount }, null, 2));
