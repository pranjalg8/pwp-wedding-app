-- Family accounts: Papa and Puru can sign in to send invites and record replies, and see nothing else.
--
--   profiles.role      'couple' (Pranjal, Paridhi: everything) or 'family' (guests and invites only).
--   is_allowed_user()  now means "a couple profile". Every existing rule already calls it, so the budget, payments,
--                      tasks, documents, the knowledge base, the audit log and everything else stay the couple's,
--                      and any table added later is couple-only unless it opts in.
--   is_guest_helper()  any profile, couple or family. Only the guest and invite tables below use it.
--
-- Reminder and nudge jobs that went to "everyone in profiles" now go to the couple only.

alter table profiles add column role text not null default 'couple' check (role in ('couple', 'family'));

create or replace function is_allowed_user()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'couple');
$$;

create or replace function is_guest_helper()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

-- What a family account needs for Guests, Invites: the households, their answers and numbers, personal links,
-- replies from the invite site, the send log, check-in, and read-only functions and invite settings.
alter policy "guests: allowed profiles can read" on guests using ((select is_guest_helper()));
alter policy "guests: allowed profiles can write" on guests using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "guest_rsvps: allowed profiles can read" on guest_rsvps using ((select is_guest_helper()));
alter policy "guest_rsvps: allowed profiles can write" on guest_rsvps using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "guest_contacts: allowed profiles can read" on guest_contacts using ((select is_guest_helper()));
alter policy "guest_contacts: allowed profiles can write" on guest_contacts using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "guest_checkins: allowed profiles can read" on guest_checkins using ((select is_guest_helper()));
alter policy "guest_checkins: allowed profiles can write" on guest_checkins using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "invite_codes: allowed profiles can read" on invite_codes using ((select is_guest_helper()));
alter policy "invite_codes: allowed profiles can write" on invite_codes using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "invite_responses: allowed profiles can read" on invite_responses using ((select is_guest_helper()));
alter policy "invite_responses: allowed profiles can review" on invite_responses using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "invite_sends: allowed profiles can read" on invite_sends using ((select is_guest_helper()));
alter policy "invite_sends: allowed profiles can write" on invite_sends using ((select is_guest_helper())) with check ((select is_guest_helper()));
alter policy "invite_settings: allowed profiles can read" on invite_settings using ((select is_guest_helper()));
alter policy "wedding_functions: allowed profiles can read" on wedding_functions using ((select is_guest_helper()));

-- Jobs that pick recipients from profiles: couple only. Each function is patched in place from its live definition;
-- the migration fails if a definition has changed and the text is no longer found.
do $$
declare
  fixes text[][] := array[
    ['enqueue_deck_completed', 'from profiles where id <> new.profile_id limit 1', 'from profiles where id <> new.profile_id and role = ''couple'' limit 1'],
    ['enqueue_weekly_nudges', 'from profiles pp where pp.id <> p.id limit 1', 'from profiles pp where pp.id <> p.id and pp.role = ''couple'' limit 1'],
    ['enqueue_weekly_nudges', 'where profile_can_see_deck(p.id, d.id)', 'where p.role = ''couple'' and profile_can_see_deck(p.id, d.id)'],
    ['enqueue_due_reminders', 'join profiles p on (', 'join profiles p on p.role = ''couple'' and ('],
    ['enqueue_payment_reminders', 'where ps.status = ''pending''', 'where p.role = ''couple'' and ps.status = ''pending''']
  ];
  i int;
  def text;
  patched text;
begin
  for i in 1 .. array_length(fixes, 1) loop
    select pg_get_functiondef(('public.' || fixes[i][1])::regproc) into def;
    patched := replace(def, fixes[i][2], fixes[i][3]);
    if patched = def then
      raise exception 'family access: % no longer contains "%"', fixes[i][1], fixes[i][2];
    end if;
    execute patched;
  end loop;
end $$;
