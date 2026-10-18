-- Budget planning: what is still to be paid and when, how much money is available, and a budget per area.
-- Paid money stays in the existing payments ledger; this adds the other half (pending payments) and the targets.
-- All three tables are readable and writable only by the two allowed signed-in profiles, and every change is audited.

-- One row per payment still to make (or already made / dropped). "Mark paid" in the app writes the payment to the
-- ledger and links it here, so nothing is counted twice.
create table payment_schedule (
  id uuid primary key default gen_random_uuid(),
  payee text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  topic_id uuid references topics (id) on delete set null,   -- the area (Jewellery, Photography ...)
  note text,
  is_estimate boolean not null default false,                -- true until the real figure is known
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_payment_id uuid references payments (id) on delete set null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_schedule_due_idx on payment_schedule (status, due_date);

-- One row: the overall budget and the money available. Funds are as of a date, with an optional amount added each
-- month after that, so the month-by-month view can show a running balance.
create table budget_settings (
  id int primary key default 1 check (id = 1),
  total_budget numeric(12,2) check (total_budget >= 0),
  funds_available numeric(12,2) check (funds_available >= 0),
  funds_as_of date,
  monthly_addition numeric(12,2) not null default 0 check (monthly_addition >= 0),
  updated_at timestamptz not null default now()
);
insert into budget_settings (id) values (1);

-- A target per area, to compare with what is committed and paid.
create table budget_areas (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references topics (id) on delete cascade,
  allocation numeric(12,2) not null check (allocation >= 0),
  updated_at timestamptz not null default now()
);

alter table payment_schedule enable row level security;
alter table budget_settings enable row level security;
alter table budget_areas enable row level security;

create policy "payment_schedule: allowed profiles can read" on payment_schedule for select to authenticated using (is_allowed_user());
create policy "payment_schedule: allowed profiles can write" on payment_schedule for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create policy "budget_settings: allowed profiles can read" on budget_settings for select to authenticated using (is_allowed_user());
create policy "budget_settings: allowed profiles can write" on budget_settings for all to authenticated using (is_allowed_user()) with check (is_allowed_user());
create policy "budget_areas: allowed profiles can read" on budget_areas for select to authenticated using (is_allowed_user());
create policy "budget_areas: allowed profiles can write" on budget_areas for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger payment_schedule_set_updated_at before update on payment_schedule for each row execute function set_updated_at();
create trigger budget_settings_set_updated_at before update on budget_settings for each row execute function set_updated_at();
create trigger budget_areas_set_updated_at before update on budget_areas for each row execute function set_updated_at();

create trigger payment_schedule_audit after insert or update or delete on payment_schedule for each row execute function audit_row_change();
create trigger budget_settings_audit after insert or update or delete on budget_settings for each row execute function audit_row_change();
create trigger budget_areas_audit after insert or update or delete on budget_areas for each row execute function audit_row_change();

alter publication supabase_realtime add table payment_schedule, budget_settings, budget_areas;
