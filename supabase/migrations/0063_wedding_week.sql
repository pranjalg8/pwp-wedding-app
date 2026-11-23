-- Wedding-week tools. guest_checkins: which households have arrived at which day (one row per household per day,
-- people = how many of them walked in). invite_settings.photo_album_url: the one shared album the photos QR points at.
create table guest_checkins (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  event_date date not null,
  people int not null default 0 check (people >= 0),
  checked_by uuid references profiles (id),
  checked_at timestamptz not null default now(),
  unique (guest_id, event_date)
);
create index guest_checkins_date_idx on guest_checkins (event_date);

alter table guest_checkins enable row level security;
create policy "guest_checkins: allowed profiles can read" on guest_checkins
  for select to authenticated using (is_allowed_user());
create policy "guest_checkins: allowed profiles can write" on guest_checkins
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create trigger guest_checkins_audit after insert or update or delete on guest_checkins
  for each row execute function audit_row_change();
alter publication supabase_realtime add table guest_checkins;

alter table invite_settings add column photo_album_url text
  check (photo_album_url is null or photo_album_url ~ '^https://[^\s]+$');
