# What the AWS side needs for planner emails

The app queues events (finished swipe decks, weekly swipe nudges, due-date reminders) in `notification_outbox`.
The `send-notifications` Edge Function publishes them to core-services. It stays a dry run until the items below exist.

## Ask for the core-services agent
1. A tenant for the wedding planner, with one service user (machine login) allowed to publish only.
2. A second Cognito app client with the `USER_PASSWORD_AUTH` flow enabled (the current client allows SRP only), so the Edge Function can sign in without a browser.
3. Two pub/sub topics, `notify-pranjal` and `notify-paridhi`, each with a confirmed email subscription (each person clicks the confirmation link once).
4. The pub/sub base URL and the Cognito client id.

## Then, in Supabase (Pranjal adds these as Edge Function secrets, never in chat)
`CORE_PUBSUB_URL`, `CORE_COGNITO_CLIENT_ID`, `CORE_SVC_USERNAME`, `CORE_SVC_PASSWORD`.

## Then
Claude sends one test email, then adds a schedule that calls the function after the daily 10:00 IST reminder job.
