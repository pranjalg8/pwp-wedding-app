-- My feed: a private swipe-to-triage feed of one person's to-dos, decisions and questions, pushed in from the
-- local WhatsApp knowledge base (wakb) on the Mac. Every row belongs to one profile and only that profile can see
-- or change it; the page itself only shows for profiles granted the 'my_feed' feature.
--
-- Flow: wakb upserts feed_cards (content only, never status). Each swipe updates the card's status in the app and
-- appends a feed_actions row; the next wakb run reads unapplied actions, mirrors done/drop/undo into its own items,
-- and stamps applied_at.

create table feed_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  source text not null default 'wakb',
  source_ref text not null,
  domain text,
  kind text not null check (kind in ('todo', 'decision', 'question', 'money', 'date', 'info')),
  title text not null,
  body text,
  chat_name text,
  msg_ref text,
  source_ts timestamptz,
  due_date date,
  score numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'done', 'snoozed', 'focus', 'waiting', 'dropped')),
  snooze_until timestamptz,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source, source_ref)
);

create index feed_cards_owner_status on feed_cards (owner_id, status, score desc);

create table feed_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  card_id uuid not null references feed_cards (id) on delete cascade,
  action text not null check (action in ('done', 'snooze', 'focus', 'waiting', 'drop', 'undo')),
  prev_status text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index feed_actions_owner_created on feed_actions (owner_id, created_at desc);
create index feed_actions_unapplied on feed_actions (applied_at) where applied_at is null;

create or replace function feed_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then new.status_changed_at := now(); end if;
  return new;
end $$;

create trigger feed_cards_touch before update on feed_cards for each row execute function feed_touch();

alter table feed_cards enable row level security;
alter table feed_actions enable row level security;

create policy "feed_cards: read own" on feed_cards for select to authenticated
  using (owner_id = (select auth.uid()) and is_allowed_user());
create policy "feed_cards: update own" on feed_cards for update to authenticated
  using (owner_id = (select auth.uid()) and is_allowed_user())
  with check (owner_id = (select auth.uid()));

create policy "feed_actions: read own" on feed_actions for select to authenticated
  using (owner_id = (select auth.uid()) and is_allowed_user());
create policy "feed_actions: add own" on feed_actions for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and is_allowed_user()
    and exists (select 1 from feed_cards c where c.id = feed_actions.card_id and c.owner_id = (select auth.uid()))
  );

-- Only the app user can change status-ish fields; content columns are written by the service role (wakb).
revoke update on feed_cards from authenticated;
grant update (status, snooze_until) on feed_cards to authenticated;

-- Pranjal gets the page.
insert into feature_access (profile_id, feature)
select id, 'my_feed' from profiles where display_name = 'Pranjal'
on conflict do nothing;
