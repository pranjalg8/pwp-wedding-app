-- Rooms for the nights outside the guest days (Shri Kanth on 12 Feb before and 16 Feb after).
-- stay_rooms.available_until: the last night a room is open, so only 10 of Shri Kanth's 18 rooms stay on to 16 Feb.
-- room_stays.extra_nights: nights beyond the household's own guest nights that it also keeps this room.
-- Additive: both columns are optional, so the deployed app keeps working.

alter table stay_rooms add column if not exists available_until date;
alter table room_stays add column if not exists extra_nights date[] not null default '{}';

-- 10 of the 18 rooms are the ones booked for 12 and 16 Feb (floor 1 first, then the first four on floor 2); the other
-- 8 are only open 13 to 15 Feb. Which rooms the hotel gives will be set when it says; this is a placeholder.
update stay_rooms r
set available_from = case when r.label in ('F1-1','F1-2','F1-3','F1-4','F1-5','F1-6','F2-1','F2-2','F2-3','F2-4') then date '2027-02-12' else date '2027-02-13' end,
    available_until = case when r.label in ('F1-1','F1-2','F1-3','F1-4','F1-5','F1-6','F2-1','F2-2','F2-3','F2-4') then date '2027-02-16' else date '2027-02-15' end
from stay_sites s
where s.id = r.site_id and s.name = 'Shri Kanth Hotel';
