-- Room board: the actual rooms at each place and which households sleep in which room.
-- guest_stays keeps the planning numbers (how many rooms at which place); this adds the rooms themselves, so a
-- household can be put in a specific room and a hotel can be sent a rooming list.
-- Rooms hold no personal data. room_stays holds ids and a head count only, never names. Both tables are
-- readable and writable only by the two allowed signed-in profiles.

create table stay_rooms (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references stay_sites (id) on delete cascade,
  label text not null,                       -- what the hotel calls it, e.g. "214" or "R7"
  floor int,
  capacity int not null default 4 check (capacity > 0),   -- most people comfortably; a soft limit
  available_from date,                       -- the first night the room is available; null = all nights
  paid_by text check (paid_by in ('pranjal_family', 'paridhi', 'shared')),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, label)
);

create index stay_rooms_site_idx on stay_rooms (site_id);

-- One row per household per room. A household with two rooms has two rows; a room shared by two households has two
-- rows. people is how many of the household sleep there; null means the household's people split evenly across
-- its rooms.
create table room_stays (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references stay_rooms (id) on delete cascade,
  guest_id uuid not null references guests (id) on delete cascade,
  people int check (people > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, guest_id)
);

create index room_stays_guest_idx on room_stays (guest_id);

alter table stay_rooms enable row level security;
alter table room_stays enable row level security;

create policy "stay_rooms: allowed profiles can read" on stay_rooms
  for select to authenticated using (is_allowed_user());
create policy "stay_rooms: allowed profiles can write" on stay_rooms
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create policy "room_stays: allowed profiles can read" on room_stays
  for select to authenticated using (is_allowed_user());
create policy "room_stays: allowed profiles can write" on room_stays
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger stay_rooms_set_updated_at before update on stay_rooms
  for each row execute function set_updated_at();
create trigger room_stays_set_updated_at before update on room_stays
  for each row execute function set_updated_at();
create trigger stay_rooms_audit after insert or update or delete on stay_rooms
  for each row execute function audit_row_change();
create trigger room_stays_audit after insert or update or delete on room_stays
  for each row execute function audit_row_change();

alter publication supabase_realtime add table stay_rooms, room_stays;

-- Starting rooms, one per room each night has (stay_nights). The labels are placeholders to rename once the hotels
-- share their real room numbers.
--   Royal Pepper: 34 rooms from 14 Feb and 16 more from 15 Feb (paid by Pranjal's family).
--   Shri Kanth Hotel: 6 rooms on floor 1 and 12 on floor 2, from 13 Feb.
--   Hotel Sai, Bawal: 3 rooms from 14 Feb and 15 more from 15 Feb.
insert into stay_rooms (site_id, label, floor, capacity, available_from, paid_by, sort_order)
select s.id, 'R' || n, null, 4, case when n <= 34 then date '2027-02-14' else date '2027-02-15' end, 'pranjal_family', n
from stay_sites s, generate_series(1, 50) n
where s.name = 'Royal Pepper';

insert into stay_rooms (site_id, label, floor, capacity, available_from, sort_order)
select s.id, 'F' || f || '-' || n, f, 5, date '2027-02-13', f * 100 + n
from stay_sites s,
     (values (1, 6), (2, 12)) as fl (f, cnt),
     generate_series(1, 12) n
where s.name = 'Shri Kanth Hotel' and n <= cnt;

insert into stay_rooms (site_id, label, floor, capacity, available_from, sort_order)
select s.id, 'S' || n, null, 3, case when n <= 3 then date '2027-02-14' else date '2027-02-15' end, n
from stay_sites s, generate_series(1, 18) n
where s.name = 'Hotel Sai, Bawal';
