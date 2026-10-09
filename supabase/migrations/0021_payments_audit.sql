-- The payments ledger is about to be editable from the app, so every change to it must be audited like
-- planning_items, tasks and task_options (manual for a signed-in person, sync for the service role).
create trigger payments_audit after insert or update or delete on payments
  for each row execute function audit_row_change();

-- Same hardening as the other tables: policies apply to signed-in users only.
alter policy "payments: allowed profiles can read" on payments to authenticated;
alter policy "payments: allowed profiles can write" on payments to authenticated;
