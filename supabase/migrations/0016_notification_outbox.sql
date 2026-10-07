-- Notification outbox: the Supabase half of "email the other person when something happens".
-- Events are queued here by database triggers and a weekly job; the send-notifications Edge Function
-- reads the queue and publishes to core-services (AWS pub/sub). Until that function has credentials it
-- only reports what it would send, so nothing is emailed.
--
-- Privacy rule: an event is only queued for a person who is allowed to see the deck it is about, so a
-- hidden destination can never appear in someone else's notification.

create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('deck_completed', 'weekly_nudge')),
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  actor_profile_id uuid references profiles (id) on delete set null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz
);

create index notification_outbox_pending_idx on notification_outbox (created_at) where status = 'pending';

-- No policies on purpose: the app never reads or writes the outbox. Only the service role (the Edge
-- Function) and the security-definer functions below touch it.
alter table notification_outbox enable row level security;

-- Can this person see this deck? (decks with a feature are only visible to people holding that grant)
create or replace function profile_can_see_deck(p_profile uuid, p_deck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from swipe_decks d
    where d.id = p_deck
      and (
        d.feature is null
        or exists (select 1 from feature_access fa where fa.profile_id = p_profile and fa.feature = d.feature)
      )
  );
$$;

-- When someone answers the last card of a deck, queue one event for their partner.
create or replace function enqueue_deck_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck swipe_decks%rowtype;
  v_total int;
  v_done int;
  v_partner uuid;
  v_partner_done int;
  v_matches int;
  v_actor text;
begin
  select d.* into v_deck
  from swipe_cards c join swipe_decks d on d.id = c.deck_id
  where c.id = new.card_id;
  if not found then return null; end if;

  select count(*) into v_total from swipe_cards where deck_id = v_deck.id;
  select count(*) into v_done
  from swipes s join swipe_cards c on c.id = s.card_id
  where c.deck_id = v_deck.id and s.profile_id = new.profile_id;
  if v_done < v_total then return null; end if;

  select id into v_partner from profiles where id <> new.profile_id limit 1;
  if v_partner is null then return null; end if;
  -- never announce a deck the partner is not allowed to see
  if not profile_can_see_deck(v_partner, v_deck.id) then return null; end if;

  select count(*) into v_partner_done
  from swipes s join swipe_cards c on c.id = s.card_id
  where c.deck_id = v_deck.id and s.profile_id = v_partner;

  select count(*) into v_matches
  from swipe_cards c
  join swipes a on a.card_id = c.id and a.profile_id = new.profile_id and a.choice = 'yes'
  join swipes b on b.card_id = c.id and b.profile_id = v_partner and b.choice = 'yes'
  where c.deck_id = v_deck.id;

  select display_name into v_actor from profiles where id = new.profile_id;

  insert into notification_outbox (kind, recipient_profile_id, actor_profile_id, dedupe_key, payload)
  values (
    'deck_completed', v_partner, new.profile_id,
    'deck_completed:' || new.profile_id || ':' || v_deck.key,
    jsonb_build_object(
      'deck_key', v_deck.key, 'deck_label', v_deck.label, 'total', v_total,
      'partner_done', v_partner_done >= v_total, 'matches', v_matches, 'actor_name', v_actor
    )
  )
  on conflict (dedupe_key) do nothing;
  return null;
end;
$$;

create trigger swipes_enqueue_deck_completed
  after insert on swipes
  for each row execute function enqueue_deck_completed();

-- Weekly: remind someone who has not finished a deck their partner has started. One per person, deck and week.
create or replace function enqueue_weekly_nudges()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_rows int;
begin
  for r in
    select p.id as recipient, d.id as deck_id, d.key as deck_key, d.label as deck_label,
           (select count(*) from swipe_cards c where c.deck_id = d.id) as total,
           (select count(*) from swipes s join swipe_cards c on c.id = s.card_id
              where c.deck_id = d.id and s.profile_id = p.id) as mine,
           (select count(*) from swipes s join swipe_cards c on c.id = s.card_id
              where c.deck_id = d.id and s.profile_id <> p.id) as theirs,
           (select pp.display_name from profiles pp where pp.id <> p.id limit 1) as partner_name
    from profiles p
    cross join swipe_decks d
    where profile_can_see_deck(p.id, d.id)
  loop
    if r.mine < r.total and r.theirs > 0 then
      insert into notification_outbox (kind, recipient_profile_id, dedupe_key, payload)
      values (
        'weekly_nudge', r.recipient,
        'weekly_nudge:' || r.recipient || ':' || r.deck_key || ':' || to_char(now(), 'IYYY-IW'),
        jsonb_build_object(
          'deck_key', r.deck_key, 'deck_label', r.deck_label, 'total', r.total,
          'answered', r.mine, 'partner_answered', r.theirs, 'partner_name', r.partner_name
        )
      )
      on conflict (dedupe_key) do nothing;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end loop;
  return v_count;
end;
$$;

-- These run as the table owner; nobody needs to call them directly.
revoke execute on function profile_can_see_deck(uuid, uuid) from public, anon, authenticated;
revoke execute on function enqueue_deck_completed() from public, anon, authenticated;
revoke execute on function enqueue_weekly_nudges() from public, anon, authenticated;
