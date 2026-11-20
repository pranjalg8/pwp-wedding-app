// budget-review: runs the deterministic budget checks (checks.ts), stores what they find in budget_flags and has
// Gemini word a short question for each new finding (llm.ts). It never changes a payment, a ledger entry or a
// setting: its only writes are to budget_flags. Acting on a flag is done by a person in the Budget page, in edit mode.
//
// Who may call it:
//  * a signed-in planner user (the "Review now" button); the caller's own token is used to confirm they can read the
//    budget under row-level security, or
//  * the nightly workflow, which sends the shared secret in x-review-token (BUDGET_REVIEW_TOKEN).
//
// Secrets: GEMINI_API_KEY and GEMINI_MODEL (the same ones the chatbot, kb-chat, already uses), BUDGET_REVIEW_TOKEN
// (for the nightly run). SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
// Without a Gemini key the checks still run and the page shows the plain message instead of a question.
//
// Body (all optional): { dryRun: true } returns the findings without writing anything.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fingerprint, reviewBudget, type Flag, type PaymentRow, type ScheduleRow } from './checks.ts';
import { buildPrompt, parseQuestions, type QuestionItem } from './llm.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-device-name, x-review-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const MAX_QUESTIONS = 25; // per run; the rest are asked on the next one
const num = (v: unknown) => Number(v) || 0;

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Who is calling
  const expected = Deno.env.get('BUDGET_REVIEW_TOKEN');
  const given = req.headers.get('x-review-token');
  const scheduled = !!expected && !!given && sameSecret(given, expected);
  if (!scheduled) {
    const auth = req.headers.get('authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: claims, error: claimsError } = await asUser.auth.getClaims(auth.replace(/^Bearer\s+/i, ''));
    if (claimsError || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401);
    // Row-level security decides: anyone who is not an allowed planner user reads no settings row and is turned away.
    const { data: probe, error: probeError } = await asUser.from('budget_settings').select('id').limit(1);
    if (probeError) return json({ error: 'budget_unavailable' }, 500);
    if (!probe || probe.length === 0) return json({ error: 'forbidden' }, 403);
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    // no body is fine
  }

  const [s, p, items, st, topics, vendors, nights, sites] = await Promise.all([
    service.from('payment_schedule').select('*'),
    service.from('payments').select('*'),
    service.from('planning_items').select('id, title, amount, amount_kind, topic_id').eq('amount_kind', 'paid'),
    service.from('budget_settings').select('total_budget, gold_budget, post_wedding_budget').eq('id', 1).maybeSingle(),
    service.from('topics').select('id, key, label, budget_group'),
    service.from('vendors').select('id, name, kind'),
    service.from('stay_nights').select('site_id, night, rooms'),
    service.from('stay_sites').select('id, name'),
  ]);
  const failed = [s, p, items, st, topics, vendors, nights, sites].find((r) => r.error);
  if (failed?.error) {
    console.error('budget-review load failed', failed.error.message);
    return json({ error: 'load_failed' }, 500);
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const schedule = (s.data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    amount: num(r.amount),
    paridhi_amount: num(r.paridhi_amount),
    quantity: r.quantity == null ? null : num(r.quantity),
    rate: r.rate == null ? null : num(r.rate),
    adjustment: num(r.adjustment),
    basis_multiplier: r.basis_multiplier == null ? 1 : num(r.basis_multiplier),
    basis_extra: num(r.basis_extra),
  })) as ScheduleRow[];
  const payments = (p.data ?? []).map((r: Record<string, unknown>) => ({ ...r, amount: num(r.amount), paridhi_amount: num(r.paridhi_amount) })) as PaymentRow[];
  const settings = st.data
    ? { total_budget: st.data.total_budget == null ? null : num(st.data.total_budget), gold_budget: st.data.gold_budget == null ? null : num(st.data.gold_budget), post_wedding_budget: st.data.post_wedding_budget == null ? null : num(st.data.post_wedding_budget) }
    : null;

  const flags = reviewBudget({
    today,
    schedule,
    payments,
    paidItems: (items.data ?? []).map((i) => ({ ...i, amount: i.amount == null ? null : num(i.amount) })),
    settings,
    topics: topics.data ?? [],
    vendors: vendors.data ?? [],
    stayNights: nights.data ?? [],
    staySites: sites.data ?? [],
  });
  if (dryRun) return json({ dryRun: true, count: flags.length, flags });

  // Reconcile with what is stored. Nothing already decided is touched, and nothing is rewritten when it has not changed.
  const prints = new Map(flags.map((f) => [fingerprint(f), f]));
  const { data: stored, error: storedError } = await service.from('budget_flags').select('id, fingerprint, status, question');
  if (storedError) return json({ error: 'flags_unavailable' }, 500);
  const known = new Map((stored ?? []).map((r) => [r.fingerprint as string, r]));

  const fresh: [string, Flag][] = [];
  const reopen: string[] = [];
  for (const [fp, f] of prints) {
    const have = known.get(fp);
    if (!have) fresh.push([fp, f]);
    else if (have.status === 'resolved') reopen.push(have.id as string);
  }
  const gone = (stored ?? []).filter((r) => r.status === 'open' && !prints.has(r.fingerprint as string)).map((r) => r.id as string);

  if (fresh.length) {
    const { error } = await service.from('budget_flags').insert(
      fresh.map(([fp, f]) => ({ fingerprint: fp, code: f.code, severity: f.severity, source_table: f.table, row_id: f.rowId, label: f.label, message: f.message, details: f.details }))
    );
    if (error) return json({ error: 'save_failed', detail: error.message }, 500);
  }
  if (reopen.length) await service.from('budget_flags').update({ status: 'open', decided_by: null, decided_at: null, decision_note: null }).in('id', reopen);
  if (gone.length) await service.from('budget_flags').update({ status: 'resolved' }).in('id', gone);

  // Ask Gemini to word a question for every open flag that has none yet.
  let asked = 0;
  let ai: 'ok' | 'not_configured' | 'error' | 'nothing_to_ask' = 'nothing_to_ask';
  const { data: openNow } = await service.from('budget_flags').select('id, fingerprint, question').eq('status', 'open').is('question', null).limit(MAX_QUESTIONS);
  const todo = (openNow ?? []).filter((r) => prints.has(r.fingerprint as string));
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (todo.length > 0 && !apiKey) ai = 'not_configured';
  else if (todo.length > 0 && apiKey) {
    const questionItems: QuestionItem[] = [];
    for (const r of todo) {
      const f = prints.get(r.fingerprint as string)!;
      const row = f.table === 'payment_schedule' ? schedule.find((x) => x.id === f.rowId) : f.table === 'payments' ? payments.find((x) => x.id === f.rowId) : null;
      const word = f.label.split(/[\s:,]+/).find((w) => w.length > 3);
      let chat: string[] = [];
      if (word) {
        const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
        const { data: msgs } = await service.from('messages').select('text, sender_name, timestamp').ilike('text', `%${word.replace(/[%_]/g, '')}%`).gte('timestamp', since).order('timestamp', { ascending: false }).limit(4);
        chat = (msgs ?? []).filter((m) => m.text).map((m) => `${m.sender_name ?? 'someone'}: ${m.text}`);
      }
      questionItems.push({ code: f.code, label: f.label, message: f.message, row: row ? { ...row } : null, chat });
    }
    const { system, user } = buildPrompt(questionItems, today);
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) {
      console.error('gemini error', res.status, (await res.text()).slice(0, 300));
      ai = 'error';
    } else {
      const out = await res.json();
      const text = (out?.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? '').join('');
      const questions = parseQuestions(text, todo.length);
      for (const [n, q] of questions) {
        const { error } = await service.from('budget_flags').update({ question: q, question_model: model }).eq('id', todo[n - 1].id as string).is('question', null);
        if (!error) asked += 1;
      }
      ai = 'ok';
    }
  }

  return json({ count: flags.length, new: fresh.length, reopened: reopen.length, resolved: gone.length, asked, ai, source: scheduled ? 'scheduled' : 'manual' });
});
