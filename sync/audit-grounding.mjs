// Grounding audit: for every amount in the planner (and in pending suggestions), checks that the number
// really appears in the chat messages it cites. Catches typos, misreadings and invented figures.
//
//   node audit-grounding.mjs
//
// Results per amount:
//   TEXT-OK     the number appears in the text of a cited message
//   IMAGE-ONLY  no cited message has text with that number; the cited messages include photos, so the number
//               presumably came from an image and must be checked by eye (this tool cannot see images)
//   UNSUPPORTED no cited message supports it and none is a photo: treat as a likely error
//   NO-SOURCE   the item cites nothing
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// every rupee-like number a message could be stating, normalised to plain rupees
export function amountsIn(text) {
  const out = new Set();
  if (!text) return out;
  const t = text.replace(/₹/g, ' ');
  for (const m of t.matchAll(/\d{1,3}(?:,\d{2})*,\d{3}(?:\.\d+)?/g)) out.add(Number(m[0].replace(/,/g, '')));
  for (const m of t.matchAll(/(?<![\d.,])\d{4,8}(?![\d,])/g)) out.add(Number(m[0]));
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(?:L|l|lakh|lac)\b/g)) {
    out.add(Math.round(Number(m[1].replace(',', '.')) * 1e5));
    out.add(Math.round(Number(m[2].replace(',', '.')) * 1e5));
  }
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:L|l|lakh|lac)\b/g)) out.add(Math.round(Number(m[1].replace(',', '.')) * 1e5));
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*[kK]\b/g)) out.add(Math.round(Number(m[1]) * 1e3));
  return out;
}

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

const items = must(await supabase.from('planning_items').select('id, title, amount, amount_kind, status, source_msg_ids').not('amount', 'is', null), 'items');
const sugg = must(await supabase.from('suggestions').select('id, payload, source_msg_ids, status').eq('status', 'pending'), 'suggestions')
  .filter((s) => s.payload?.amount != null)
  .map((s) => ({ id: s.id, title: `[suggestion] ${s.payload.title ?? '(change)'}`, amount: s.payload.amount, amount_kind: s.payload.amount_kind, status: 'pending', source_msg_ids: s.source_msg_ids }));

const rows = [...items, ...sugg];
const ids = [...new Set(rows.flatMap((r) => r.source_msg_ids ?? []))];
const msgs = ids.length ? must(await supabase.from('messages').select('msg_id, text, media_type, media_caption').in('msg_id', ids), 'messages') : [];
const byId = new Map(msgs.map((m) => [m.msg_id, m]));

const tally = { 'TEXT-OK': 0, 'IMAGE-ONLY': 0, UNSUPPORTED: 0, 'NO-SOURCE': 0 };
const report = [];
for (const r of rows) {
  const cited = (r.source_msg_ids ?? []).map((id) => byId.get(id)).filter(Boolean);
  let verdict;
  if (!cited.length) verdict = 'NO-SOURCE';
  else if (cited.some((m) => amountsIn(`${m.text ?? ''} ${m.media_caption ?? ''}`).has(Number(r.amount)))) verdict = 'TEXT-OK';
  else if (cited.some((m) => m.media_type === 'image' || m.media_type === 'document')) verdict = 'IMAGE-ONLY';
  else verdict = 'UNSUPPORTED';
  tally[verdict]++;
  report.push({ verdict, amount: Number(r.amount), kind: r.amount_kind ?? '-', title: r.title.slice(0, 58), sources: cited.length });
}

const order = ['UNSUPPORTED', 'NO-SOURCE', 'IMAGE-ONLY', 'TEXT-OK'];
report.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
for (const r of report) console.log(`${r.verdict.padEnd(11)} ₹${String(r.amount.toLocaleString('en-IN')).padEnd(11)} ${String(r.kind).padEnd(8)} ${r.title}  (${r.sources} src)`);
console.log(`\n${rows.length} amounts checked:`, JSON.stringify(tally));
if (tally.UNSUPPORTED || tally['NO-SOURCE']) process.exitCode = 1;
