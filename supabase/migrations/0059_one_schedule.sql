-- One schedule: function times and venues live in the planner, the invite site reads them from there, and the meals
-- for 12 to 16 February get their own table.
--
--   wedding_functions  gains a start and end time, a venue (one of the stay sites, or free text such as "the bride's
--                      home"), and the words guests see on the invite: a name, a short line, the dress code and the part of the
--                      day. A time only reaches the invite once show_time is switched on, so a time still being
--                      discussed never goes public by accident. Family-only functions never reach the invite.
--   stay_sites         gains a map search text and an exact map link, used for venues on the invite.
--   meals              one row per meal served: day, meal, where, for whom, people and rate per head. A row can point
--                      at the budget line it belongs to, so the planner can show when the two disagree.
--
-- Additive only. The six invite functions are seeded with the words the invite site shows today, so nothing visible
-- changes when the site switches to the planner. The meals are seeded from the three Shri Kanth meal lines.

alter table wedding_functions
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists show_time boolean not null default false,
  add column if not exists venue_site_id uuid references stay_sites (id) on delete set null,
  add column if not exists venue_text text check (venue_text is null or char_length(venue_text) <= 120),
  add column if not exists invite_name text check (invite_name is null or char_length(invite_name) <= 80),
  add column if not exists invite_part text check (invite_part is null or char_length(invite_part) <= 40),
  add column if not exists invite_blurb text check (invite_blurb is null or char_length(invite_blurb) <= 300),
  add column if not exists dress text check (dress is null or char_length(dress) <= 120);

alter table stay_sites
  add column if not exists maps_query text check (maps_query is null or char_length(maps_query) <= 160),
  add column if not exists maps_url text check (maps_url is null or maps_url ~ '^https://[^[:space:]]{1,500}$');

update stay_sites set maps_query = 'Royal Pepper Bawal Haryana' where name = 'Royal Pepper' and maps_query is null;
update stay_sites set maps_query = 'Shri Kanth Hotel Bawal Haryana' where name = 'Shri Kanth Hotel' and maps_query is null;
update stay_sites set maps_query = 'Hotel Sai Bawal Haryana' where name = 'Hotel Sai, Bawal' and maps_query is null;

-- The invite's current words, so the switch changes nothing guests see.
with v(key, iname, part, blurb, dress) as (values
  ('tilak', 'Tilak', 'Daytime', 'A traditional ceremony that begins the celebrations.', 'Festive Indian wear'),
  ('mehndi', 'Mehndi', 'Daytime', 'Henna and festivities with relatives and friends.', 'Festive Indian wear'),
  ('sagai', 'Sagai', 'Evening', 'The ring ceremony, with a few games between the two families.', 'Festive Indian wear'),
  ('sangeet', 'Sangeet', 'Evening', 'An evening of performances, music and dancing.', 'Glitz & Glamour: indo-western, bling'),
  ('haldi', 'Haldi', 'Daytime', 'The haldi ceremony, in yellow and marigold.', 'Yellow & marigold'),
  ('shaadi', 'Baraat, Varmala & Mandap', 'Evening to midnight', 'The baraat arrives, the garlands are exchanged and the wedding rituals take place.', 'Wear whatever you love')
)
update wedding_functions f
   set invite_name = coalesce(f.invite_name, v.iname),
       invite_part = coalesce(f.invite_part, v.part),
       invite_blurb = coalesce(f.invite_blurb, v.blurb),
       dress = coalesce(f.dress, v.dress),
       venue_site_id = coalesce(f.venue_site_id, (select id from stay_sites where name = 'Royal Pepper'))
  from v
 where f.key = v.key;

-- Tilak is at 9 am (7 Nov meeting). Kept off the invite until switched on.
update wedding_functions set start_time = '09:00' where key = 'tilak' and start_time is null;
update wedding_functions set venue_site_id = (select id from stay_sites where name = 'Shri Kanth Hotel')
 where key = 'mandap_cheekat' and venue_site_id is null;

create table meals (
  id uuid primary key default gen_random_uuid(),
  meal_date date not null check (meal_date between '2027-02-10' and '2027-02-18'),
  meal text not null check (meal in ('breakfast', 'lunch', 'hi_tea', 'dinner', 'late_night')),
  site_id uuid references stay_sites (id) on delete set null,
  place_text text check (place_text is null or char_length(place_text) <= 120),
  for_whom text not null default 'Everyone' check (char_length(for_whom) between 1 and 80),
  people int check (people is null or people between 0 and 2000),
  rate numeric check (rate is null or rate >= 0),
  menu text check (menu is null or char_length(menu) <= 500),
  notes text check (notes is null or char_length(notes) <= 500),
  schedule_id uuid references payment_schedule (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_date, meal, for_whom)
);
create index meals_schedule_idx on meals (schedule_id);

alter table meals enable row level security;
create policy "meals: allowed profiles can read" on meals
  for select to authenticated using (is_allowed_user());
create policy "meals: allowed profiles can write" on meals
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

-- From the Shri Kanth lines: 12 Feb dinner, 13 Feb three meals, 16 Feb breakfast and lunch, at the quoted rates.
insert into meals (meal_date, meal, site_id, for_whom, people, rate, schedule_id, notes)
select m.d::date, m.meal, s.id, 'Everyone', ps.quantity::int, m.rate, ps.id, 'From the budget line'
  from (values
    ('2027-02-12', 'dinner', 550, '12 Feb: dinner at Shri Kanth'),
    ('2027-02-13', 'breakfast', 400, '13 Feb: meals for everyone'),
    ('2027-02-13', 'lunch', 550, '13 Feb: meals for everyone'),
    ('2027-02-13', 'dinner', 550, '13 Feb: meals for everyone'),
    ('2027-02-16', 'breakfast', 400, '16 Feb: breakfast and lunch at Shri Kanth'),
    ('2027-02-16', 'lunch', 550, '16 Feb: breakfast and lunch at Shri Kanth')
  ) as m(d, meal, rate, payee)
  join payment_schedule ps on ps.payee = m.payee
  left join stay_sites s on s.name = 'Shri Kanth Hotel'
on conflict (meal_date, meal, for_whom) do nothing;

alter publication supabase_realtime add table meals;
