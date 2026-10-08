-- The ceremonies, one row each, with day, half of the day, theme and colours. Seeded from Pranjal's schedule
-- (8 Oct 2026): 14 Feb first half Tilak and Mehndi, second half Sagai and Sangeet; 15 Feb first half Haldi,
-- second half Baraat, Varmala and Mandap shaadi (to midnight). dates.haldi was moved to 15 Feb to match.
create table wedding_functions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  event_date date not null,
  slot text not null check (slot in ('first_half', 'second_half')),
  sort_order int not null,
  theme text,
  colours text[] not null default '{}',
  avoid_colours text[] not null default '{}',
  notes text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'decided')),
  updated_at timestamptz not null default now()
);
alter table wedding_functions enable row level security;
create policy "wedding_functions: allowed profiles can read" on wedding_functions for select
  using (auth.uid() in (select id from profiles));
create policy "wedding_functions: allowed profiles can write" on wedding_functions for all
  using (auth.uid() in (select id from profiles))
  with check (auth.uid() in (select id from profiles));
-- six seed rows: tilak, mehndi, sagai, sangeet, haldi, shaadi
