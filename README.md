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

## Data model
- `topics` — fixed planning areas (jewellery, outfits, decor, ...).
- `planning_items` — the actual plan: decisions, todos, vendors, budget lines.
- `messages` — raw synced WhatsApp messages, shown per-topic for traceability
  back to the source conversation.
- `audit_log` — every change, `actor_type` of `manual` or `sync`.
- `app_secrets` / `verify_pin()` — the admin PIN, hashed, checked server-side
  only (never shipped to the browser).
