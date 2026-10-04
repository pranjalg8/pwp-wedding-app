-- Audit rows are now written by the database, not the browser, so they cannot be skipped
-- or forged. A signed-in person => 'manual' (name looked up server-side, device from the
-- request headers). No signed-in person (service role: the sync script, or Claude via SQL)
-- => 'sync', named by the app.actor setting when provided.
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hdrs jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  uid uuid := auth.uid();
  kind text;
  who text;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return null;
  end if;

  if uid is not null then
    kind := 'manual';
    select display_name into who from profiles where id = uid;
    who := coalesce(who, 'unknown');
  else
    kind := 'sync';
    who := coalesce(nullif(current_setting('app.actor', true), ''), 'service');
  end if;

  insert into audit_log (actor_type, actor_name, device_info, table_name, record_id, action, before, after)
  values (
    kind,
    who,
    case when kind = 'manual' then jsonb_strip_nulls(jsonb_build_object(
      'user_agent', hdrs ->> 'user-agent',
      'nickname', nullif(hdrs ->> 'x-device-name', ''),
      'platform', hdrs ->> 'sec-ch-ua-platform',
      'language', split_part(coalesce(hdrs ->> 'accept-language', ''), ',', 1)
    )) end,
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

revoke execute on function audit_row_change() from public, anon, authenticated;

create trigger planning_items_audit
  after insert or update or delete on planning_items
  for each row execute function audit_row_change();

-- Browsers can no longer write audit rows directly (the trigger and the service role still can).
alter policy "audit_log: allowed profiles can insert" on audit_log with check (false);
