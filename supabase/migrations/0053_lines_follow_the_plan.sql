-- Budget lines that follow the plan. A line can say what its quantity comes from, so the planner can tell when the
-- amount no longer matches the rooms or the people. The planner only points out the difference: an amount changes when
-- a person presses Update.
--
--   basis:            room_nights = rooms booked at a place, added up over its nights (stay_nights).
--                     meal_people = people sleeping at a place on one night, from the room board.
--   basis_site_id:    the place.
--   basis_night:      for meal_people, the night whose guests eat this meal.
--   basis_multiplier: for example 2 extra beds in every room.
--   basis_extra:      a quantity the plan does not hold, such as Paridhi's 24 room-nights at Hotel Sai.
--   adjustment:       a fixed amount added after quantity x rate; negative for an advance already paid.
--
-- Additive. The six hotel lines below get the figures already written in their notes, and only when those figures give
-- exactly the amount on the line. No amount changes. The 13 Feb meals are linked to Shri Kanth because the note says
-- they come from the hotel.

alter table payment_schedule add column if not exists basis text check (basis is null or basis in ('room_nights', 'meal_people'));
alter table payment_schedule add column if not exists basis_site_id uuid references stay_sites (id);
alter table payment_schedule add column if not exists basis_night date;
alter table payment_schedule add column if not exists basis_multiplier numeric not null default 1 check (basis_multiplier > 0);
alter table payment_schedule add column if not exists basis_extra numeric not null default 0 check (basis_extra >= 0);
alter table payment_schedule add column if not exists adjustment numeric not null default 0;
create index if not exists payment_schedule_basis_site_idx on payment_schedule (basis_site_id);

alter table payment_schedule drop constraint if exists payment_schedule_basis_complete;
alter table payment_schedule add constraint payment_schedule_basis_complete check (
  basis is null
  or (basis_site_id is not null and quantity is not null and rate is not null and (basis <> 'meal_people' or basis_night is not null))
);

with lines (payee, basis, site, night, multiplier, extra, quantity, unit, rate, adjustment, amount) as (
  values
    ('Shri Kanth Hotel: rooms', 'room_nights', 'Shri Kanth Hotel', null::date, 1, 0, 74, 'room-nights', 2800, -50000, 157200),
    ('Shri Kanth Hotel: extra beds', 'room_nights', 'Shri Kanth Hotel', null::date, 2, 0, 148, 'bed-nights', 300, 0, 44400),
    ('Hotel Sai, Bawal: balance', 'room_nights', 'Hotel Sai, Bawal', null::date, 1, 24, 45, 'room-nights', 2500, 8000, 120500),
    ('12 Feb: dinner at Shri Kanth', 'meal_people', 'Shri Kanth Hotel', date '2027-02-12', 1, 0, 45, 'people', 550, 0, 24750),
    ('13 Feb: meals for everyone', 'meal_people', 'Shri Kanth Hotel', date '2027-02-13', 1, 0, 80, 'people', 1500, 0, 120000),
    ('16 Feb: breakfast and lunch at Shri Kanth', 'meal_people', 'Shri Kanth Hotel', date '2027-02-16', 1, 0, 50, 'people', 950, 0, 47500)
)
update payment_schedule p
set basis = l.basis,
    basis_site_id = s.id,
    basis_night = l.night,
    basis_multiplier = l.multiplier,
    basis_extra = l.extra,
    quantity = l.quantity,
    unit = l.unit,
    rate = l.rate,
    adjustment = l.adjustment,
    vendor_id = coalesce(p.vendor_id, (select v.id from vendors v where v.name = l.site))
from lines l
join stay_sites s on s.name = l.site
where p.payee = l.payee and p.status = 'pending' and p.amount = l.amount and l.quantity * l.rate + l.adjustment = l.amount;
