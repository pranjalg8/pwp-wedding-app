-- Quote and contract reader, step 1: a private place for uploaded vendor documents, and two more kinds of
-- suggestion (a proposed payment, a proposed task). Nothing here writes planner data by itself: the reader only
-- creates pending suggestions, and a person accepts them (which is audited like every other change).

-- Private bucket: photos and PDFs only, 10 MB each. Only the two allowed signed-in profiles can touch it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "documents bucket: allowed users read" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and is_allowed_user());
create policy "documents bucket: allowed users upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and is_allowed_user());
create policy "documents bucket: allowed users delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and is_allowed_user());

create table documents (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  topic_id uuid references topics (id) on delete set null,
  status text not null default 'uploaded' check (status in ('uploaded', 'read', 'failed')),
  summary text,                 -- one or two lines about what the document is
  error text,                   -- why reading failed, if it did
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table documents enable row level security;
create policy "documents: allowed users read" on documents for select to authenticated using (is_allowed_user());
create policy "documents: allowed users add" on documents for insert to authenticated
  with check (is_allowed_user() and uploaded_by = auth.uid());
create policy "documents: allowed users update" on documents for update to authenticated
  using (is_allowed_user()) with check (is_allowed_user());
create trigger documents_audit after insert or update or delete on documents for each row execute function audit_row_change();

-- Every proposal made from a document points back at it.
alter table suggestions add column document_id uuid references documents (id) on delete set null;
alter table suggestions drop constraint suggestions_kind_check;
alter table suggestions add constraint suggestions_kind_check
  check (kind in ('new_item', 'update_item', 'new_payment', 'new_task'));

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

  elsif s.kind = 'new_payment' then
    insert into payment_schedule (payee, amount, due_date, topic_id, note, is_estimate, paridhi_amount, created_by)
    values (
      f ->> 'payee',
      (f ->> 'amount')::numeric,
      (f ->> 'due_date')::date,
      s.topic_id,
      nullif(f ->> 'note', ''),
      coalesce((f ->> 'is_estimate')::boolean, false),
      coalesce(nullif(f ->> 'paridhi_amount', '')::numeric, 0),
      auth.uid()
    )
    returning id into item_id;

  elsif s.kind = 'new_task' then
    insert into tasks (title, topic_id, owner, priority, due_date, status, summary, source_msg_ids)
    values (
      f ->> 'title',
      s.topic_id,
      nullif(f ->> 'owner', ''),
      coalesce(nullif(f ->> 'priority', ''), 'normal'),
      nullif(f ->> 'due_date', '')::date,
      'open',
      nullif(f ->> 'summary', ''),
      s.source_msg_ids
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
