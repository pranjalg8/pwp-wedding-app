-- Gift wishlist: things we want for the new home, which friends can browse and mark as "I'll gift this".
--
--   wishlist_items:    one row per product (a store link and/or a picture, with a price range). hidden rows are drafts
--                      that friends never see.
--   wishlist_claims:   a friend marking an item as taken. Only the claim's secret is kept (as a hash) so the friend
--                      can undo it from the same phone; the planner shows who claimed what, friends never see names.
--   wishlist_settings: one row; the public page shows nothing while open is false. It starts closed.
--
-- The public never touches these tables: there are no policies for anon. The wishlist edge function (service role)
-- lists items and records claims through wishlist_claim / wishlist_unclaim, which lock the item so two people can
-- not both take the last one. The two allowed profiles manage everything. Pictures uploaded from the planner go in
-- the public 'wishlist' storage bucket.

create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  note text check (note is null or char_length(note) <= 500),
  category text not null default 'Other' check (char_length(category) between 1 and 40),
  url text check (url is null or url ~ '^https?://[^[:space:]]{1,2000}$'),
  image_url text check (image_url is null or image_url ~ '^https?://[^[:space:]]{1,2000}$'),
  price_min int check (price_min is null or price_min >= 0),
  price_max int check (price_max is null or price_max >= 0),
  quantity int not null default 1 check (quantity between 1 and 20),
  hidden boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wishlist_price_order check (price_min is null or price_max is null or price_max >= price_min)
);
create index wishlist_items_order_idx on wishlist_items (sort_order, created_at);

create table wishlist_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references wishlist_items (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null,
  created_at timestamptz not null default now()
);
create index wishlist_claims_item_idx on wishlist_claims (item_id);

create table wishlist_settings (
  id boolean primary key default true check (id),
  open boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into wishlist_settings (id) values (true);

alter table wishlist_items enable row level security;
alter table wishlist_claims enable row level security;
alter table wishlist_settings enable row level security;

create policy "wishlist_items: allowed profiles can read" on wishlist_items
  for select to authenticated using (is_allowed_user());
create policy "wishlist_items: allowed profiles can write" on wishlist_items
  for all to authenticated using (is_allowed_user()) with check (is_allowed_user());

-- The couple can see and remove a claim (say, someone claimed by mistake). Claims are only made through the function.
create policy "wishlist_claims: allowed profiles can read" on wishlist_claims
  for select to authenticated using (is_allowed_user());
create policy "wishlist_claims: allowed profiles can remove" on wishlist_claims
  for delete to authenticated using (is_allowed_user());

create policy "wishlist_settings: allowed profiles can read" on wishlist_settings
  for select to authenticated using (is_allowed_user());
create policy "wishlist_settings: allowed profiles can update" on wishlist_settings
  for update to authenticated using (is_allowed_user()) with check (is_allowed_user());

create trigger wishlist_items_set_updated_at before update on wishlist_items
  for each row execute function set_updated_at();
create trigger wishlist_settings_set_updated_at before update on wishlist_settings
  for each row execute function set_updated_at();
create trigger wishlist_items_audit after insert or update or delete on wishlist_items
  for each row execute function audit_row_change();

-- Take one of an item's places. Returns 'ok', 'taken' (none left) or 'missing' (no such visible item).
create or replace function wishlist_claim(p_item uuid, p_name text, p_token_hash text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  want int;
  have int;
begin
  select quantity into want from wishlist_items where id = p_item and not hidden for update;
  if not found then return 'missing'; end if;
  select count(*) into have from wishlist_claims where item_id = p_item;
  if have >= want then return 'taken'; end if;
  insert into wishlist_claims (item_id, name, token_hash) values (p_item, p_name, p_token_hash);
  return 'ok';
end;
$$;

-- Give a place back, only for the claim that was made with this secret. Returns true when a claim was removed.
create or replace function wishlist_unclaim(p_item uuid, p_token_hash text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with gone as (
    delete from wishlist_claims where item_id = p_item and token_hash = p_token_hash returning 1
  )
  select exists (select 1 from gone);
$$;

revoke all on function wishlist_claim(uuid, text, text) from public, anon, authenticated;
revoke all on function wishlist_unclaim(uuid, text) from public, anon, authenticated;
grant execute on function wishlist_claim(uuid, text, text) to service_role;
grant execute on function wishlist_unclaim(uuid, text) to service_role;

alter publication supabase_realtime add table wishlist_items, wishlist_claims, wishlist_settings;

-- Pictures uploaded from the planner. Public to read (the pictures are on the public wishlist anyway), only the two
-- allowed profiles can add, replace or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist', 'wishlist', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "wishlist pictures: allowed profiles can add" on storage.objects
  for insert to authenticated with check (bucket_id = 'wishlist' and is_allowed_user());
create policy "wishlist pictures: allowed profiles can replace" on storage.objects
  for update to authenticated using (bucket_id = 'wishlist' and is_allowed_user()) with check (bucket_id = 'wishlist' and is_allowed_user());
create policy "wishlist pictures: allowed profiles can remove" on storage.objects
  for delete to authenticated using (bucket_id = 'wishlist' and is_allowed_user());
