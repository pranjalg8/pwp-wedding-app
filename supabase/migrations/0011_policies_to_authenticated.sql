-- Every policy was created for the implicit PUBLIC role. Scope them to signed-in users only so the
-- anon role never even evaluates them (defense in depth; the conditions are unchanged).
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and roles = '{public}'
  loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end $$;
