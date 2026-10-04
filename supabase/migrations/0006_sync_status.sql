-- One row updated by every sync run (even when nothing new arrived), so the app can
-- show how fresh the chat data really is.
create table sync_status (
  id int primary key default 1,
  last_run_at timestamptz not null default now(),
  last_new_messages int not null default 0,
  constraint sync_status_single_row check (id = 1)
);

alter table sync_status enable row level security;

create policy "sync_status: allowed users can read" on sync_status
  for select
  using (is_allowed_user());
