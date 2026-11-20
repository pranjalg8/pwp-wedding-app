-- Two fixes from the second review.
--
-- guests.arrive_on / leave_on: when a household told us it arrives and leaves. They belong to the household, so an
-- applied reply is kept even when the household is not in a room yet. The nights run from arrive_on up to the night
-- before leave_on. Empty means the household follows its guest days.
--
-- payments.vendor_id: who a recorded payment went to, so a vendor's "paid" total comes from the ledger. The payments
-- whose payee starts with a vendor's name are linked; no amount changes.
--
-- 0051 is left for the quote reader's migration (PR #81), which is already applied live.

alter table guests add column if not exists arrive_on date;
alter table guests add column if not exists leave_on date;
alter table guests drop constraint if exists guests_stay_dates_together;
alter table guests add constraint guests_stay_dates_together check ((arrive_on is null) = (leave_on is null));
alter table guests drop constraint if exists guests_stay_dates_order;
alter table guests add constraint guests_stay_dates_order check (leave_on is null or leave_on > arrive_on);

alter table payments add column if not exists vendor_id uuid references vendors (id) on delete set null;
create index if not exists payments_vendor_idx on payments (vendor_id);

update payments p set vendor_id = v.id
from vendors v
where p.vendor_id is null and p.payee like v.name || '%';
