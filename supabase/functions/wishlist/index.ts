// Public endpoint behind the gift wishlist page. Friends need no login.
//   GET                                   -> { open, items: [...] }          the visible items and how many places are left
//   POST { action: 'claim', id, name, token }   -> { ok: true }               "I'll gift this"
//   POST { action: 'unclaim', id, token }       -> { ok: true }               give it back, from the phone that took it
// While the page is closed (wishlist_settings.open = false) every call answers { open: false } and nothing is
// written. The answer never includes who took what: the couple see that in the planner. A claim is made with a
// random secret the friend's phone invents; only its hash is stored, so only that phone can undo it. Each call
// counts against a per-IP limit; if the limit cannot be checked the call is refused rather than let through.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PER_IP_READ, PER_IP_WRITE, checkClaim, checkUnclaim, clientIp, isObject, publicItem } from './rules.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
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
    if (!isObject(parsed)) return json({ error: 'Please try again.' }, 400);
    body = parsed;
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: settings } = await sb.from('wishlist_settings').select('open').maybeSingle();
  if (!settings?.open) return json({ open: false });

  const writing = req.method === 'POST';
  const ipHash = await sha256Hex(clientIp(req.headers) + (Deno.env.get('INVITE_RATE_SALT') ?? ''));
  const hits = await sb.rpc('invite_rate_hit', { p_bucket: (writing ? 'wishw:' : 'wishr:') + ipHash });
  if (hits.error) return busy();
  if (Number(hits.data) > (writing ? PER_IP_WRITE : PER_IP_READ)) return tooMany();

  if (req.method === 'GET') {
    const [items, claims] = await Promise.all([
      sb.from('wishlist_items')
        .select('id, title, note, category, url, image_url, price_min, price_max, quantity')
        .eq('hidden', false)
        .order('sort_order')
        .order('created_at')
        .limit(1000),
      sb.from('wishlist_claims').select('item_id').limit(5000),
    ]);
    if (items.error || claims.error) return busy();
    const taken = new Map<string, number>();
    for (const c of claims.data ?? []) taken.set(c.item_id, (taken.get(c.item_id) ?? 0) + 1);
    return json({ open: true, items: (items.data ?? []).map((r) => publicItem(r, taken.get(r.id) ?? 0)) });
  }

  if (typeof body.website === 'string' && body.website !== '') return json({ ok: true }); // honeypot: pretend it worked

  if (body.action === 'claim') {
    const checked = checkClaim(body);
    if ('error' in checked) return json({ error: checked.error }, 400);
    const { id, name, token } = checked.claim;
    const res = await sb.rpc('wishlist_claim', { p_item: id, p_name: name, p_token_hash: await sha256Hex(token) });
    if (res.error) return busy();
    if (res.data === 'taken') return json({ error: 'Someone just took the last one. Please pick something else.' }, 409);
    if (res.data !== 'ok') return json({ error: 'That gift is no longer on the list.' }, 404);
    return json({ ok: true });
  }

  if (body.action === 'unclaim') {
    const checked = checkUnclaim(body);
    if ('error' in checked) return json({ error: checked.error }, 400);
    const res = await sb.rpc('wishlist_unclaim', { p_item: checked.undo.id, p_token_hash: await sha256Hex(checked.undo.token) });
    if (res.error) return busy();
    return json({ ok: true });
  }

  return json({ error: 'not_allowed' }, 405);
});
