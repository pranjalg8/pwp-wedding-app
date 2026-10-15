-- Guest list: one row per invited household. Holds names of private individuals, so it is readable and
-- writable only by the two allowed signed-in profiles (never anon), and every change is audited.
-- The groom's finalised lists are imported by a local script, not by this migration, so no names live in git.
create table guests (
  id uuid primary key default gen_random_uuid(),
  side text not null default 'groom' check (side in ('groom', 'bride')),
  list_group text,                          -- e.g. a village or friend group
  relation text,
  name text not null,                       -- head of the household
  family_members text,
  persons int not null default 1 check (persons >= 0),
  rooms_inside numeric(5,1) not null default 0 check (rooms_inside >= 0),  -- rooms at the main stay
  rooms_outside numeric(5,1) not null default 0 check (rooms_outside >= 0), -- rooms elsewhere (0.5 = a shared room)
  location text,
  priority smallint check (priority in (1, 2)),
  functions text,                           -- as written in the list ("All", "2", blank = not set)
  extra jsonb not null default '{}',        -- other columns from the source sheet (destination scenarios)
  sort_order int not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guests_side_idx on guests (side, sort_order);

alter table guests enable row level security;

create policy "guests: allowed profiles can read" on guests
  for select to authenticated using (is_allowed_user());
create policy "guests: allowed profiles can write" on guests
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger guests_set_updated_at before update on guests
  for each row execute function set_updated_at();
create trigger guests_audit after insert or update or delete on guests
  for each row execute function audit_row_change();
