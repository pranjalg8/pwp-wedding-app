# Invite tracker (Guests, Invites)

Built on Phase 2 of `plan-assistant-and-invites.md` (send links and the `invite_sends` log). Migration `0065_invite_tracker.sql`.

## What it does

- **Who handles a household:** `guests.handled_by` is `pranjal`, `papa` or `puru`. It is plain text, not a link to `profiles`, so it works before Papa and Puru have accounts. New households get a default from their group (the database trigger `guests_default_owner` and `defaultOwner()` in `web/src/lib/invites.ts` use the same rule):
  - Friends-Anjul: Pranjal
  - Friends-Puru: Puru
  - everything else (Hamara Pariwar-*, Relatives, Friends-DCG, Friends-Sushma, Pandit Ji): Papa

  Reassign one from the badge on its card (edit mode) or in Edit household.
- **The send log:** `invite_sends` has one row per invite, reminder or save-the-date: `guest_id`, `kind`, `channel` (`whatsapp|call|in_person|card|other`), `sent_by` (the person), `sent_by_uid` (the sign-in that recorded it, stamped by the database from `auth.uid()`, never taken from the client), `sent_at` and an optional `note`. RLS is `is_allowed_user()` and every change is in the audit log. The 18 save-the-dates already in `guests.extra.save_the_date` were copied in as Pranjal's sends (the `extra` field was left as it was).
- **Sending:** "Send on WhatsApp" shows the message (English or Hindi, editable), then opens `wa.me` with it filled in. **Nothing is sent automatically:** the person presses send in WhatsApp. Opening WhatsApp records the send, with Undo straight after in case it was not sent. With no saved number, WhatsApp asks whom to send it to. If the household has no personal link yet, "Make link" creates its `invite_codes` row.
- **Mark sent:** for calls, visits, printed cards and anything else, with a date (defaults to today) and a note.
- **Status:** not sent, sent (date, by whom, how), replied (everyone has an answer in the guest list, or a reply came in from the invite site, even one still waiting for review), and reminder due (7 days after the last invite or reminder without a reply).
- **Counters per person:** households, sent, replied, reminders due, and people per day (yes and maybe of those invited).
- **"I am":** who is sending on this phone. It starts as the signed-in person when their display name is Pranjal, Papa (or Dinesh) or Puru, and is remembered on the device. Paridhi, or anyone sending for someone else, picks it.
- Sending and Mark sent work without the edit PIN, like wedding-week check-in (the log is append-only and audited). Setting answers, reassigning a household and removing a logged send need edit mode, like the rest of Guests.

## Adding Papa and Puru

Nobody creates these accounts but you. No passwords are involved: the app signs in with a one-time email link. Do step 0 first, because **as soon as someone has a row in `profiles`, the database lets them read and change everything**, the budget included.

0. **Decide their access** (see the proposal below) and apply it first if you want it limited.
1. **Create the sign-in.** In the Supabase dashboard: Authentication, Users, **Invite user**, and enter their email. Supabase emails them a link. (Or they can type their email on the app's sign-in page and press "Send magic link"; that creates the sign-in too.)
2. **Let them in.** After the sign-in exists, add their profile in the Supabase SQL editor (replace the email):

   ```sql
   insert into profiles (id, email, display_name)
   select id, email, 'Papa' from auth.users where email = 'papa@example.com';
   ```

   Use the display name **Papa** for Papa and **Puru** for Puru: the Invites screen opens on "Mine" by that name, and the activity log shows it.
3. **First sign-in.** On their phone, open the planner, enter the email, tap the link in the email. Add the planner to the home screen. Show them Guests, Invites, and set "I am" once.
4. **Check.** In Activity, their first send should show their name.

To remove someone later: delete their `profiles` row (they lose access at once), then the user in Authentication.

## Proposed access rule for Papa and Puru (not applied)

Today every policy uses `is_allowed_user()`, which only asks "has a profile". Papa and Puru need guests, RSVPs, invite codes, replies, sends and contacts, and do not need the budget, payments, documents, honeymoon or the feed.

Proposal:

1. Add `profiles.role text not null default 'couple' check (role in ('couple', 'family'))`. Pranjal and Paridhi stay `couple`; Papa and Puru are `family`.
2. Add `is_couple()` (has a profile with role `couple`). Switch the policies on money and private tables to it: `budget_areas`, `budget_settings`, `payments`, `payment_schedule`, `vendors`, `documents` and its storage bucket, `suggestions`, `trip_alternatives`, `messages`, `planning_items`, `tasks`, `task_options`, `topics`, `kb_entries`, `share_links`, `swipe_*`, `wishlist_*` (admin side), `notification_outbox`, `feature_access` and `audit_log` (the log holds budget changes too). `feed_*` already belongs to its owner only.
3. Keep `is_allowed_user()` (any profile) on what the guest work needs: `guests`, `guest_rsvps`, `guest_contacts`, `invite_codes`, `invite_responses`, `invite_sends`, `guest_checkins`, `invite_settings` (read), `wedding_functions` (read), `stay_sites`, `stay_nights`, `stay_rooms`, `room_stays`, `meals` (read), `profiles` (read).
4. In the app, a `family` profile gets a short menu: Home, Guests (Invites first), Functions, What's new. Budget and the rest are hidden, and the database refuses them anyway.

`feature_access` alone is not enough: it only hides pages in the app; the database would still let them read the budget. The role column makes the database enforce it.

This is a policy change across about 25 tables, so it should be its own migration and PR, tested by signing in as a `family` test profile before Papa's account is added.
