-- Invite replies: households answer from their personal link on the invite site, and the couple reviews each reply
-- before it changes the guest list.
--
--   invite_codes:     one short random code per household; the personal link is <invite site>/?code=<code>.
--   invite_responses: every reply, append only. The answers, dates and note never change after they arrive; only
--                     the review fields (status, reviewed_at, reviewed_by) do. Nothing is copied into guest_rsvps
--                     until the couple presses Apply.
--   invite_rate:      hits per code and per hashed IP per hour, for the edge function's rate limit.
--   invite_settings:  one row; replies are accepted only while open is true. It starts closed. site_url is where
--                     the invite site is published, for building the personal links; empty until it is published.
--
-- The public never touches these tables: there are no policies for anon. Only the invite-rsvp edge function
-- (service role) inserts replies. The two allowed profiles read everything and can make codes and review replies.

create table invite_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6,10}$'),
  guest_id uuid not null unique references guests (id) on delete cascade,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invite_responses (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  code text not null,
  responder_name text not null check (char_length(responder_name) between 1 and 80),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'), -- { "2027-02-14": { "answer": "yes", "people": 3 } }
  arrive_on date,           -- the first night they need a bed
  leave_on date,            -- the morning they leave
  travel text check (char_length(travel) <= 120),
  note text check (char_length(note) <= 300),
  status text not null default 'new' check (status in ('new', 'applied', 'dismissed')),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles (id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (leave_on is null or arrive_on is null or leave_on > arrive_on)
);

create index invite_responses_guest_idx on invite_responses (guest_id, submitted_at desc);
create index invite_responses_new_idx on invite_responses (submitted_at desc) where status = 'new';

create table invite_rate (
  bucket text not null,     -- 'code:K7M2QX' or 'ip:<sha256>'
  hour timestamptz not null,
  hits int not null default 0,
  primary key (bucket, hour)
);

create table invite_settings (
  id boolean primary key default true check (id),
  open boolean not null default false,
  site_url text check (site_url is null or site_url ~ '^https://[^\s]+$'),
  updated_at timestamptz not null default now()
);
insert into invite_settings (id, open) values (true, false);

-- Replies are a record of what a household said: only the review fields may change.
create or replace function invite_responses_keep_answers()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if (to_jsonb(new) - array['status', 'reviewed_at', 'reviewed_by', 'updated_at'])
     is distinct from (to_jsonb(old) - array['status', 'reviewed_at', 'reviewed_by', 'updated_at']) then
    raise exception 'A reply cannot be changed, only reviewed';
  end if;
  return new;
end;
$$;

create trigger invite_responses_keep_answers before update on invite_responses
  for each row execute function invite_responses_keep_answers();

alter table invite_codes enable row level security;
alter table invite_responses enable row level security;
alter table invite_rate enable row level security;
alter table invite_settings enable row level security;

create policy "invite_codes: allowed profiles can read" on invite_codes
  for select to authenticated using (is_allowed_user());
create policy "invite_codes: allowed profiles can write" on invite_codes
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

-- No insert or delete for signed-in users: replies only arrive through the edge function.
create policy "invite_responses: allowed profiles can read" on invite_responses
  for select to authenticated using (is_allowed_user());
create policy "invite_responses: allowed profiles can review" on invite_responses
  for update to authenticated using (is_allowed_user()) with check (is_allowed_user());

create policy "invite_settings: allowed profiles can read" on invite_settings
  for select to authenticated using (is_allowed_user());
create policy "invite_settings: allowed profiles can change" on invite_settings
  for update to authenticated using (is_allowed_user()) with check (is_allowed_user());

-- invite_rate: no policies at all; only the service role uses it.

create trigger invite_codes_set_updated_at before update on invite_codes
  for each row execute function set_updated_at();
create trigger invite_responses_set_updated_at before update on invite_responses
  for each row execute function set_updated_at();
create trigger invite_settings_set_updated_at before update on invite_settings
  for each row execute function set_updated_at();
create trigger invite_codes_audit after insert or update or delete on invite_codes
  for each row execute function audit_row_change();
create trigger invite_responses_audit after insert or update or delete on invite_responses
  for each row execute function audit_row_change();
create trigger invite_settings_audit after insert or update or delete on invite_settings
  for each row execute function audit_row_change();

alter publication supabase_realtime add table invite_codes, invite_responses, invite_settings;

-- Count one hit for a bucket this hour and return the new total. Used only by the edge function.
create or replace function invite_rate_hit(p_bucket text)
returns int
language sql
security definer
set search_path to 'public'
as $$
  insert into invite_rate (bucket, hour, hits)
  values (p_bucket, date_trunc('hour', now()), 1)
  on conflict (bucket, hour) do update set hits = invite_rate.hits + 1
  returning hits;
$$;
revoke all on function invite_rate_hit(text) from public, anon, authenticated;
grant execute on function invite_rate_hit(text) to service_role;
