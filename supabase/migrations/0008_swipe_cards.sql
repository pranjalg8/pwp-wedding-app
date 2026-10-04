-- Swipe cards: a lightweight "yes / no" preference game for the two of us.
-- Decks hold cards; each person records one swipe per card (changeable), and both
-- people can see each other's swipes so matches show up. Cards are managed by the
-- service role / migrations (read-only from the app); swipes are written by the app.

create table swipe_decks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  sort_order int not null default 0
);

create table swipe_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references swipe_decks (id) on delete cascade,
  title text not null,
  subtitle text,
  detail text,
  emoji text,
  category text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index swipe_cards_deck_idx on swipe_cards (deck_id, sort_order);

create table swipes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references swipe_cards (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  choice text not null check (choice in ('yes', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, profile_id)
);

create index swipes_profile_idx on swipes (profile_id);

alter table swipe_decks enable row level security;
alter table swipe_cards enable row level security;
alter table swipes enable row level security;

create policy "swipe_decks: allowed profiles can read" on swipe_decks
  for select using (auth.uid() in (select id from profiles));

create policy "swipe_cards: allowed profiles can read" on swipe_cards
  for select using (auth.uid() in (select id from profiles));

-- Both people can see all swipes (needed to show matches) ...
create policy "swipes: allowed profiles can read" on swipes
  for select using (auth.uid() in (select id from profiles));

-- ... but each person can only write their own.
create policy "swipes: write own" on swipes
  for insert with check (profile_id = auth.uid() and auth.uid() in (select id from profiles));

create policy "swipes: update own" on swipes
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "swipes: delete own" on swipes
  for delete using (profile_id = auth.uid());

create trigger swipes_set_updated_at
  before update on swipes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: Honeymoon (Koh Samui, 20-25 Feb 2027)
-- ---------------------------------------------------------------------------
insert into swipe_decks (key, label, description, sort_order) values
  ('honeymoon-samui', 'Honeymoon: Koh Samui', 'What do we each want out of 20-25 Feb 2027? Swipe right for yes, left for no.', 10);

insert into swipe_cards (deck_id, title, subtitle, detail, emoji, category, sort_order)
select d.id, c.title, c.subtitle, c.detail, c.emoji, c.category, c.sort_order
from swipe_decks d,
(values
  -- Stay
  ('Private pool villa', 'Our own pool, no sharing', 'Wake up, swim, repeat. About Rs 12-20k a night.', '🏊', 'Stay', 1),
  ('Beachfront stay', 'Step from the villa onto the sand', 'Choeng Mon or Bophut bay: calm water, sunrise side.', '🏖️', 'Stay', 2),
  ('Hillside sunset villa', 'Secluded west coast, big views', 'Taling Ngam or Lipa Noi. Quietest, best sunsets, needs a driver.', '🌇', 'Stay', 3),
  ('Adult-only resort', 'Quiet, romantic, no kids', 'e.g. SAii Koh Samui Villas style. About Rs 17k a night.', '💑', 'Stay', 4),
  ('Luxury splurge', 'One really special place', 'Silavadee-type resort, about Rs 32k a night. Total trip near Rs 3.5-4L.', '✨', 'Stay', 5),
  ('Keep the stay modest', 'Spend on experiences instead', 'Good 4-5 star villa around Rs 8-10k a night.', '💸', 'Stay', 6),
  ('Stay put all 5 nights', 'One base, unpack once', 'No moving between hotels.', '🧳', 'Stay', 7),
  -- Relax and romance
  ('Couples spa', 'Massage side by side', 'About Rs 2.5-8k each depending on the treatment.', '💆', 'Relax and romance', 8),
  ('Private candlelit beach dinner', 'Table for two on the sand', 'Most resorts arrange it. Seafood, sea sounds, lanterns.', '🕯️', 'Relax and romance', 9),
  ('Sunrise at Choeng Mon', 'Early, quiet, golden', 'East coast faces the sunrise.', '🌅', 'Relax and romance', 10),
  ('Sunset catamaran cruise', 'Drinks on the water at dusk', 'Easy to book through the resort.', '⛵', 'Relax and romance', 11),
  ('A full do-nothing day', 'Pool, book, nap, repeat', 'No plan, no alarm.', '🛋️', 'Relax and romance', 12),
  ('Photo shoot at golden hour', 'Couple portraits on the beach', 'Local photographers do 1-2 hour sessions.', '📸', 'Relax and romance', 13),
  -- Explore
  ('Ang Thong Marine Park day trip', 'Limestone islands and a lookout', 'Speedboat day trip, views only (no kayaking). About Rs 4-7k each.', '🏝️', 'Explore', 14),
  ('Big Buddha and Wat Plai Laem', 'Golden Buddha, colourful temple', 'Quick, photogenic, nothing strenuous.', '🛕', 'Explore', 15),
  ('Secret Buddha Garden', 'A jungle sculpture park', 'Art, stone figures, great photos.', '🗿', 'Explore', 16),
  ('Sketch or paint together', 'Paints and a view, no phone', 'Bring sketchbooks, or find a watercolour session.', '🎨', 'Explore', 17),
  ('Hire a driver for a day', 'See the island at our own pace', 'About Rs 7-9k for the day.', '🚗', 'Explore', 18),
  ('Waterfalls', 'Na Muang falls', 'Lower flow in dry season, easy visit.', '💦', 'Explore', 19),
  ('Ethical elephant sanctuary', 'Watch and feed, no rides', 'Viewing-only visit.', '🐘', 'Explore', 20),
  -- Food and markets
  ('Seafood grills on the beach', 'Fresh prawns, fish, crab', 'Bophut and Bang Po beachfronts.', '🦐', 'Food and markets', 21),
  ('Thai cooking class', 'Cook a full meal together', 'Veg and non-veg. Samui has several schools.', '🍳', 'Food and markets', 22),
  ('Night markets', 'Chaweng night market, Fisherman''s Village', 'Street food, souvenirs, strolling.', '🏮', 'Food and markets', 23),
  ('One fancy tasting dinner', 'A proper dress-up meal', 'Pick one special restaurant.', '🍽️', 'Food and markets', 24),
  ('Cafe hopping', 'Coffee, desserts, mango sticky rice', 'Slow afternoons.', '☕', 'Food and markets', 25),
  ('Indian veg dinner one night', 'Comfort food break', 'Plenty of Indian restaurants in Chaweng.', '🍛', 'Food and markets', 26),
  -- Logistics
  ('Bangkok night on the way', 'Cheaper flights, 6 AM start', 'Delhi to Bangkok evening, early flight to Samui. Saves about Rs 11-16k net.', '🌙', 'Flights', 27),
  ('Same-day to Samui', 'Arrive 7:50 PM, no stopover', 'About Rs 1.27L flights. More time on the island.', '🛫', 'Flights', 28),
  ('Protected single ticket', 'Safer if a flight runs late', 'About Rs 1.72L flights.', '🛡️', 'Flights', 29),
  ('One Bangkok day at the end', 'Chatuchak, art, street food', 'Instead of a fifth Samui night.', '🏙️', 'Flights', 30)
) as c(title, subtitle, detail, emoji, category, sort_order)
where d.key = 'honeymoon-samui';
