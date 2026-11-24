# Invite tracker (Guests, Invites)

Built on Phase 2 of `plan-assistant-and-invites.md` (send links and the `invite_sends` log). Migration `0065_invite_tracker.sql`.

## What it does

- **Who handles a household:** `guests.handled_by` is `pranjal`, `papa` or `puru`. It is plain text, not a link to `profiles`, so it works before Papa and Puru have accounts. New households get a default from their group (the database trigger `guests_default_owner` and `defaultOwner()` in `web/src/lib/invites.ts` use the same rule):
  - Friends-Anjul: Pranjal
  - Friends-Puru: Puru
  - everything else (Hamara Pariwar-*, Relatives, Friends-DCG, Friends-Sushma, Pandit Ji): Papa

  Reassign one from the badge on its card (edit mode) or in Edit household.
- **The send log:** `invite_sends` has one row per invite, reminder or save-the-date: `guest_id`, `kind`, `channel` (`whatsapp|call|in_person|card|other`), `sent_by` (the person), `sent_by_uid` (the sign-in that recorded it, stamped by the database from `auth.uid()` when the send is recorded (migration 0067: insert only), never taken from the client), `sent_at` and an optional `note`. RLS is `is_allowed_user()` and every change is in the audit log. The 18 save-the-dates already in `guests.extra.save_the_date` were copied in as Pranjal's sends (the `extra` field was left as it was).
- **Message wording is not approved yet.** The English and Hindi invite and reminder texts in `web/src/lib/invites.ts` are our own wording, not Papa's. The send screen shows a warning until `MESSAGE_APPROVED` is set to `true` after Papa approves them (or the text is changed to his).
- **Sending:** "Send on WhatsApp" shows the message (English or Hindi, editable), then opens `wa.me` with it filled in. **Nothing is sent automatically:** the person presses send in WhatsApp. Opening WhatsApp records the send, with Undo straight after in case it was not sent. With no saved number, WhatsApp asks whom to send it to. If the household has no personal link yet, "Make link" creates its `invite_codes` row.
- **Mark sent:** for calls, visits, printed cards and anything else, with a date (defaults to today) and a note.
- **Status:** not sent, sent (date, by whom, how), replied (everyone has an answer in the guest list, or a reply came in from the invite site, even one still waiting for review), and reminder due (7 days after the last invite or reminder without a reply).
- **Counters per person:** households, sent, replied, reminders due, and people per day (yes and maybe of those invited).
- **"I am":** who is sending on this phone. It starts as the signed-in person when their display name is Pranjal, Papa (or Dinesh) or Puru, and is remembered on the device. Paridhi, or anyone sending for someone else, picks it.
- Sending and Mark sent work without the edit PIN, like wedding-week check-in (the log is append-only and audited). Setting answers, reassigning a household and removing a logged send need edit mode, like the rest of Guests.

## Adding Papa and Puru

Nobody creates these accounts but you. No passwords are involved: the app signs in with a one-time email link.

Their access is limited by the database (migration `0066_family_access.sql`): a profile with role `family` can read and change guests, RSVPs, contacts, personal links, invite replies, the send log and check-in, and read the functions and invite settings. It sees nothing else: no budget, payments, tasks, documents, knowledge base, honeymoon, feed or audit log, and it gets none of the couple's reminder emails. The app shows family accounts only Guests, opening on Invites.

1. **Create the sign-in.** In the Supabase dashboard: Authentication, Users, **Invite user**, and enter their email. Supabase emails them a link. (Or they type their email on the planner's sign-in page and press "Send magic link"; that creates the sign-in too.) Until step 2 they see "Your account isn't on the allowed list yet".
2. **Let them in as family.** In the Supabase SQL editor (replace the email; use `'Puru'` for Puru):

   ```sql
   insert into profiles (id, email, display_name, role)
   select id, email, 'Papa', 'family' from auth.users where email = 'papa@example.com';
   ```

   **Always include `'family'`.** Without it the role defaults to `couple`, which is full access. The display name **Papa** or **Puru** makes the Invites screen open on their own households and shows their name in the activity log.
3. **First sign-in.** On their phone, open the planner, enter the email and tap the link in the email. Add the planner to the home screen. Show them Guests, Invites. "I am" is already set from their name.
4. **Check.** Their first send shows their name in the household's history and in Activity.

To change someone's access: `update profiles set role = 'couple' where display_name = 'Puru';` (or back to `'family'`). To remove someone: delete their `profiles` row (they lose access at once), then delete the user in Authentication.

## How access works

- `is_allowed_user()` now means "a couple profile". Every older rule already calls it, so anything not listed above stays the couple's, and **a new table is couple-only unless its rules use `is_guest_helper()`**.
- `is_guest_helper()` means any profile, couple or family. Only the guest and invite tables use it.
- The edit PIN still works for family accounts (it checks for a profile). Give Papa the PIN only if he should set answers and reassign households himself; sending and Mark sent work without it.
