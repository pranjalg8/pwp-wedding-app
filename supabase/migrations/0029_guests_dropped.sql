-- Side list of households that were on the earlier guest list (19 May 2024) but not on the finalised lists
-- (29 Mar 2026), kept so they can be reconsidered. It holds names of private individuals, so it is readable and
-- writable only by the two allowed signed-in profiles, and every change is audited. The rows are imported by a
-- local script, so no names live in git.
create table guests_dropped (
  id uuid primary key default gen_random_uuid(),
  side text not null default 'groom' check (side in ('groom', 'bride')),
  from_list text not null check (from_list in ('family', 'friends')),
  relation text,
  name text not null,
  family_members text,
  persons int not null default 1 check (persons >= 0),
  location text,
  priority smallint check (priority in (1, 2)), -- as it was on the earlier list
  functions text,
  reconsider boolean not null default false,    -- marked as worth another look
  note text,
  extra jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guests_dropped_idx on guests_dropped (side, sort_order);

alter table guests_dropped enable row level security;

create policy "guests_dropped: allowed profiles can read" on guests_dropped
  for select to authenticated using (is_allowed_user());
create policy "guests_dropped: allowed profiles can write" on guests_dropped
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger guests_dropped_set_updated_at before update on guests_dropped
  for each row execute function set_updated_at();
create trigger guests_dropped_audit after insert or update or delete on guests_dropped
  for each row execute function audit_row_change();

-- Bringing a household back onto the guest list is done by the app (insert into guests, then delete from this
-- table), because both tables are already writable by the two profiles.
