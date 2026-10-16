-- Where guests can stay and how many rooms each place has on each night. Nothing personal: these are the hotels.
-- A night is the date guests sleep over; everyone checks out on 16 Feb 2027.
--
-- role 'main' is the main stay (the guests' "rooms inside" column); 'other' places are the "rooms outside".
create table stay_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('main', 'other')),
  sort_order int not null default 0,
  has_lift boolean not null,
  floors text,                       -- how the rooms are spread
  people_per_room text,              -- e.g. "3-4"
  distance_note text,                -- commute to the main venue
  booking_note text,                 -- booked, or just available
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stay_nights (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references stay_sites (id) on delete cascade,
  night date not null,
  rooms int not null check (rooms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, night)
);

alter table stay_sites enable row level security;
alter table stay_nights enable row level security;

create policy "stay_sites: allowed profiles can read" on stay_sites
  for select to authenticated using (is_allowed_user());
create policy "stay_sites: allowed profiles can write" on stay_sites
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create policy "stay_nights: allowed profiles can read" on stay_nights
  for select to authenticated using (is_allowed_user());
create policy "stay_nights: allowed profiles can write" on stay_nights
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger stay_sites_set_updated_at before update on stay_sites
  for each row execute function set_updated_at();
create trigger stay_nights_set_updated_at before update on stay_nights
  for each row execute function set_updated_at();
create trigger stay_sites_audit after insert or update or delete on stay_sites
  for each row execute function audit_row_change();
create trigger stay_nights_audit after insert or update or delete on stay_nights
  for each row execute function audit_row_change();

alter publication supabase_realtime add table stay_sites, stay_nights;

-- As given on 16 Oct 2026.
insert into stay_sites (name, role, sort_order, has_lift, floors, people_per_room, distance_note, booking_note, notes) values
  ('Royal Pepper', 'main', 10, true, null, '3-4, a few rooms 4-6', 'Main wedding venue', 'Booked for 14 and 15 Feb, checkout 16 Feb',
   '34 rooms on day 1; a new block adds 16 rooms on day 2, so 50 on day 2.'),
  ('Shri Kanth Hotel', 'other', 20, false, '6 rooms on floor 1, 12 rooms on floor 2', '4-5 (big rooms)', '1 km, 5 min to Royal Pepper',
   'Available 13, 14 and 15 Feb, checkout 16 Feb', 'No lift, so keep elderly guests away from it.'),
  ('Hotel Sai, Bawal', 'other', 30, true, '10 rooms on each floor, 30 in total', '2-3', '10 km, 11 min to Royal Pepper',
   'Available 14 and 15 Feb, checkout 16 Feb', '3 rooms on day 1; 18 rooms on day 2.');

insert into stay_nights (site_id, night, rooms)
select s.id, v.night::date, v.rooms
from (values
  ('Royal Pepper', '2027-02-14', 34), ('Royal Pepper', '2027-02-15', 50),
  ('Shri Kanth Hotel', '2027-02-13', 18), ('Shri Kanth Hotel', '2027-02-14', 18), ('Shri Kanth Hotel', '2027-02-15', 18),
  ('Hotel Sai, Bawal', '2027-02-14', 3), ('Hotel Sai, Bawal', '2027-02-15', 18)
) as v(site, night, rooms)
join stay_sites s on s.name = v.site;
