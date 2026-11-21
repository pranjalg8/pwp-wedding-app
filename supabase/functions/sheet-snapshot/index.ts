// sheet-snapshot: a read-only JSON snapshot of the wedding budget for the Google Sheet "Wedding budget by day".
// The sheet's Apps Script pulls it every 30 minutes (tools/sheet-sync/).
//
//  * Auth: the shared secret SHEET_SYNC_TOKEN, sent in the x-sheet-token header, compared in constant time.
//    Anything else (no header, wrong token, secret not set) is a 401 with no detail. Deploy with --no-verify-jwt,
//    because the caller is Apps Script and has no Supabase login; the token is the only gate.
//  * Reads only, with the service role inside the function (the budget tables are RLS-protected). Wedding group
//    only, and only Pranjal's share. No guest, contact or login data is read.
//  * No CORS: a browser has no business calling this.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HOTEL_SAI, SHRI_KANTH, shapeSnapshot, tokenMatches, type SnapshotInput } from './rules.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });

Deno.serve(async (req) => {
  if (!(await tokenMatches(req.headers.get('x-sheet-token'), Deno.env.get('SHEET_SYNC_TOKEN')))) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'not_allowed' }, 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const [topics, payments, schedule, vendors, stayNights, settings] = await Promise.all([
    sb.from('topics').select('id, budget_group'),
    sb.from('payments').select('amount, paridhi_amount, topic_id'),
    sb
      .from('payment_schedule')
      .select('payee, amount, paridhi_amount, due_date, topic_id, note, is_estimate, status, paid_payment_id, vendor_id, quantity, unit, rate, adjustment, in_budget'),
    sb.from('vendors').select('id, name').in('name', [SHRI_KANTH, HOTEL_SAI]),
    sb.from('stay_nights').select('night, rooms, stay_sites!inner(name)').in('stay_sites.name', [SHRI_KANTH, HOTEL_SAI]),
    sb.from('budget_settings').select('total_budget, funds_available, funds_as_of, monthly_addition').maybeSingle(),
  ]);

  const failed = [topics, payments, schedule, vendors, stayNights, settings].find((r) => r.error);
  if (failed) {
    console.error('sheet-snapshot read failed', failed.error?.message);
    return json({ error: 'read_failed' }, 500);
  }

  const input = {
    topics: topics.data,
    payments: payments.data,
    schedule: schedule.data,
    vendors: vendors.data,
    stayNights: stayNights.data,
    settings: settings.data,
  } as SnapshotInput;
  return json(shapeSnapshot(input, new Date()));
});
