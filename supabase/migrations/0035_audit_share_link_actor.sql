-- Changes made through an edit share link are recorded as their own kind of actor, named after the link,
-- so the Activity page can tell them apart from signed-in people and from the automatic sync.
-- The share function sends the name in an `x-actor` header with its service-role requests.
alter table audit_log drop constraint audit_log_actor_type_check;
alter table audit_log add constraint audit_log_actor_type_check check (actor_type = any (array['manual', 'sync', 'link']));

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hdrs jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  uid uuid := auth.uid();
  link_name text := nullif(hdrs ->> 'x-actor', '');
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
  elsif link_name is not null and auth.role() = 'service_role' then
    kind := 'link';
    who := link_name;
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
$function$;
