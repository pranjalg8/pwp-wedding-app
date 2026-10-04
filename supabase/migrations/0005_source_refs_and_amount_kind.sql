-- Traceability and number accuracy for planning items.
alter table planning_items
  add column source_msg_ids text[] not null default '{}',
  add column amount_note text,
  add column as_of date,
  add column amount_kind text check (amount_kind in ('paid', 'planned', 'quote'));
