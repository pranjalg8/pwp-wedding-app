-- Shared plan values (event dates, honeymoon budget cap, chosen route) live in planning_items as named rows,
-- so every page, both of you, and the WhatsApp extraction read one source of truth.
-- Slugs in use: dates.wedding, dates.haldi, dates.mehndi, dates.reception, dates.honeymoon (metadata start/end,
-- ISO dates), honeymoon.budget (amount = cap in rupees), honeymoon.route (metadata.value = route id).
alter table planning_items add column if not exists slug text;
create unique index if not exists planning_items_slug_key on planning_items (slug) where slug is not null;
comment on column planning_items.slug is 'Stable key for a shared plan value read by the app (see web/src/lib/planFacts.ts). Null for ordinary items.';
