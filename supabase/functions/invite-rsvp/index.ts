// Public endpoint behind the invite site's reply form. A household sends the code from its personal link.
//   GET  ?code=K7M2QX  -> { open, days: ["2027-02-14", ...], max }   the days it is invited to and its size
//   POST { code, name, days, arrive_on, leave_on, travel, note }  -> { ok: true }
// Replies are only stored (append only) for the couple to review in the planner; nothing here changes the guest list.
// While replies are closed (invite_settings.open = false) both calls answer { open: false } and nothing is stored.
// An unknown or revoked code looks the same as a closed form to the caller: no hint about which codes exist. The
// answer never includes names, other households or anything from the planner beyond the household's own days and
// size. Each call counts against a per-code and a per-IP limit.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('INVITE_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });

const CODE = /^[A-HJ-NP-Z2-9]{6,10}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PER_CODE = 20; // calls an hour
const PER_IP = 60;

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'not_allowed' }, 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { 'x-actor': 'Invite reply' } },
  });

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Please send the form again.' }, 400);
    }
  }
  const code = text(req.method === 'GET' ? new URL(req.url).searchParams.get('code') : body.code, 12).toUpperCase();

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const [ipHits, codeHits] = await Promise.all([
    sb.rpc('invite_rate_hit', { p_bucket: 'ip:' + (await sha256Hex(ip + (Deno.env.get('INVITE_RATE_SALT') ?? ''))) }),
    CODE.test(code) ? sb.rpc('invite_rate_hit', { p_bucket: 'code:' + code }) : Promise.resolve({ data: 0 }),
  ]);
  if (Number(ipHits.data) > PER_IP || Number(codeHits.data) > PER_CODE) return json({ error: 'Too many tries. Please wait an hour and try again.' }, 429);

  const { data: settings } = await sb.from('invite_settings').select('open').maybeSingle();
  if (!settings?.open) return json({ open: false });

  const closed = () => json({ open: false });
  if (!CODE.test(code)) return closed();
  const { data: link } = await sb.from('invite_codes').select('guest_id, revoked_at').eq('code', code).maybeSingle();
  if (!link || link.revoked_at) return closed();

  const [{ data: guest }, { data: rsvps }] = await Promise.all([
    sb.from('guests').select('persons').eq('id', link.guest_id).maybeSingle(),
    sb.from('guest_rsvps').select('event_date').eq('guest_id', link.guest_id).order('event_date'),
  ]);
  if (!guest) return closed();
  const days = (rsvps ?? []).map((r: { event_date: string }) => r.event_date);
  const max = Math.max(1, Number(guest.persons) || 1);

  if (req.method === 'GET') return json({ open: true, days, max });

  // ---- POST: check everything, then store the reply as sent ----
  const name = text(body.name, 80);
  if (!name) return json({ error: 'Please tell us your name.' }, 400);
  if (typeof body.website === 'string' && body.website !== '') return json({ ok: true }); // honeypot: pretend it worked

  const answers: Record<string, { answer: string; people: number }> = {};
  const sent = body.days && typeof body.days === 'object' ? body.days : {};
  for (const day of days) {
    const a = sent[day];
    if (!a || !['yes', 'maybe', 'no'].includes(a.answer)) return json({ error: 'Please answer for each day.' }, 400);
    const people = a.answer === 'no' ? 0 : Number(a.people);
    if (!Number.isInteger(people) || people < 0 || people > 20) return json({ error: 'Please check how many people are coming.' }, 400);
    answers[day] = { answer: a.answer, people };
  }
  if (days.length === 0) return json({ error: 'We could not find your invitation days. Please tell a family member.' }, 400);

  const arrive = isDay(body.arrive_on) ? body.arrive_on : null;
  const leave = isDay(body.leave_on) ? body.leave_on : null;
  if (arrive && leave && leave <= arrive) return json({ error: 'The leaving day has to be after the arriving day.' }, 400);

  const { error } = await sb.from('invite_responses').insert({
    guest_id: link.guest_id,
    code,
    responder_name: name,
    answers,
    arrive_on: arrive,
    leave_on: leave,
    travel: text(body.travel, 120) || null,
    note: text(body.note, 300) || null,
  });
  if (error) return json({ error: 'Something went wrong. Please try again.' }, 500);
  return json({ ok: true });
});
