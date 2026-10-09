-- Task-based planner: tasks > options > details (planning_items) + messages.
-- Additive only: existing tables keep working, the old topic pages are untouched.

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic_id uuid references topics (id) on delete set null, -- the "area" (old WhatsApp-group topic)
  owner text check (owner in ('pranjal', 'paridhi', 'both')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'decided', 'done')),
  summary text,
  sort_order int not null default 0,
  source_msg_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_options (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  name text not null,
  status text not null default 'considering'
    check (status in ('chosen', 'shortlisted', 'considering', 'on_hold', 'rejected')),
  summary text,
  why_note text, -- why it was parked or rejected
  metadata jsonb not null default '{}'::jsonb, -- contact_person / phone / email
  sort_order int not null default 0,
  source_msg_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_topic_idx on tasks (topic_id);
create index task_options_task_idx on task_options (task_id);

-- Existing planning items become the detail lines (quotes, payments, notes) under a task/option.
-- Shared facts (rows with a slug) stay unlinked.
alter table planning_items
  add column task_id uuid references tasks (id) on delete set null,
  add column option_id uuid references task_options (id) on delete set null;
create index planning_items_task_idx on planning_items (task_id);
create index planning_items_option_idx on planning_items (option_id);

-- Chatter, stickers and other messages that belong to no task.
alter table messages add column is_noise boolean not null default false;

alter table tasks enable row level security;
alter table task_options enable row level security;

create policy "tasks: allowed users" on tasks
  for all to authenticated
  using (is_allowed_user()) with check (is_allowed_user());
create policy "task_options: allowed users" on task_options
  for all to authenticated
  using (is_allowed_user()) with check (is_allowed_user());

create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger task_options_set_updated_at before update on task_options
  for each row execute function set_updated_at();

-- Same audit trail as planning_items (manual for signed-in people, sync for the service role).
create trigger tasks_audit after insert or update or delete on tasks
  for each row execute function audit_row_change();
create trigger task_options_audit after insert or update or delete on task_options
  for each row execute function audit_row_change();

-- Messages that no task, option or item points at and that are not marked as noise.
-- security_invoker so the caller's row-level security still applies.
create view unmapped_messages with (security_invoker = true) as
select m.*
from messages m
where not m.is_noise
  and not exists (select 1 from tasks t where m.msg_id = any (t.source_msg_ids))
  and not exists (select 1 from task_options o where m.msg_id = any (o.source_msg_ids))
  and not exists (select 1 from planning_items p where m.msg_id = any (p.source_msg_ids));

-- messages has no update policy for browsers, so marking noise goes through this function.
create or replace function set_messages_noise(p_msg_ids text[], p_flag boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_allowed_user() then
    raise exception 'not allowed';
  end if;
  update messages set is_noise = p_flag where msg_id = any (p_msg_ids);
end;
$$;
revoke execute on function set_messages_noise(text[], boolean) from public, anon;
grant execute on function set_messages_noise(text[], boolean) to authenticated;

-- The supabase_realtime publication was empty, so the app's live-update subscriptions never fired.
alter publication supabase_realtime add table planning_items, tasks, task_options;
