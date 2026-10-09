-- Due-date reminders. Daily job queues one event per person and item that is due within 3 days
-- (once) or overdue (once a week). An item owned by "both" or nobody goes to both people.
-- Nothing is emailed until send-notifications has core-services credentials.
alter table notification_outbox drop constraint notification_outbox_kind_check;
alter table notification_outbox add constraint notification_outbox_kind_check
  check (kind in ('deck_completed', 'weekly_nudge', 'due_reminder'));

create or replace function enqueue_due_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_rows int;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_stage text;
begin
  for r in
    select pi.id as item_id, pi.title, pi.due_date, pi.owner, t.label as topic_label, p.id as recipient
    from planning_items pi
    join topics t on t.id = pi.topic_id
    join profiles p on (pi.owner is null or pi.owner = 'both' or lower(p.display_name) = pi.owner)
    where pi.due_date is not null
      and pi.status not in ('done', 'decided')
      and pi.due_date <= v_today + 3
  loop
    v_stage := case when r.due_date < v_today then 'overdue:' || to_char(v_today, 'IYYY-IW') else 'soon' end;
    insert into notification_outbox (kind, recipient_profile_id, dedupe_key, payload)
    values (
      'due_reminder', r.recipient,
      'due_reminder:' || r.recipient || ':' || r.item_id || ':' || r.due_date || ':' || v_stage,
      jsonb_build_object(
        'title', r.title, 'topic_label', r.topic_label, 'due_date', r.due_date,
        'days_left', r.due_date - v_today, 'owner', r.owner
      )
    )
    on conflict (dedupe_key) do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;
  return v_count;
end;
$$;

revoke execute on function enqueue_due_reminders() from public, anon, authenticated;

-- 04:30 UTC = 10:00 India time, every day.
select cron.schedule('daily-due-reminders', '30 4 * * *', $$select public.enqueue_due_reminders()$$);
