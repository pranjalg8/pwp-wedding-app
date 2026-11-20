-- Real sending, step 1 of 2: call send-notifications every 15 minutes so the outbox is drained.
--
-- The function only accepts the service role. Its key is never written here: the job reads it from the Vault secret
-- 'service_role_key', which you add yourself (Dashboard > Project Settings > Vault, or Integrations > Vault). Until it
-- exists the job does nothing. Until the core-services secrets are set on the function, a call is a dry run that
-- changes nothing. Rows queued while sending was off are skipped by the function, not sent.
create extension if not exists pg_net with schema extensions;

create or replace function public.drain_notification_outbox()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  key text;
begin
  select decrypted_secret into key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if key is null or not exists (select 1 from notification_outbox where status = 'pending') then
    return;
  end if;
  perform net.http_post(
    url := 'https://qutawbofxpcqxkxrzebv.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.drain_notification_outbox() from public, anon, authenticated;

select cron.schedule('drain-notification-outbox', '*/15 * * * *', 'select public.drain_notification_outbox()');
