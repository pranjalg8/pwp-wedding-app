-- RSVP is by day, not by function: a household coming on a day is at every function that day, and the function
-- cards read the answer of their day. One row per household per day; the three counts work as in 0028
-- (yes, maybe, no, never more than the household; whoever is left has not replied).
--
-- guest_invites (per function) is replaced by guest_rsvps. Existing rows are carried over: a household invited to
-- any function on a day becomes invited for that day, keeping the highest count seen on that day. guest_invites is
-- no longer read or written by the app and is safe to drop later.
create table guest_rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  event_date date not null,
  coming int not null default 0 check (coming >= 0),
  maybe int not null default 0 check (maybe >= 0),
  declined int not null default 0 check (declined >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, event_date)
);

create index guest_rsvps_date_idx on guest_rsvps (event_date);

alter table guest_rsvps enable row level security;

create policy "guest_rsvps: allowed profiles can read" on guest_rsvps
  for select to authenticated using (is_allowed_user());
create policy "guest_rsvps: allowed profiles can write" on guest_rsvps
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger guest_rsvps_set_updated_at before update on guest_rsvps
  for each row execute function set_updated_at();
create trigger guest_rsvps_check_counts before insert or update on guest_rsvps
  for each row execute function check_guest_invite_counts();
create trigger guest_rsvps_audit after insert or update or delete on guest_rsvps
  for each row execute function audit_row_change();

alter publication supabase_realtime add table guest_rsvps;

insert into guest_rsvps (guest_id, event_date, coming, maybe, declined)
select i.guest_id, f.event_date, max(i.coming), max(i.maybe), max(i.declined)
from guest_invites i
join wedding_functions f on f.id = i.function_id
group by i.guest_id, f.event_date;
