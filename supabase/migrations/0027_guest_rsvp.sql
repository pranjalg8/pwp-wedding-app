-- RSVP per household per function. A row means the household is invited to that function; no row means not
-- invited (or not decided yet). It only holds ids, never names, and is readable and writable only by the two
-- allowed signed-in profiles. Every change is audited like the rest of the planner.
create table guest_invites (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  function_id uuid not null references wedding_functions (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'confirmed', 'maybe', 'declined')),
  persons_attending int check (persons_attending >= 0), -- null = the whole household
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, function_id)
);

create index guest_invites_function_idx on guest_invites (function_id);

alter table guest_invites enable row level security;

create policy "guest_invites: allowed profiles can read" on guest_invites
  for select to authenticated using (is_allowed_user());
create policy "guest_invites: allowed profiles can write" on guest_invites
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger guest_invites_set_updated_at before update on guest_invites
  for each row execute function set_updated_at();
create trigger guest_invites_audit after insert or update or delete on guest_invites
  for each row execute function audit_row_change();

alter publication supabase_realtime add table guest_invites;
