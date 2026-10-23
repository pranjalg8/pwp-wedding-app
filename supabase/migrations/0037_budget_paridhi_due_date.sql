-- When Paridhi pays her share, if that is not the vendor's due date. Empty means she pays on the vendor's due date.
-- If it is later, Pranjal covers the whole payment on the due date and is paid back on this date.
alter table payment_schedule add column if not exists paridhi_due_date date;
