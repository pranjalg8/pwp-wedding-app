-- The original profiles policy queried profiles from inside its own USING
-- clause, which Postgres rejects as infinite recursion — so no logged-in user
-- could read their profile and the app locked everyone out.
create or replace function is_allowed_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

revoke execute on function is_allowed_user() from public, anon;
grant execute on function is_allowed_user() to authenticated;

alter policy "profiles: self and partner can read" on profiles
  using (id = auth.uid() or is_allowed_user());
