# What it takes to send planner emails

The app queues events (finished swipe decks, weekly swipe nudges, due-date reminders) in `notification_outbox`.
The `send-notifications` Edge Function (v3) publishes them to core-services pub/sub. It stays a dry run until the steps below are done.

No change to core-services auth is needed. One shared Cognito pool serves every tenant (the tenant is a user attribute),
and the function signs in with SRP, the flow the existing app client already allows.

## 1. In core-services (a tenant-admin does this, signed in)
1. Use your existing tenant (`personal`) or create `wedding` (platform admin, `POST /tenants`).
2. Create two topics: `notify-pranjal` and `notify-paridhi`.
3. Subscribe each person's email to their topic. SNS emails a confirmation link; each person must click it once.
4. Create one extra member user for the app, for example `planner-bot@<your domain>`, in the same tenant (not an admin: any signed-in user may publish). Cognito emails a temporary password. Sign in once as that user and set a permanent password.

## 2. In Supabase: Project Settings, Edge Functions, Secrets (you add these; never paste them in chat)
- `CORE_PUBSUB_URL` = `https://r50lczvu84.execute-api.us-west-2.amazonaws.com/prod` (check it against `GET /integration`)
- `CORE_SVC_USERNAME` = the member user's username
- `CORE_SVC_PASSWORD` = its permanent password

## 3. Then
Claude sends one test email, then adds a schedule that calls the function after the daily 10:00 IST reminder job.
