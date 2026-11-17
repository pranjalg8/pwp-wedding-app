-- Budget lines that say who they are paid to and how they are worked out.
--
--   vendors: the businesses money goes to (a hotel, the jeweller, the venue). A payment line can point at one, so
--            the Vendors page can total what each is owed and paid. planning_item_id links the vendor's research
--            notes (planning_items of type vendor) when there are some. No contact details are kept here.
--   payment_schedule.vendor_id:      who the line is paid to.
--   payment_schedule.quantity/unit/rate: how the amount is worked out, e.g. 10 rooms x Rs 3,500, or 150 plates x
--                                    Rs 800. The amount stays what is actually owed (taxes and rounding included);
--                                    the planner offers quantity x rate as the amount and shows when they differ.
--   payment_schedule.in_budget:      false for a line that is tracked but paid by someone else (for example the
--                                    parents), so it stays visible without counting in the budget or the cash plan.
--   amount may now be 0, for something confirmed as included at no charge (meals with the hall, say).
--   paridhi_plan (Paridhi's dated instalments) is now checked by the database as well as the planner: a list of
--   { on: date, amount > 0 } adding up to no more than her share.
--
-- Additive: new columns have defaults or nulls. The only data written is the vendors below and vendor_id on the
-- lines whose name starts with that vendor's name.

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 120),
  kind text not null default 'other' check (kind in ('venue', 'hotel', 'caterer', 'jeweller', 'photographer', 'decor', 'travel', 'other')),
  planning_item_id uuid references planning_items (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vendors enable row level security;
create policy "vendors: allowed profiles can read" on vendors
  for select to authenticated using (is_allowed_user());
create policy "vendors: allowed profiles can write" on vendors
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create trigger vendors_set_updated_at before update on vendors
  for each row execute function set_updated_at();
create trigger vendors_audit after insert or update or delete on vendors
  for each row execute function audit_row_change();
alter publication supabase_realtime add table vendors;

alter table payment_schedule add column if not exists vendor_id uuid references vendors (id) on delete set null;
alter table payment_schedule add column if not exists quantity numeric check (quantity is null or quantity > 0);
alter table payment_schedule add column if not exists unit text check (unit is null or char_length(unit) <= 30);
alter table payment_schedule add column if not exists rate numeric check (rate is null or rate >= 0);
alter table payment_schedule add column if not exists in_budget boolean not null default true;
create index if not exists payment_schedule_vendor_idx on payment_schedule (vendor_id);

-- Allow Rs 0 lines.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.payment_schedule'::regclass and contype = 'c' and pg_get_constraintdef(oid) = 'CHECK ((amount > (0)::numeric))'
  loop
    execute format('alter table payment_schedule drop constraint %I', c);
  end loop;
end $$;
alter table payment_schedule drop constraint if exists payment_schedule_amount_not_negative;
alter table payment_schedule add constraint payment_schedule_amount_not_negative check (amount >= 0);

-- Paridhi's instalments: each { on: 'YYYY-MM-DD', amount > 0 }, together no more than her share.
create or replace function paridhi_plan_ok(plan jsonb, share numeric)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select jsonb_typeof(plan) = 'array'
    and coalesce(bool_and(
      jsonb_typeof(i) = 'object'
      and (i ->> 'on') ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(i -> 'amount') = 'number'
      and (i ->> 'amount')::numeric > 0
    ), true)
    and coalesce(sum(case when jsonb_typeof(i -> 'amount') = 'number' then (i ->> 'amount')::numeric end), 0) <= share + 0.005
  from jsonb_array_elements(case when jsonb_typeof(plan) = 'array' then plan else '[]'::jsonb end) as i
$$;

alter table payment_schedule drop constraint if exists payment_schedule_paridhi_plan_ok;
alter table payment_schedule add constraint payment_schedule_paridhi_plan_ok check (paridhi_plan_ok(paridhi_plan, paridhi_amount));

-- The vendors already in the schedule, and the lines that name them.
insert into vendors (name, kind, planning_item_id)
values
  ('Royal Pepper', 'venue', null),
  ('Shri Kanth Hotel', 'hotel', null),
  ('Hotel Sai, Bawal', 'hotel', (select id from planning_items where type = 'vendor' and title = 'Hotel Sai (Bawal)' limit 1)),
  ('Malabar Gold & Diamonds', 'jeweller', (select id from planning_items where type = 'vendor' and title = 'Malabar Gold (MG Road, Gurgaon)' limit 1))
on conflict (name) do nothing;

update payment_schedule ps set vendor_id = v.id
from vendors v
where ps.vendor_id is null
  and (ps.payee like v.name || ':%'
       or (v.name = 'Shri Kanth Hotel' and ps.payee ~ '^1[26] Feb: .* at Shri Kanth$'));
