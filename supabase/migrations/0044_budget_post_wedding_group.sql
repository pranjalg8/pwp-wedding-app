-- The honeymoon and the new home are kept apart from the wedding's own budget. Each area (topic) belongs to one group.
alter table topics add column if not exists budget_group text not null default 'wedding' check (budget_group in ('wedding', 'post_wedding'));
update topics set budget_group = 'post_wedding' where label in ('Honeymoon', 'Post-Wedding / New Home');
-- A separate budget for that group; the wedding keeps total_budget.
alter table budget_settings add column if not exists post_wedding_budget numeric(12,2);
