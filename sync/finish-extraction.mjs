// Closes an extraction run: moves each chat's cursor forward past what was processed, and deletes the
// private working folder (including the copied images).
//
//   node finish-extraction.mjs <run_id>
import 'dotenv/config';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const runId = process.argv[2];
if (!runId) {
  console.error('Usage: node finish-extraction.mjs <run_id>');
  process.exit(1);
}
const runDir = path.join(homedir(), '.pwp-extract', runId);
const packetPath = path.join(runDir, 'packet.json');
if (!existsSync(packetPath)) {
  console.error(`No packet found at ${packetPath}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const packet = JSON.parse(readFileSync(packetPath, 'utf8'));

const rows = Object.entries(packet.cursors_after).map(([chat_jid, last_processed_at]) => ({ chat_jid, last_processed_at, updated_at: new Date().toISOString() }));
if (rows.length) {
  const { error } = await supabase.from('extraction_cursor').upsert(rows);
  if (error) {
    console.error('Could not advance cursors (working folder kept):', error.message);
    process.exit(1);
  }
}

rmSync(runDir, { recursive: true, force: true });
console.log(`Run ${runId} closed: ${rows.length} cursor(s) advanced, working folder deleted.`);
