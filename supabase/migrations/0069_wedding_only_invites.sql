-- Three kinds of invitation, as on the printed cards:
--   both days     14 and 15 Feb
--   15 Feb        the whole wedding day, Haldi onwards
--   wedding only  15 Feb from the Baraat onwards (evening)
-- The kind follows from the household's invited days, so nothing has to be kept in sync by hand. The only new fact
-- is which part of 15 Feb a household is invited to, kept on its 15 Feb day row.
--
--   part = 'full'     the whole day (the default, and the only value for other days)
--   part = 'wedding'  from the Baraat onwards

alter table guest_rsvps
  add column part text not null default 'full' check (part in ('full', 'wedding')),
  add constraint guest_rsvps_wedding_part_day check (part = 'full' or event_date = date '2027-02-15');
