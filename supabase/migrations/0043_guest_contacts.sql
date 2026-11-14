-- Guest contacts: phone numbers and emails for each household, one row per number or address. A household can have
-- several, for the head and for family members (person says whose it is), and rank keeps the order they were found in.
-- The rows are matched from the owner's contacts and WhatsApp and are readable and writable only by the two allowed
-- signed-in profiles. The shared guest page never reads this table.

create table guest_contacts (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  person text not null,
  kind text not null check (kind in ('phone', 'email')),
  value text not null,
  rank int not null default 0,
  source text not null default 'contacts_vcf',
  created_at timestamptz not null default now(),
  unique (guest_id, person, kind, value)
);

create index guest_contacts_guest_idx on guest_contacts (guest_id);

alter table guest_contacts enable row level security;

create policy "guest_contacts: allowed profiles can read" on guest_contacts
  for select to authenticated using (is_allowed_user());
create policy "guest_contacts: allowed profiles can write" on guest_contacts
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger guest_contacts_audit after insert or update or delete on guest_contacts
  for each row execute function audit_row_change();

alter publication supabase_realtime add table guest_contacts;
