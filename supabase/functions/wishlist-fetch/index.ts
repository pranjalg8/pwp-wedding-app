// wishlist-fetch: "fill from link" for the planner's wishlist form. Give it a product web address and it tries to
// read the title, picture and price from the page (Amazon, Flipkart and most shops).
//
//  * Only a signed-in, allowed planner user can call it: the caller's token must be able to read wishlist_settings,
//    whose row-level security is is_allowed_user. Anyone else gets a 403.
//  * It reads public web pages only: http or https, ordinary ports, never a private or internal address (checked
//    before each request and after each redirect, including what the host name resolves to). The page is cut off at
//    1.5 MB and the whole call at 8 seconds. Nothing is stored; the answer goes back to the form.
//  * It is best effort. Stores often block robots or hide the price, so the answer says what it found and the form
//    keeps working by hand either way. Nothing here ever fails the form.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MAX_HOPS, MAX_HTML, checkFetchUrl, parseProduct, privateIp, storeName } from './parse.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-device-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Best effort: if the host name resolves to a private address, refuse. If this runtime cannot resolve names at
// all, the other checks still apply.
async function resolvesPrivately(host: string): Promise<boolean> {
  if (/^(\d{1,3}\.){3}\d{1,3}$|:/.test(host)) return privateIp(host);
  for (const type of ['A', 'AAAA'] as const) {
    try {
      const ips = await Deno.resolveDns(host, type);
      if (ips.some(privateIp)) return true;
    } catch {
      // no record of this kind, or resolving is not available here
    }
  }
  return false;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_HTML) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(size, MAX_HTML));
  let at = 0;
  for (const c of chunks) {
    const room = all.length - at;
    if (room <= 0) break;
    all.set(c.subarray(0, room), at);
    at += Math.min(c.length, room);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'not_allowed' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'sign_in_needed' }, 401);
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const allowed = await caller.from('wishlist_settings').select('id').maybeSingle();
  if (allowed.error || !allowed.data) return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => null);
  const raw = typeof body?.url === 'string' ? body.url : '';
  const first = checkFetchUrl(raw);
  if ('error' in first) return json({ ok: false, reason: first.error });

  const deadline = AbortSignal.timeout(8000);
  try {
    let url = first.url;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (await resolvesPrivately(url.hostname)) return json({ ok: false, reason: 'That address is not a public website.' });
      const res = await fetch(url, {
        redirect: 'manual',
        signal: deadline,
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-IN,en;q=0.9' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = checkFetchUrl(new URL(res.headers.get('location')!, url).toString());
        if ('error' in next) return json({ ok: false, reason: next.error });
        url = next.url;
        await res.body?.cancel().catch(() => {});
        continue;
      }
      if (!res.ok) return json({ ok: false, reason: `The shop answered with an error (${res.status}). Fill the details in by hand.` });
      const type = res.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml/i.test(type)) return json({ ok: false, reason: 'That link is not a web page.' });
      const found = parseProduct(await readCapped(res), url.toString());
      const any = found.title || found.image || found.price_min != null;
      return json({ ok: true, store: storeName(url.toString()), ...found, partial: !(found.title && found.image && found.price_min != null), empty: !any });
    }
    return json({ ok: false, reason: 'That link redirects too many times.' });
  } catch {
    return json({ ok: false, reason: 'Could not read that page. Fill the details in by hand.' });
  }
});
