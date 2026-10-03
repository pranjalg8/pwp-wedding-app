-- verify_pin pinned search_path to `public`, but Supabase installs pgcrypto in
-- the `extensions` schema, so crypt() was not found and every PIN check errored.
create or replace function verify_pin(input_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null or auth.uid() not in (select id from profiles) then
    return false;
  end if;

  select pin_hash into stored_hash from app_secrets where id = 1;
  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(input_pin, stored_hash);
end;
$$;
