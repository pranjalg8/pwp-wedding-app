# PwP Wedding Planner

A shared wedding-planning app for Pranjal & Paridhi. Deployed as a static site on
GitHub Pages; real data lives in Supabase (Postgres + Auth + Row Level Security),
kept current by a local script that mirrors new messages out of the WhatsApp
groups via [`wacli`](https://wacli.sh).

**Everything here runs on free tiers**: GitHub (public repo + Actions + Pages)
and Supabase's free plan. No paid services required.

## Why this shape

GitHub Pages only serves static files — there's no backend to accept writes or
restrict access. So the repo (and the deployed page) contains only app code,
nothing sensitive. The actual plan — jewellery budgets, vendor contacts, hotel
bookings — lives in Supabase, gated by real login (magic-link email) restricted
to exactly two accounts via Row Level Security. A PIN is an extra confirmation
step before saving edits, not the only lock on the door.

Every change is audited under two headings (see the Activity page in the app):
- **Manual** — an edit made by a person in the UI (with device info captured
  best-effort: browser user-agent + an optional self-chosen device nickname).
- **Automatic / Sync** — the WhatsApp sync script, or Claude acting on request.

## What's new

Every version is listed in [CHANGELOG.md](CHANGELOG.md) and in the app under Activity, What's new. Both come from one
file, `web/src/data/releases.json`. To ship a new version, add an entry at the top of that file, run
`npm run changelog` in `web/`, and commit both. A check in the deploy workflow fails if they disagree, and merging to
`main` publishes the newest version as a GitHub release. Keep entries in plain language and leave out anything that
is private to one of you.

## One-time setup

### 1. Supabase project
Project ref `qutawbofxpcqxkxrzebv` is already created. Apply the schema:
1. Run `supabase/migrations/0001_init.sql` (SQL editor, or via the Supabase MCP server once connected).
2. Run `supabase/seed.sql` (seeds the topic list).
3. In **Authentication → Providers**, confirm email/magic-link is enabled (default).
4. Have both Pranjal and Paridhi visit the deployed app once and request a magic
   link (this creates their `auth.users` row even though they can't see any data yet).
5. In the SQL editor, add both as allowed profiles:
   ```sql
   insert into profiles (id, email, display_name) values
     ('<pranjal-auth-uid>', 'pranjal@...', 'Pranjal'),
     ('<paridhi-auth-uid>', 'paridhi@...', 'Paridhi');
   ```
6. Set the admin PIN (do not commit the real PIN anywhere):
   ```sql
   insert into app_secrets (id, pin_hash) values (1, crypt('<pin>', gen_salt('bf')));
   ```

### 2. Frontend (`web/`)
```bash
cd web
cp .env.example .env.local   # fill in VITE_SUPABASE_ANON_KEY (Project Settings -> API)
npm install
npm run dev                  # local preview
```

### 3. GitHub Pages deploy
1. Repo Settings → Pages → Source: **GitHub Actions**.
2. Repo Settings → Secrets and variables → Actions, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the anon key is meant to be public — RLS is the
     real access control — but it's kept out of the repo for cleanliness)
3. Push to `main` — `.github/workflows/deploy.yml` builds `web/` and publishes
   `web/dist` to Pages automatically.

### 4. WhatsApp sync (`sync/`)
Runs locally on Pranjal's Mac — reuses the already-authenticated `wacli` store.
```bash
cd sync
cp .env.example .env   # fill in SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API) — never commit this
npm install
npm run sync            # one-off run; discovers all "PwP*" groups automatically
```
For ongoing sync every 30 minutes, install the launchd job:
```bash
cp com.pranjal.pwpsync.plist.example ~/Library/LaunchAgents/com.pranjal.pwpsync.plist
# edit WorkingDirectory in that file to this repo's absolute sync/ path
launchctl load ~/Library/LaunchAgents/com.pranjal.pwpsync.plist
```

## Repo layout
```
web/        React + Vite + Mantine SPA (the deployed app)
supabase/   SQL schema (migrations) + seed data
sync/       Local WhatsApp -> Supabase sync script, run via launchd
.github/    Actions workflow that builds web/ and deploys to Pages
```

## Notifications (outbox)

The app can email one of you when the other finishes something. The Supabase half is built; the AWS half
([core-services](https://github.com/pranjalg8/core-services) pub/sub) is not connected yet.

- `notification_outbox` (migration `0016`) is a queue. A trigger on `swipes` queues one event for your partner the
  first time you answer every card in a deck; `enqueue_weekly_nudges()` (scheduled with pg_cron every Monday
  04:00 UTC, migration `0017`) queues a reminder if you have not finished a deck your partner started.
- **Privacy:** an event is only queued for a person who can see that deck, so a hidden destination never shows up in
  someone else's email.
- `supabase/functions/send-notifications` reads pending rows and publishes them to core-services. It is **service
  role only** and is a **dry run** (reports what it would send, changes nothing) until configured with
  `CORE_PUBSUB_URL` and a sign-in (see the header of `index.ts`).
- Still needed on the AWS side: a tenant and service user, one pub/sub topic per person (`notify-pranjal`,
  `notify-paridhi`) with each person's email subscribed and confirmed, and a way for a server to sign in (the
  Cognito app client only allows SRP today).

## Data model
- `topics` — fixed planning areas (jewellery, outfits, decor, ...).
- `planning_items` — the actual plan: decisions, todos, vendors, budget lines.
- `messages` — raw synced WhatsApp messages, shown per-topic for traceability
  back to the source conversation.
- `audit_log` — every change, `actor_type` of `manual` or `sync`.
- `app_secrets` / `verify_pin()` — the admin PIN, hashed, checked server-side
  only (never shipped to the browser).
