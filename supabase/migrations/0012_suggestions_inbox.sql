-- Suggestions inbox: Claude proposes planner changes from new chat messages and images; a person approves
-- or rejects. Money changes always go through here. Approval is done by SECURITY DEFINER functions that
-- run as the signed-in person, so the planning_items audit trigger still records WHO approved it and from
-- which device.

create table suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id text not null,
  kind text not null check (kind in ('new_item', 'update_item')),
  topic_id uuid not null references topics (id) on delete cascade,
  target_item_id uuid references planning_items (id) on delete cascade,
  base_updated_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  source_msg_ids text[] not null default '{}',
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  involves_money boolean not null default false,
  rationale text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  decision_note text,
  constraint update_needs_target check (kind <> 'update_item' or target_item_id is not null)
);

create index suggestions_status_idx on suggestions (status, created_at desc);

alter table suggestions enable row level security;

create policy "suggestions: allowed users can read" on suggestions
  for select to authenticated
  using (is_allowed_user());

-- Where the last extraction run got to, per chat.
create table extraction_cursor (
  chat_jid text primary key,
  last_processed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table extraction_cursor enable row level security;

create policy "extraction_cursor: allowed users can read" on extraction_cursor
  for select to authenticated
  using (is_allowed_user());

create or replace function accept_suggestion(p_id uuid, p_overrides jsonb default '{}'::jsonb, p_force boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s suggestions;
  f jsonb;
  cur planning_items;
  item_id uuid;
begin
  if auth.uid() is null or not is_allowed_user() then
    raise exception 'not allowed';
  end if;

  select * into s from suggestions where id = p_id for update;
  if not found then raise exception 'suggestion not found'; end if;
  if s.status <> 'pending' then raise exception 'already %', s.status; end if;

  f := s.payload || coalesce(p_overrides, '{}'::jsonb);

  if s.kind = 'new_item' then
    insert into planning_items (topic_id, type, title, detail, status, amount, amount_kind, amount_note, metadata, source_msg_ids, as_of, source, created_by)
    values (
      s.topic_id,
      coalesce(f ->> 'type', 'note'),
      f ->> 'title',
      f ->> 'detail',
      coalesce(f ->> 'status', 'open'),
      nullif(f ->> 'amount', '')::numeric,
      nullif(f ->> 'amount_kind', ''),
      nullif(f ->> 'amount_note', ''),
      coalesce(f -> 'metadata', '{}'::jsonb),
      s.source_msg_ids,
      (select max((m."timestamp" at time zone 'Asia/Kolkata')::date) from messages m where m.msg_id = any (s.source_msg_ids)),
      'manual',
      auth.uid()
    )
    returning id into item_id;
  else
    select * into cur from planning_items where id = s.target_item_id for update;
    if not found then raise exception 'target item no longer exists'; end if;
    if not p_force and s.base_updated_at is not null and cur.updated_at > s.base_updated_at then
      raise exception 'stale: this item changed after the suggestion was made';
    end if;

    update planning_items pi set
      type = coalesce(f ->> 'type', pi.type),
      title = coalesce(f ->> 'title', pi.title),
      detail = case when f ? 'detail' then f ->> 'detail' else pi.detail end,
      status = coalesce(f ->> 'status', pi.status),
      amount = case when f ? 'amount' then nullif(f ->> 'amount', '')::numeric else pi.amount end,
      amount_kind = case when f ? 'amount_kind' then nullif(f ->> 'amount_kind', '') else pi.amount_kind end,
      amount_note = case when f ? 'amount_note' then nullif(f ->> 'amount_note', '') else pi.amount_note end,
      metadata = case when f ? 'metadata' then pi.metadata || (f -> 'metadata') else pi.metadata end,
      source_msg_ids = (select coalesce(array_agg(distinct x), '{}') from unnest(pi.source_msg_ids || s.source_msg_ids) x),
      as_of = (select max((m."timestamp" at time zone 'Asia/Kolkata')::date) from messages m where m.msg_id = any (pi.source_msg_ids || s.source_msg_ids))
    where pi.id = cur.id
    returning pi.id into item_id;
  end if;

  update suggestions set status = 'accepted', decided_by = auth.uid(), decided_at = now() where id = p_id;
  return item_id;
end;
$$;

create or replace function reject_suggestion(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not is_allowed_user() then
    raise exception 'not allowed';
  end if;
  update suggestions
    set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_id and status = 'pending';
  if not found then raise exception 'suggestion not found or already decided'; end if;
end;
$$;

revoke execute on function accept_suggestion(uuid, jsonb, boolean) from public, anon;
revoke execute on function reject_suggestion(uuid, text) from public, anon;
grant execute on function accept_suggestion(uuid, jsonb, boolean) to authenticated;
grant execute on function reject_suggestion(uuid, text) to authenticated;
