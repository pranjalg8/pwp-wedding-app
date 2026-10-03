-- Run once after 0001_init.sql. Safe to re-run (ON CONFLICT DO NOTHING).

insert into topics (key, label, chat_match, sort_order) values
  ('dates_logistics', 'Dates & Logistics', 'Preparations', 0),
  ('jewellery', 'Jewellery', 'jewellery', 1),
  ('outfits', 'Outfits', 'outfits', 2),
  ('decor', 'Decor & Theme', 'decor', 3),
  ('photography', 'Photography', 'photography', 4),
  ('mehndi', 'Mehndi', 'mehndi', 5),
  ('dance', 'Dance', 'dance', 6),
  ('events', 'Events & Games', 'events', 7),
  ('accommodations', 'Accommodations', 'accomodations', 8),
  ('gifts', 'Gifts', 'gifts', 9),
  ('shopping', 'Shopping', 'shopping', 10),
  ('reception', 'Reception', 'reception', 11),
  ('honeymoon', 'Honeymoon', 'honeymoon', 12),
  ('post_wedding', 'Post-Wedding / New Home', 'post-wedding', 13)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------
-- profiles cannot be seeded here: they reference auth.users(id), which
-- only exist once each person has signed in via magic link at least once.
--
-- After Pranjal and Paridhi have both completed one login attempt
-- (Supabase Dashboard -> Authentication -> Users will show both, even if
-- the app then rejects them pre-profile), run for each:
--
--   insert into profiles (id, email, display_name)
--   values ('<auth.users.id>', '<email>', '<display name>');
-- -----------------------------------------------------------------------

-- -----------------------------------------------------------------------
-- Setting the admin PIN (do NOT commit the real PIN to git):
--
--   update app_secrets set pin_hash = crypt('<the real PIN>', gen_salt('bf'))
--   where id = 1;
--   -- if no row exists yet:
--   insert into app_secrets (id, pin_hash) values (1, crypt('<the real PIN>', gen_salt('bf')));
-- -----------------------------------------------------------------------
