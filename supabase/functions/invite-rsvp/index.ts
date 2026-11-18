// Public endpoint behind the invite site's reply form. A household sends the code from its personal link.
//   GET  ?code=K7M2QX  -> { open, days: ["2027-02-14", ...], max }   the days it is invited to and its size
//   POST { code, name, days, arrive_on, leave_on, travel, note }  -> { ok: true }
// Replies are only stored (append only) for the couple to review in the planner; nothing here changes the guest list.
// While replies are closed (invite_settings.open = false) both calls answer { open: false } and nothing at all is
// written. An unknown or revoked code looks the same as a closed form: no hint about which codes exist. The answer
// never includes names, other households or anything beyond the household's own days and size. While open, each call
// counts against a per-IP limit and, for a real code, a per-code limit. If the limit cannot be checked the call is
// refused rather than let through.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CODE, PER_CODE, PER_IP, checkReply, clientIp, isObject, text } from './rules.ts';

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
const closed = () => json({ open: false });
const busy = () => json({ error: 'Please try again in a little while.' }, 503);
const tooMany = () => json({ error: 'Too many tries. Please wait an hour and try again.' }, 429);

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    const parsed = await req.json().catch(() => null);
    if (!isObject(parsed)) return json({ error: 'Please send the form again.' }, 400);
    body = parsed;
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { 'x-actor': 'Invite reply' } },
  });

  const { data: settings } = await sb.from('invite_settings').select('open').maybeSingle();
  if (!settings?.open) return closed();

  const ipBucket = 'ip:' + (await sha256Hex(clientIp(req.headers) + (Deno.env.get('INVITE_RATE_SALT') ?? '')));
  const ipHits = await sb.rpc('invite_rate_hit', { p_bucket: ipBucket });
  if (ipHits.error) return busy();
  if (Number(ipHits.data) > PER_IP) return tooMany();

  // Old counters are of no use after the hour they count; clear them now and then.
  if (Math.random() < 0.02) await sb.from('invite_rate').delete().lt('hour', new Date(Date.now() - 2 * 86_400_000).toISOString());

  const code = text(req.method === 'GET' ? new URL(req.url).searchParams.get('code') : body.code, 12).toUpperCase();
  if (!CODE.test(code)) return closed();
  const { data: link } = await sb.from('invite_codes').select('guest_id, revoked_at').eq('code', code).maybeSingle();
  if (!link || link.revoked_at) return closed();

  // Counted only for real codes, so made-up codes cannot fill the table.
  const codeHits = await sb.rpc('invite_rate_hit', { p_bucket: 'code:' + code });
  if (codeHits.error) return busy();
  if (Number(codeHits.data) > PER_CODE) return tooMany();

  const [{ data: guest }, { data: rsvps }] = await Promise.all([
    sb.from('guests').select('persons').eq('id', link.guest_id).maybeSingle(),
    sb.from('guest_rsvps').select('event_date').eq('guest_id', link.guest_id).order('event_date'),
  ]);
  if (!guest) return closed();
  const days = (rsvps ?? []).map((r: { event_date: string }) => r.event_date);

  if (req.method === 'GET') return json({ open: true, days, max: Math.max(1, Number(guest.persons) || 1) });

  if (typeof body.website === 'string' && body.website !== '') return json({ ok: true }); // honeypot: pretend it worked
  const checked = checkReply(body, days);
  if ('error' in checked) return json({ error: checked.error }, 400);

  const { error } = await sb.from('invite_responses').insert({ guest_id: link.guest_id, code, ...checked.reply });
  if (error) return json({ error: 'Something went wrong. Please try again.' }, 500);
  return json({ ok: true });
});
