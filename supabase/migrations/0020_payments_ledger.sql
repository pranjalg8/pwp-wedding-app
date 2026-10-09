-- Payments ledger: one row per payment actually made, with the receipt reference and whether the receipt was
-- checked. Amounts are numeric(12,2) and must be positive. The Budget page adds them up and compares the total
-- with the "paid" items in the planner so a mismatch is visible.
create table payments (
  id uuid primary key default gen_random_uuid(),
  paid_on date not null,
  payee text not null,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  reference text,
  purpose text,
  topic_id uuid references topics (id),
  item_id uuid references planning_items (id) on delete set null,
  verification text not null default 'chat_only' check (verification in ('receipt_checked', 'chat_only')),
  verification_note text,
  source_msg_ids text[] not null default '{}',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index payments_paid_on_idx on payments (paid_on desc);
alter table payments enable row level security;
create policy "payments: allowed profiles can read" on payments for select
  using (auth.uid() in (select id from profiles));
create policy "payments: allowed profiles can write" on payments for all
  using (auth.uid() in (select id from profiles))
  with check (auth.uid() in (select id from profiles));
-- Seed rows (3 payments) were inserted when this was applied: two Malabar advances checked against the receipt
-- photos, and the Hotel Sai token recorded from chat only.
