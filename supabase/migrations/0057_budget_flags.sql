-- Budget review flags: what the budget review agent found, and what the planner decided about each finding.
--
-- The review itself (supabase/functions/budget-review/checks.ts) only reads. It writes here and nowhere else, and
-- a flag never changes a payment, a ledger entry or a setting. To act on one the person unlocks edit mode and uses
-- the normal editor on the Budget page, so the change goes through the PIN gate and the audit trail like any other.
--
--   fingerprint  identifies one finding: the check, the row and the figures it was about. Unique, so the nightly run
--                never raises the same finding twice, and a finding that was confirmed or dismissed stays quiet until
--                one of its figures changes (then it has a new fingerprint and is raised again).
--   question     the short question for the planner, written by Gemini through the same edge-function secret the
--                chatbot uses. Null when the AI is not configured; the page then shows the plain message.
--   status       open, confirmed ("yes, this is right"), dismissed, or resolved (the problem went away on its own,
--                found by the next run). A resolved flag that comes back is reopened.
--
-- Additive: one new table and two functions. Browsers can read; only the functions below and the service role write.

create table budget_flags (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  code text not null,
  severity text not null check (severity in ('error', 'warning', 'info')),
  source_table text not null check (source_table in ('payment_schedule', 'payments', 'planning_items', 'budget_settings', 'budget')),
  row_id text,
  label text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  question text,
  question_model text,
  status text not null default 'open' check (status in ('open', 'confirmed', 'dismissed', 'resolved')),
  first_seen timestamptz not null default now(),
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  decision_note text,
  updated_at timestamptz not null default now()
);

create index budget_flags_status_idx on budget_flags (status, severity);

alter table budget_flags enable row level security;
create policy "budget_flags: allowed users can read" on budget_flags
  for select to authenticated using (is_allowed_user());

create trigger budget_flags_set_updated_at before update on budget_flags
  for each row execute function set_updated_at();
create trigger budget_flags_audit after insert or update or delete on budget_flags
  for each row execute function audit_row_change();
alter publication supabase_realtime add table budget_flags;

-- Confirm or dismiss a flag. Runs as the signed-in person, so the audit trigger records who and from which device.
create or replace function decide_budget_flag(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not is_allowed_user() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('confirmed', 'dismissed', 'open') then
    raise exception 'status must be confirmed, dismissed or open';
  end if;
  update budget_flags
    set status = p_status,
        decided_by = case when p_status = 'open' then null else auth.uid() end,
        decided_at = case when p_status = 'open' then null else now() end,
        decision_note = case when p_status = 'open' then null else left(p_note, 500) end
    where id = p_id;
  if not found then raise exception 'flag not found'; end if;
end;
$$;

revoke execute on function decide_budget_flag(uuid, text, text) from public, anon;
grant execute on function decide_budget_flag(uuid, text, text) to authenticated;
