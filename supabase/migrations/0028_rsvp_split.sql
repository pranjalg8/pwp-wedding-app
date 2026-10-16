-- A household often answers in part ("2 coming, 1 maybe, 1 not"), so an RSVP row now holds counts instead of a
-- single answer. coming + maybe + declined may not exceed the household size; whoever is left has not replied.
-- The old status and persons_attending columns are no longer read or written by the app. They are left in place
-- (dropping them was blocked when this was applied) and are safe to drop later: status keeps its default of
-- 'invited' and persons_attending stays null.
alter table guest_invites
  add column coming int not null default 0 check (coming >= 0),
  add column maybe int not null default 0 check (maybe >= 0),
  add column declined int not null default 0 check (declined >= 0);

create or replace function check_guest_invite_counts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_persons int;
begin
  select persons into v_persons from guests where id = new.guest_id;
  if new.coming + new.maybe + new.declined > coalesce(v_persons, 0) then
    raise exception 'coming + maybe + not coming (%) is more than the household of %',
      new.coming + new.maybe + new.declined, coalesce(v_persons, 0);
  end if;
  return new;
end;
$$;

create trigger guest_invites_check_counts before insert or update on guest_invites
  for each row execute function check_guest_invite_counts();
