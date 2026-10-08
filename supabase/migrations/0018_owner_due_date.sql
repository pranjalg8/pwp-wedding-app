-- Who is looking after an item, and when it is due. Shown as one shared "Our due items" list.
alter table planning_items
  add column owner text check (owner in ('pranjal', 'paridhi', 'both')),
  add column due_date date;
create index planning_items_due_idx on planning_items (due_date) where due_date is not null;
