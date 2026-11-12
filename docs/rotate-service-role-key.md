# Rotating the Supabase service-role key

The service-role key skips every row level security rule. It was pasted into a chat on 8 Oct, and a session token
from 3 Oct was never revoked. This page is the runbook to replace both. Only Pranjal can do this: it happens in the
Supabase dashboard and in local files that hold secrets. Claude must never see, paste or store a key.

Expect about 15 minutes. Both of you will be signed out and need a new magic link.

## Where the key is used

| Place | Name | Who updates it |
| --- | --- | --- |
| `sync/.env` on Pranjal's Mac | `SUPABASE_SERVICE_ROLE_KEY` | you, by hand |
| Edge functions `share` and `send-notifications` | injected by Supabase as `SUPABASE_SERVICE_ROLE_KEY` | Supabase, automatically |
| `web/.env.local` and the GitHub secret `VITE_SUPABASE_ANON_KEY` | the anon (public) key | you, only if the anon key changes too |

## Option A (simplest): roll the legacy JWT secret

This replaces both the anon and the service-role keys and ends every session, which also kills the leaked 3 Oct token.

1. Supabase dashboard, the planner project, **Project Settings, JWT Keys** (older dashboards: **API, JWT Settings**).
   Generate a new JWT secret and confirm. The old anon and service-role keys stop working at once.
2. **Project Settings, API Keys**: copy the new `service_role` key into `sync/.env` (`SUPABASE_SERVICE_ROLE_KEY=`).
   Do not paste it anywhere else.
3. Copy the new `anon` key into `web/.env.local` and into the GitHub repo secret `VITE_SUPABASE_ANON_KEY`
   (Settings, Secrets and variables, Actions).
4. Redeploy the site: re-run the latest "Deploy" workflow on `main` (Actions tab, Re-run all jobs).
5. Edge functions pick up the new injected keys on their next start. To be sure, open a share link once and check it loads.
6. Run `npm run sync` in `sync/` once to confirm the sync still writes.
7. Both of you request a new magic link and sign in again.

## Option B: move to the new API keys

Supabase's newer `sb_publishable_…` and `sb_secret_…` keys can be created and revoked one at a time, so a future
leak needs only one key replaced. This needs a small code change (the edge functions would read a custom secret
instead of the injected one), so do it as its own PR, then disable the legacy keys.

## After rotating

- Tick off item 8 in the housekeeping backlog.
- When the invite RSVP function is built, give it its own secret key so it can be revoked alone.
