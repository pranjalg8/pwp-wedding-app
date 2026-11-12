-- Live updates: four pages subscribe to tables that were never added to the realtime publication, so they did not
-- refresh when the other person made an edit (payments ledger, guest list, functions, suggestions inbox).
-- guest_invites was replaced by guest_rsvps in 0030 and nothing listens to it any more.
-- Realtime still applies each table's row level security, so this sends nothing new to anyone outside the two profiles.
-- Written so it can be run twice without failing.

do $$
declare t text;
begin
  foreach t in array array['guests', 'payments', 'suggestions', 'wedding_functions'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;

  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_invites') then
    alter publication supabase_realtime drop table public.guest_invites;
  end if;
end $$;
