-- Run the weekly nudge every Monday at 04:00 UTC (09:30 India time). It only queues events in the outbox;
-- nothing is sent until the send-notifications Edge Function has credentials.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'weekly-swipe-nudge',
  '0 4 * * 1',
  $$select public.enqueue_weekly_nudges()$$
);
