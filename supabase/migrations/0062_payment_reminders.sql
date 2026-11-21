-- Payment reminders. The daily job (same 10:00 India time run as the task reminders) queues one event per person
-- for every pending payment that is due within 3 days (once) or overdue (once a week). Payments go to both people.
-- Nothing is emailed until sending is switched on (see 0061): rows queued before that are skipped, not sent.
alter table notification_outbox drop constraint notification_outbox_kind_check;
alter table notification_outbox add constraint notification_outbox_kind_check
  check (kind in ('deck_completed', 'weekly_nudge', 'due_reminder', 'payment_reminder'));

create or replace function enqueue_payment_reminders()
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
    select ps.id as pay_id, ps.payee, ps.amount, ps.due_date, p.id as recipient
    from payment_schedule ps
    cross join profiles p
    where ps.status = 'pending'
      and ps.due_date is not null
      and ps.due_date <= v_today + 3
  loop
    v_stage := case when r.due_date < v_today then 'overdue:' || to_char(v_today, 'IYYY-IW') else 'soon' end;
    insert into notification_outbox (kind, recipient_profile_id, dedupe_key, payload)
    values (
      'payment_reminder', r.recipient,
      'payment_reminder:' || r.recipient || ':' || r.pay_id || ':' || r.due_date || ':' || v_stage,
      jsonb_build_object('payee', r.payee, 'amount', r.amount, 'due_date', r.due_date, 'days_left', r.due_date - v_today)
    )
    on conflict (dedupe_key) do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;
  return v_count;
end;
$$;

revoke execute on function enqueue_payment_reminders() from public, anon, authenticated;

select cron.schedule('daily-payment-reminders', '35 4 * * *', $$select public.enqueue_payment_reminders()$$);
