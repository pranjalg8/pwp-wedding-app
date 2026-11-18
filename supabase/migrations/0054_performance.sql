-- Performance pass. Nothing here changes what anyone can see or do, and no history is deleted (audit retention in (e)
-- is opt-in). Safe to run more than once.

-- (a) unmapped_messages: the old view ran three correlated "= any (source_msg_ids)" checks per message, which is a
-- scan of tasks, task_options and planning_items for every message. Now the mapped ids are unnested once and the
-- messages are hash anti-joined against them. Same columns, same order, same rows: not noise, and not cited by any
-- task, option or item (payments were never part of it and still are not). Null array elements are filtered so they
-- cannot match anything, as before. Still security_invoker, so the caller's row-level security applies.
create or replace view unmapped_messages with (security_invoker = true) as
select m.id, m.chat_jid, m.chat_name, m.msg_id, m.sender_name, m.from_me, m."timestamp", m.text, m.media_type,
       m.media_caption, m.synced_at, m.is_noise
from messages m
where not m.is_noise
  and not exists (
    select 1
    from (
      select unnest(t.source_msg_ids) as msg_id from tasks t
      union all
      select unnest(o.source_msg_ids) from task_options o
      union all
      select unnest(p.source_msg_ids) from planning_items p
    ) mapped
    where mapped.msg_id is not null
      and mapped.msg_id = m.msg_id
  );

-- (b) Row-level security: a bare is_allowed_user() or auth.uid() in a policy is called once per row. Wrapped in a
-- scalar subquery, "(select is_allowed_user())", Postgres runs it once per statement and reuses the result
-- (an initPlan). Same function, same result, so the policies mean exactly what they did. Already-wrapped calls are
-- left alone, so running this again changes nothing.
do $$
declare
  pol record;
  new_qual text;
  new_check text;
  -- (?<!select )  not already wrapped;  (?<![._[:alnum:]])  a whole name, not the tail of another one
  fn_pattern constant text := '(?<!select )(?<![._[:alnum:]])((?:public\.)?is_allowed_user\(\)|auth\.uid\(\)|auth\.role\(\))';
  stmt text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    new_qual := case when pol.qual is null then null else regexp_replace(pol.qual, fn_pattern, '(select \1)', 'gi') end;
    new_check := case when pol.with_check is null then null else regexp_replace(pol.with_check, fn_pattern, '(select \1)', 'gi') end;
    if new_qual is not distinct from pol.qual and new_check is not distinct from pol.with_check then
      continue;
    end if;
    stmt := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
  end loop;
end;
$$;

-- (c) Indexes. The audit page lists the newest rows first; the rest cover foreign keys that are joined or filtered
-- on and that Postgres does not index on its own (it also needs them to check deletes of the parent row).
create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists suggestions_target_item_idx on suggestions (target_item_id);
create index if not exists payments_item_idx on payments (item_id);
create index if not exists payments_topic_idx on payments (topic_id);
create index if not exists payment_schedule_topic_idx on payment_schedule (topic_id);
create index if not exists payment_schedule_paid_payment_idx on payment_schedule (paid_payment_id);
create index if not exists notification_outbox_recipient_idx on notification_outbox (recipient_profile_id);
create index if not exists vendors_planning_item_idx on vendors (planning_item_id);

-- (d) Realtime: guest_stays has not been written since the room board (0040) and no page listens to it, so it no
-- longer needs to be in the publication. kb_entries stays: the Knowledge page listens to it.
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_stays') then
    alter publication supabase_realtime drop table guest_stays;
  end if;
end;
$$;

-- (e) Audit retention is opt-in, so no history is deleted unless you choose to. If the free-tier database
-- ever gets close to its size limit, run this once to delete audit rows older than a year every month:
--   select cron.schedule('monthly-audit-retention', '0 3 1 * *',
--     $$delete from public.audit_log where created_at < now() - interval '365 days'$$);

-- (f) Every chat the sync has seen, once, with its latest name. The extraction script used to read chat_jid and
-- chat_name from every message, which Supabase silently cut off at 1000 rows. messages_chat_idx (chat_jid,
-- timestamp) serves this.
create or replace view message_chats with (security_invoker = true) as
select distinct on (chat_jid) chat_jid, chat_name
from messages
order by chat_jid, "timestamp" desc;
