// Public, read-only schedule for the invite site: the guest functions with their day, part of the day, time (once
// switched on), venue, short line and dress code. No login and no code; the answer is the same for everyone and
// holds nothing the invite does not already show. Family-only functions, notes and statuses never leave the planner.
//   GET -> { days: [{ date, functions: [{ key, name, part, time, start, end, venue, blurb, dress }] }] }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { publicSchedule, type FunctionRow, type SiteRow } from './rules.ts';

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('INVITE_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': cache, 'Referrer-Policy': 'no-referrer' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'not_allowed' }, 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const [fns, sites] = await Promise.all([
    sb
      .from('wedding_functions')
      .select('key, name, event_date, slot, sort_order, family_only, start_time, end_time, show_time, venue_site_id, venue_text, invite_name, invite_part, invite_blurb, dress')
      .eq('family_only', false),
    sb.from('stay_sites').select('id, name, maps_query, maps_url'),
  ]);
  if (fns.error || sites.error) return json({ error: 'Please try again in a little while.' }, 503);
  // Browsers and the CDN may keep it for five minutes; an edit in the planner shows on the invite soon after.
  return json({ days: publicSchedule(fns.data as FunctionRow[], sites.data as SiteRow[]) }, 200, 'public, max-age=300');
});
