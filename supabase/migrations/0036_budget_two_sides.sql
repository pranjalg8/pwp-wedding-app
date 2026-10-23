-- Who pays: each scheduled payment and each ledger payment can carry Paridhi's share of the amount.
-- Pranjal's share is amount - paridhi_amount, so the two always add up to the total paid to the vendor.
alter table payment_schedule add column if not exists paridhi_amount numeric(12,2) not null default 0 check (paridhi_amount >= 0);
alter table payment_schedule add constraint payment_schedule_paridhi_share_chk check (paridhi_amount <= amount);
alter table payments add column if not exists paridhi_amount numeric(12,2) not null default 0 check (paridhi_amount >= 0);
alter table payments add constraint payments_paridhi_share_chk check (paridhi_amount <= amount);

-- Paridhi's own funds, shown beside Pranjal's. The "as of" date is shared.
alter table budget_settings add column if not exists paridhi_funds_available numeric(12,2);
alter table budget_settings add column if not exists paridhi_monthly_addition numeric(12,2) not null default 0;
