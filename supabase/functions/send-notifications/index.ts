// send-notifications: drains notification_outbox into core-services pub/sub (AWS SNS email).
//
// Safe by default:
//  * Only the service role may call it (the Supabase anon key is public, so it is rejected).
//  * With no core-services credentials configured it is a dry run: it reports what it WOULD send and
//    changes nothing, so rows stay pending.
//
// Configuration (Edge Function secrets):
//   CORE_PUBSUB_URL      e.g. https://r50lczvu84.execute-api.us-west-2.amazonaws.com/prod
//   CORE_TOPIC_MAP       optional JSON { "<profile_id>": "<topic name>" }; default is notify-<display name, lowercase>
//   Auth, one of:
//     CORE_ID_TOKEN                                  a Cognito ID token (short-lived; for testing)
//     CORE_COGNITO_CLIENT_ID + CORE_SVC_USERNAME + CORE_SVC_PASSWORD
//                                                    signs in with USER_PASSWORD_AUTH. NOTE: the core-services
//                                                    app client currently only allows SRP, so this needs that
//                                                    flow enabled, or a machine login added, in core-services.
//   CORE_AWS_REGION      default us-west-2
//   APP_URL              default https://pranjalg8.github.io/pwp-wedding-app/
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildMessage, type OutboxRow } from './messages.ts';

const MAX_ATTEMPTS = 5;

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

async function getIdToken(): Promise<string | null> {
  const staticToken = Deno.env.get('CORE_ID_TOKEN');
  if (staticToken) return staticToken;
  const clientId = Deno.env.get('CORE_COGNITO_CLIENT_ID');
  const username = Deno.env.get('CORE_SVC_USERNAME');
  const password = Deno.env.get('CORE_SVC_PASSWORD');
  if (!clientId || !username || !password) return null;
  const region = Deno.env.get('CORE_AWS_REGION') ?? 'us-west-2';
  const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({ AuthFlow: 'USER_PASSWORD_AUTH', ClientId: clientId, AuthParameters: { USERNAME: username, PASSWORD: password } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Cognito sign-in failed: ${body.__type ?? res.status}`);
  return body.AuthenticationResult?.IdToken ?? null;
}

Deno.serve(async (req) => {
  if (callerRole(req) !== 'service_role') return json({ error: 'service role only' }, 403);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const appUrl = Deno.env.get('APP_URL') ?? 'https://pranjalg8.github.io/pwp-wedding-app/';
  const pubsubUrl = Deno.env.get('CORE_PUBSUB_URL')?.replace(/\/$/, '');
  const topicMap: Record<string, string> = JSON.parse(Deno.env.get('CORE_TOPIC_MAP') ?? '{}');

  const { data: rows, error } = await supabase
    .from('notification_outbox')
    .select('id, kind, recipient_profile_id, payload, attempts')
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

  const results: Record<string, unknown>[] = [];
  for (const row of (rows ?? []) as (OutboxRow & { attempts: number })[]) {
    const topic = topicMap[row.recipient_profile_id] ?? `notify-${(nameOf.get(row.recipient_profile_id) ?? 'unknown').toLowerCase()}`;
    const { subject, message } = buildMessage(row, appUrl);

    if (!live) {
      results.push({ id: row.id, kind: row.kind, status: 'dry-run', topic, subject, message });
      continue;
    }

    const res = await fetch(`${pubsubUrl}/topics/${encodeURIComponent(topic)}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject, message }),
    });
    if (res.ok) {
      await supabase
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null })
        .eq('id', row.id);
      results.push({ id: row.id, kind: row.kind, status: 'sent', topic });
    } else {
      const text = (await res.text().catch(() => '')).slice(0, 300);
      const attempts = row.attempts + 1;
      await supabase
        .from('notification_outbox')
        .update({ attempts, last_error: `HTTP ${res.status}: ${text}`, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' })
        .eq('id', row.id);
      results.push({ id: row.id, kind: row.kind, status: 'error', http: res.status, topic });
    }
  }

  return json({ live, authError, pending: rows?.length ?? 0, results });
});
