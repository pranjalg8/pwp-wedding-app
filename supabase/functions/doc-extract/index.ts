// doc-extract: reads an uploaded vendor quote/contract (photo or PDF) with Gemini and files PROPOSALS in the
// Suggestions inbox. It never writes payments or tasks itself; a person accepts each one.
//
//  * The caller must be a signed-in, allowed planner user. The document row and the file are read with the
//    CALLER's token, so storage and table row-level security decide access.
//  * Suggestions have no insert policy for users, so the rows are written with the service role, only after the
//    caller has been verified and only for a document they can read.
//  * Bank details, UPI ids, phone numbers etc. are told to the model to leave out and are scrubbed again here.
//  * The file is sent to Gemini (free tier may use prompts to improve Google products); the app asks before each upload.
//
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default gemini-2.5-flash).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { RESPONSE_SCHEMA, systemPrompt, toProposals, type ExistingPayment } from './extract.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-device-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const MAX_BYTES = 10 * 1024 * 1024;
const HOURLY_LIMIT = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who, error: whoErr } = await user.auth.getUser();
  if (whoErr || !who.user) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  let documentId = '';
  try {
    documentId = String((await req.json()).document_id ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!/^[0-9a-f-]{36}$/.test(documentId)) return json({ error: 'bad_request' }, 400);

  // Under the caller's RLS: no row means not an allowed user, or not a real document.
  const { data: doc } = await user.from('documents').select('id, storage_path, file_name, mime_type, topic_id, status').eq('id', documentId).maybeSingle();
  if (!doc) return json({ error: 'not_found' }, 404);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const fail = async (code: string, status: number, detail?: string) => {
    await admin.from('documents').update({ status: 'failed', error: detail ?? code }).eq('id', doc.id);
    return json({ error: code }, status);
  };

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from('documents').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count ?? 0) >= HOURLY_LIMIT) return json({ error: 'rate_limited' }, 429);

  const { data: file, error: dlErr } = await user.storage.from('documents').download(doc.storage_path);
  if (dlErr || !file) return fail('unreadable', 422, 'file not found');
  if (file.size > MAX_BYTES) return fail('too_big', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { data: topics } = await admin.from('topics').select('id, key');
  const keyById = new Map((topics ?? []).map((t: { id: string; key: string }) => [t.id, t.key]));
  const idByKey = new Map((topics ?? []).map((t: { id: string; key: string }) => [t.key, t.id]));

  const { data: sched } = await admin.from('payment_schedule').select('payee, amount, due_date, topic_id').neq('status', 'cancelled');
  const { data: pending } = await admin.from('suggestions').select('payload').eq('status', 'pending').eq('kind', 'new_payment');
  const existing: ExistingPayment[] = [
    ...(sched ?? []).map((p: { payee: string; amount: number; due_date: string; topic_id: string | null }) => ({
      payee: p.payee, amount: Number(p.amount), due_date: p.due_date, topic_key: p.topic_id ? keyById.get(p.topic_id) ?? null : null,
    })),
    ...(pending ?? []).map((s: { payload: Record<string, unknown> }) => ({
      payee: String(s.payload.payee ?? ''), amount: Number(s.payload.amount), due_date: String(s.payload.due_date ?? ''), topic_key: null,
    })),
  ];

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(today, existing) }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: doc.mime_type, data: encodeBase64(bytes) } }, { text: 'Read this document and return the JSON.' }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    }),
  });
  if (res.status === 429) return json({ error: 'rate_limited' }, 429);
  if (!res.ok) {
    console.error('gemini error', res.status, (await res.text()).slice(0, 300));
    return json({ error: 'ai_unavailable' }, 502);
  }
  const out = await res.json();
  const text = (out?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('unreadable', 422, 'the model returned no usable answer');
  }

  const fallbackTopic = doc.topic_id ? keyById.get(doc.topic_id) ?? null : null;
  const p = toProposals(raw, existing, today, fallbackTopic);
  const topicId = idByKey.get(p.topicKey) ?? doc.topic_id;
  if (!topicId) return fail('unreadable', 422, 'no planning area');

  const base = { run_id: `doc-${doc.id}`, topic_id: topicId, document_id: doc.id, confidence: 'medium' as const };
  const rows = [
    ...p.payments.map((x) => ({
      ...base, kind: 'new_payment', involves_money: true, rationale: x.rationale,
      payload: { payee: x.payee, amount: x.amount, due_date: x.due_date, note: x.note, is_estimate: x.is_estimate },
    })),
    ...p.tasks.map((x) => ({
      ...base, kind: 'new_task', involves_money: false, rationale: x.rationale,
      payload: { title: x.title, due_date: x.due_date, priority: x.priority, summary: `From ${doc.file_name}` },
    })),
    ...(p.termsNote
      ? [{ ...base, kind: 'new_item', involves_money: false, rationale: 'Terms read from the document, kept as a note',
          payload: { type: 'note', title: p.termsNote.title, detail: p.termsNote.detail, status: 'open' } }]
      : []),
  ];
  if (rows.length) {
    const { error: insErr } = await admin.from('suggestions').insert(rows);
    if (insErr) {
      console.error('insert suggestions', insErr.message);
      return fail('save_failed', 500, 'could not save the proposals');
    }
  }
  await admin.from('documents').update({ status: 'read', summary: p.summary || null, error: null, read_at: new Date().toISOString(), topic_id: topicId }).eq('id', doc.id);

  return json({
    summary: p.summary,
    payments: p.payments.length,
    tasks: p.tasks.length,
    notes: p.termsNote ? 1 : 0,
    skipped: p.dropped,
    model,
  });
});
