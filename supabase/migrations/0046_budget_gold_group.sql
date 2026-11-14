-- Gold (the jewellery) becomes its own header of the budget, apart from the wedding and what comes after it.
alter table topics drop constraint if exists topics_budget_group_check;
alter table topics add constraint topics_budget_group_check check (budget_group in ('gold', 'wedding', 'post_wedding', 'buffer'));
alter table budget_settings add column if not exists gold_budget numeric(12,2);
update topics set budget_group = 'gold' where label = 'Jewellery';
