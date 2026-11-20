// send-notifications: drains notification_outbox into core-services pub/sub (AWS SNS email).
//
// Safe by default:
//  * Only the service role may call it (the Supabase anon key is public, so it is rejected).
//  * With no core-services credentials configured it is a dry run: it reports what it WOULD send and
//    changes nothing, so rows stay pending.
//  * Once live, rows older than STALE_HOURS (queued while sending was off) are marked skipped, not sent, so
//    switching on never floods anyone with old reminders.
//
// Configuration (Edge Function secrets):
//   CORE_PUBSUB_URL      e.g. https://r50lczvu84.execute-api.us-west-2.amazonaws.com/prod
//   CORE_TOPIC_MAP       optional JSON { "<profile_id>": "<topic name>" }; default is notify-<display name, lowercase>
//   Auth, one of:
//     CORE_ID_TOKEN                      a Cognito ID token (short-lived; for testing)
//     CORE_SVC_USERNAME + CORE_SVC_PASSWORD
//                                        a normal member of the tenant, signed in with SRP (the flow the
//                                        existing app client allows; nothing to change in core-services)
//   CORE_USER_POOL_ID / CORE_COGNITO_CLIENT_ID   optional; default to the shared pool and web client
//   APP_URL              default https://pranjalg8.github.io/pwp-wedding-app/
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'npm:amazon-cognito-identity-js@6.3.12';
import { buildMessage, type OutboxRow } from './messages.ts';

const MAX_ATTEMPTS = 5;
const STALE_HOURS = 48;

function callerRole(req: Request): string | null {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Signs in with SRP, the one flow the core-services app client already allows, so no change to core-services
// auth is needed. The service user is an ordinary member of the tenant (any signed-in user may publish).
function getIdToken(): Promise<string | null> {
  const staticToken = Deno.env.get('CORE_ID_TOKEN');
  if (staticToken) return Promise.resolve(staticToken);
  const username = Deno.env.get('CORE_SVC_USERNAME');
  const password = Deno.env.get('CORE_SVC_PASSWORD');
  if (!username || !password) return Promise.resolve(null);
  const pool = new CognitoUserPool({
    UserPoolId: Deno.env.get('CORE_USER_POOL_ID') ?? 'us-west-2_WMOgHf6cc',
    ClientId: Deno.env.get('CORE_COGNITO_CLIENT_ID') ?? '1kb3vbjtm4ppcme9g0hgt37fhk',
  });
  const user = new CognitoUser({ Username: username, Pool: pool });
  return new Promise((resolve, reject) => {
    user.authenticateUser(new AuthenticationDetails({ Username: username, Password: password }), {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: (err) => reject(new Error(`Cognito sign-in failed: ${err?.code ?? err?.name ?? 'unknown'}`)),
      newPasswordRequired: () => reject(new Error('Cognito sign-in failed: service user must finish first sign-in (new password)')),
    });
  });
}

Deno.serve(async (req) => {
  if (callerRole(req) !== 'service_role') return json({ error: 'service role only' }, 403);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const appUrl = Deno.env.get('APP_URL') ?? 'https://pranjalg8.github.io/pwp-wedding-app/';
  const pubsubUrl = Deno.env.get('CORE_PUBSUB_URL')?.replace(/\/$/, '');
  const topicMap: Record<string, string> = JSON.parse(Deno.env.get('CORE_TOPIC_MAP') ?? '{}');

  const { data: rows, error } = await supabase
    .from('notification_outbox')
    .select('id, kind, recipient_profile_id, payload, attempts, created_at')
    .eq('status', 'pending')
    .order('created_at')
    .limit(25);
  if (error) return json({ error: error.message }, 500);

  const { data: people } = await supabase.from('profiles').select('id, display_name');
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));

  let token: string | null = null;
  let authError: string | null = null;
  try {
    token = pubsubUrl ? await getIdToken() : null;
  } catch (e) {
    authError = (e as Error).message;
  }
  const live = Boolean(pubsubUrl && token);

  const all = (rows ?? []) as (OutboxRow & { attempts: number; created_at: string })[];
  const cutoff = Date.now() - STALE_HOURS * 3_600_000;
  const stale = all.filter((r) => new Date(r.created_at).getTime() < cutoff);
  const batch = all.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const prepared = batch.map((row) => ({
    row,
    topic: topicMap[row.recipient_profile_id] ?? `notify-${(nameOf.get(row.recipient_profile_id) ?? 'unknown').toLowerCase()}`,
    ...buildMessage(row, appUrl),
  }));

  if (!live) {
    const results = [
      ...prepared.map(({ row, topic, subject, message }) => ({ id: row.id, kind: row.kind, status: 'dry-run', topic, subject, message })),
      ...stale.map((row) => ({ id: row.id, kind: row.kind, status: 'dry-run: would skip (stale)' })),
    ];
    return json({ live, authError, pending: rows?.length ?? 0, results });
  }

  // Publish the whole batch (at most 25) at once instead of one after another.
  const settled = await Promise.allSettled(
    prepared.map(async ({ topic, subject, message }) => {
      const res = await fetch(`${pubsubUrl}/topics/${encodeURIComponent(topic)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, message }),
      });
      return { ok: res.ok, status: res.status, text: res.ok ? '' : (await res.text().catch(() => '')).slice(0, 300) };
    }),
  );

  const results: Record<string, unknown>[] = stale.map((row) => ({ id: row.id, kind: row.kind, status: 'skipped' }));
  if (stale.length) {
    await supabase
      .from('notification_outbox')
      .update({ status: 'skipped', last_error: `Queued more than ${STALE_HOURS} hours before sending; not sent` })
      .in('id', stale.map((r) => r.id));
  }
  // Sent rows are marked in one update per distinct attempt count (usually just one), so each row still records
  // attempts + 1. Failed rows keep their own error text, so they are updated one by one, in parallel.
  const sentByAttempts = new Map<number, string[]>();
  const writes: PromiseLike<unknown>[] = [];
  const sentAt = new Date().toISOString();
  settled.forEach((s, i) => {
    const { row, topic } = prepared[i];
    const attempts = row.attempts + 1;
    if (s.status === 'fulfilled' && s.value.ok) {
      sentByAttempts.set(attempts, [...(sentByAttempts.get(attempts) ?? []), row.id]);
      results.push({ id: row.id, kind: row.kind, status: 'sent', topic });
      return;
    }
    // A publish that could not even be sent (network error) counts as a failed attempt, like an HTTP error.
    const lastError = s.status === 'fulfilled' ? `HTTP ${s.value.status}: ${s.value.text}` : `fetch failed: ${String((s.reason as Error)?.message ?? s.reason).slice(0, 280)}`;
    writes.push(
      supabase
        .from('notification_outbox')
        .update({ attempts, last_error: lastError, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' })
        .eq('id', row.id),
    );
    results.push({ id: row.id, kind: row.kind, status: 'error', ...(s.status === 'fulfilled' ? { http: s.value.status } : {}), topic });
  });
  for (const [attempts, ids] of sentByAttempts) {
    writes.push(
      supabase
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: sentAt, attempts, last_error: null })
        .in('id', ids),
    );
  }
  await Promise.all(writes);

  return json({ live, authError, pending: rows?.length ?? 0, results });
});
