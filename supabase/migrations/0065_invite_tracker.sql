-- Invite tracker: who handles each household (Pranjal, Papa or Puru), and a log of every invite sent.
--
--   guests.handled_by  'pranjal' | 'papa' | 'puru'. A plain text value, not a reference to profiles, because Papa and
--                      Puru do not sign in yet. New households get a default from their list group (Friends-Anjul is
--                      Pranjal's, Friends-Puru is Puru's, everything else is Papa's); anyone can reassign one.
--   invite_sends       one row per invite, reminder or save-the-date sent, by whom, how and when. Append-mostly:
--                      a row can be removed (undo a mis-tap), and everything is in the audit log.
--
-- Nothing here sends anything. WhatsApp is opened with the message filled in; a person presses send.

alter table guests add column handled_by text check (handled_by in ('pranjal', 'papa', 'puru'));

create or replace function default_household_owner(list_group text) returns text
language sql immutable set search_path = '' as $$
  select case
    when list_group = 'Friends-Anjul' then 'pranjal'
    when list_group = 'Friends-Puru' then 'puru'
    else 'papa'
  end;
$$;

update guests set handled_by = default_household_owner(list_group) where handled_by is null;
alter table guests alter column handled_by set not null;

create or replace function guests_default_owner() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.handled_by is null then
    new.handled_by := default_household_owner(new.list_group);
  end if;
  return new;
end $$;

create trigger guests_default_owner before insert on guests
  for each row execute function guests_default_owner();

create index guests_handled_by_idx on guests (handled_by);

create table invite_sends (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  kind text not null check (kind in ('save_the_date', 'invite', 'reminder')),
  channel text not null check (channel in ('whatsapp', 'call', 'in_person', 'card', 'other')),
  sent_by text not null check (sent_by in ('pranjal', 'papa', 'puru')), -- the person who sent it
  sent_by_uid uuid references profiles (id),                           -- whose sign-in recorded it, if any
  sent_at timestamptz not null default now(),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index invite_sends_guest_idx on invite_sends (guest_id, sent_at desc);

-- The recording sign-in is whoever is signed in, never what the client says.
create or replace function invite_sends_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.sent_by_uid := coalesce(auth.uid(), new.sent_by_uid);
  return new;
end $$;

create trigger invite_sends_stamp before insert or update on invite_sends
  for each row execute function invite_sends_stamp();

alter table invite_sends enable row level security;
create policy "invite_sends: allowed profiles can read" on invite_sends
  for select to authenticated using (is_allowed_user());
create policy "invite_sends: allowed profiles can write" on invite_sends
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create trigger invite_sends_audit after insert or update or delete on invite_sends
  for each row execute function audit_row_change();
alter publication supabase_realtime add table invite_sends;

-- Save-the-dates already sent, recorded on the guest as extra.save_the_date = { sent: 'YYYY-MM-DD', via, note? }.
-- Pranjal sent all of them (Friends-Anjul). Noon India time on the day, since only the date is known.
insert into invite_sends (guest_id, kind, channel, sent_by, sent_at, note)
select g.id,
       'save_the_date',
       case when g.extra -> 'save_the_date' ->> 'via' in ('whatsapp', 'call', 'in_person', 'card') then g.extra -> 'save_the_date' ->> 'via' else 'other' end,
       'pranjal',
       ((g.extra -> 'save_the_date' ->> 'sent')::date + time '12:00') at time zone 'Asia/Kolkata',
       g.extra -> 'save_the_date' ->> 'note'
from guests g
where g.extra -> 'save_the_date' ->> 'sent' ~ '^\d{4}-\d{2}-\d{2}$';
