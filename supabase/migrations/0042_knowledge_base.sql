-- Knowledge base: short reference pages about the wedding (schedule, stay and food, budget rules, the home move),
-- written as markdown and shown in the app under Knowledge. The pages are filled in through the database, not stored
-- in the repository. Readable and writable only by the two allowed signed-in profiles.

create table kb_entries (
  slug text primary key,
  title text not null,
  body text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table kb_entries enable row level security;

create policy "kb_entries: allowed profiles can read" on kb_entries
  for select to authenticated using (is_allowed_user());
create policy "kb_entries: allowed profiles can write" on kb_entries
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger kb_entries_set_updated_at before update on kb_entries
  for each row execute function set_updated_at();

alter publication supabase_realtime add table kb_entries;
