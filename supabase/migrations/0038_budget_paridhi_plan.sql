-- Paridhi's share of a scheduled payment can be paid in dated instalments: [{"on": "2026-12-05", "amount": 25000}, ...].
-- Whatever of her share is not in the list falls on the payment's due date. Pranjal's plan follows automatically:
-- he covers an instalment that falls after the due date and is shown being paid back on its date.
alter table payment_schedule add column if not exists paridhi_plan jsonb not null default '[]'::jsonb;
