-- Fix: verify_pin's NULL-handling let an unauthenticated (anon) caller fall
-- through the guard, since `auth.uid() not in (...)` is NULL (not true) when
-- auth.uid() is NULL, and plpgsql treats a NULL `if` condition as false.
create or replace function verify_pin(input_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
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

-- Defense in depth: Supabase grants execute on new functions to anon by
-- default regardless of `revoke ... from public` — revoke it explicitly.
revoke execute on function verify_pin(text) from anon;
grant execute on function verify_pin(text) to authenticated;

-- Pin search_path on the trigger function too (was mutable).
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
