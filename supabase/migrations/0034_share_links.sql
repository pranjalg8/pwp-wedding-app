-- Share links: a link gives someone a read-only (later: limited edit) view of chosen parts of the planner, without
-- signing in. The link secret is never stored, only its SHA-256 hash, so a leaked database cannot reveal working
-- links. Every link expires within 3 days (enforced here, not just in the app) and can be revoked at any time.
-- The public side is the `share` edge function, which checks the link and serves only the sections it allows,
-- leaving out money, guest, honeymoon and contact details unless that switch was turned on for the link.
create table share_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  label text not null check (length(trim(label)) > 0),
  access text not null default 'view' check (access in ('view', 'edit')),
  sections text[] not null check (
    cardinality(sections) > 0
    and sections <@ array['home', 'tasks', 'functions', 'guests', 'rooms', 'budget', 'vendors', 'honeymoon']::text[]
  ),
  -- Sensitive information is off unless someone switched it on when creating the link.
  show_money boolean not null default false,
  show_guests boolean not null default false,
  show_honeymoon boolean not null default false,
  show_contacts boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count int not null default 0,
  constraint share_links_ttl check (expires_at > created_at and expires_at <= created_at + interval '3 days')
);

create index share_links_created_idx on share_links (created_at desc);

alter table share_links enable row level security;

-- Only the two signed-in profiles manage links. Anonymous visitors never touch this table directly: the edge
-- function reads it with the service role after checking the link.
create policy "share_links: allowed profiles can read" on share_links
  for select to authenticated using (is_allowed_user());
create policy "share_links: allowed profiles can create" on share_links
  for insert to authenticated with check (is_allowed_user());
create policy "share_links: allowed profiles can update" on share_links
  for update to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger share_links_audit after insert or update or delete on share_links
  for each row execute function audit_row_change();
