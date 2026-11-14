-- Stays with dates: each household's stay in a room can carry its own check-in and check-out day.
--   room_stays.check_in:  the first night in the room.
--   room_stays.check_out: the morning it leaves (the night before is its last night), so the nights are
--                         check_in up to but not including check_out.
-- Both are optional and set together. When they are empty the stay follows the household's guest days plus
-- room_stays.extra_nights, as before, so the deployed app keeps working. When they are set they decide the nights
-- and extra_nights is ignored.
--
-- Rooms can be shared, so two stays in one room on the same night are allowed; the room board flags a room that
-- holds more people than its capacity. What the database rules out is a stay that ends before it starts, or the same
-- household in the same room twice (already unique on room_id, guest_id).
--
-- guests.kind tells a guest household from the couple's own family and from staff (drivers, helpers), so meals and
-- rooms can be counted for each later. Every existing household is a guest.
-- Additive: new columns only, with defaults or nulls.

alter table room_stays add column if not exists check_in date;
alter table room_stays add column if not exists check_out date;

alter table room_stays drop constraint if exists room_stays_dates_together;
alter table room_stays add constraint room_stays_dates_together
  check ((check_in is null) = (check_out is null));

alter table room_stays drop constraint if exists room_stays_dates_order;
alter table room_stays add constraint room_stays_dates_order
  check (check_out is null or check_out > check_in);

alter table guests add column if not exists kind text not null default 'guest';

alter table guests drop constraint if exists guests_kind_check;
alter table guests add constraint guests_kind_check
  check (kind in ('guest', 'family', 'staff'));
