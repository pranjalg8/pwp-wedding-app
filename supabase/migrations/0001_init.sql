-- PwP Wedding Planner — initial schema
-- Access model: every table is readable/writable only by the two profiles in `profiles`.
-- Service-role key (used by the local wacli sync script) bypasses RLS entirely, as usual.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: the exact two people allowed into the app
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: self and partner can read" on profiles
  for select
  using (auth.uid() in (select id from profiles));

-- ---------------------------------------------------------------------------
-- topics: fixed list of planning areas
-- ---------------------------------------------------------------------------
create table topics (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  -- substring to match against messages.chat_name (ilike) for the
  -- "source messages" panel — the WhatsApp group names don't line up
  -- cleanly with the display labels (typos, different wording), so this
  -- is kept explicit rather than derived from `label`.
  chat_match text,
  sort_order int not null default 0
);

alter table topics enable row level security;

create policy "topics: allowed profiles can read" on topics
  for select
  using (auth.uid() in (select id from profiles));

-- ---------------------------------------------------------------------------
-- planning_items: the actual plan content per topic
-- ---------------------------------------------------------------------------
create table planning_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics (id) on delete cascade,
  type text not null check (type in ('decision', 'todo', 'vendor', 'budget_line', 'note')),
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'decided', 'done')),
  amount numeric,
  currency text default 'INR',
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'sync')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planning_items_topic_idx on planning_items (topic_id);

alter table planning_items enable row level security;

create policy "planning_items: allowed profiles can read" on planning_items
  for select
  using (auth.uid() in (select id from profiles));

create policy "planning_items: allowed profiles can write" on planning_items
  for all
  using (auth.uid() in (select id from profiles))
  with check (auth.uid() in (select id from profiles));

-- keep updated_at honest on every row update
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger planning_items_set_updated_at
  before update on planning_items
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- messages: raw mirror of synced WhatsApp messages (traceability / "source")
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_jid text not null,
  chat_name text not null,
  msg_id text not null unique,
  sender_name text,
  from_me boolean not null default false,
  "timestamp" timestamptz not null,
  text text,
  media_type text,
  media_caption text,
  synced_at timestamptz not null default now()
);

create index messages_chat_idx on messages (chat_jid, "timestamp");

alter table messages enable row level security;

create policy "messages: allowed profiles can read" on messages
  for select
  using (auth.uid() in (select id from profiles));

-- ---------------------------------------------------------------------------
-- audit_log: every change, split into 'manual' (a person, in the UI) vs
-- 'sync' (the wacli sync script, or Claude acting on request)
-- ---------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('manual', 'sync')),
  actor_name text not null,
  device_info jsonb,
  table_name text not null,
  record_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_type_idx on audit_log (actor_type, created_at desc);

alter table audit_log enable row level security;

create policy "audit_log: allowed profiles can read" on audit_log
  for select
  using (auth.uid() in (select id from profiles));

create policy "audit_log: allowed profiles can insert" on audit_log
  for insert
  with check (auth.uid() in (select id from profiles));

-- ---------------------------------------------------------------------------
-- app_secrets: single-row table holding the bcrypt hash of the admin PIN.
-- Not exposed via any SELECT policy — only verify_pin() (security definer)
-- can read it, so the PIN hash never reaches the client.
-- ---------------------------------------------------------------------------
create table app_secrets (
  id int primary key default 1,
  pin_hash text not null,
  constraint single_row check (id = 1)
);

alter table app_secrets enable row level security;
-- deliberately no policies: nobody can select/insert/update this table directly,
-- not even the two profiles — only the security definer function below.

create or replace function verify_pin(input_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  if auth.uid() not in (select id from profiles) then
    return false;
  end if;

  select pin_hash into stored_hash from app_secrets where id = 1;
  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(input_pin, stored_hash);
end;
$$;

revoke all on function verify_pin(text) from public;
grant execute on function verify_pin(text) to authenticated;
