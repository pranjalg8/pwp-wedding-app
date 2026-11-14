-- A third budget group for the contingency buffer, which sits outside both the wedding budget and the after-the-wedding one.
-- It shows only under "Everything" on the Budget page.
alter table topics drop constraint if exists topics_budget_group_check;
alter table topics add constraint topics_budget_group_check check (budget_group in ('wedding', 'post_wedding', 'buffer'));
insert into topics (key, label, sort_order, budget_group) values ('contingency', 'Contingency', 14, 'buffer') on conflict (key) do nothing;
update payment_schedule set topic_id = (select id from topics where key = 'contingency') where payee = 'Contingency buffer' and status = 'pending';
