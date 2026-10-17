-- Which place each household sleeps at. One row per household per place with the number of rooms there
-- (half rooms are allowed for a shared room). A household whose rooms are split across two places has two rows.
-- It holds ids and numbers only, never names; readable and writable only by the two allowed signed-in profiles.
-- The same rows cover every night the household is there: people who come on day 1 stay over and keep their
-- rooms, so a household is placed once, not per night.
create table guest_stays (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  site_id uuid not null references stay_sites (id) on delete cascade,
  rooms numeric(4, 1) not null check (rooms > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, site_id)
);

create index guest_stays_site_idx on guest_stays (site_id);

alter table guest_stays enable row level security;

create policy "guest_stays: allowed profiles can read" on guest_stays
  for select to authenticated using (is_allowed_user());
create policy "guest_stays: allowed profiles can write" on guest_stays
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger guest_stays_set_updated_at before update on guest_stays
  for each row execute function set_updated_at();
create trigger guest_stays_audit after insert or update or delete on guest_stays
  for each row execute function audit_row_change();

alter publication supabase_realtime add table guest_stays;

-- A household that cannot manage stairs: the plan keeps it at places with a lift.
alter table guests add column needs_lift boolean not null default false;
