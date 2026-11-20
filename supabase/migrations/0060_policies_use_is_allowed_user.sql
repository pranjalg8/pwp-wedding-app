-- Housekeeping: the older access rules still spell out "auth.uid() in (select id from profiles)". They now call
-- is_allowed_user() like every rule written since, which checks exactly the same thing (a row in profiles for the
-- signed-in user). The two wedding_functions rules also move from role public to authenticated, like the rest.
-- No one gains or loses access. Rules with extra conditions (swipe decks behind feature_access, own swipes) keep
-- them; only the profiles check inside is swapped.

alter policy "audit_log: allowed profiles can read" on audit_log using (is_allowed_user());
alter policy "messages: allowed profiles can read" on messages using (is_allowed_user());
alter policy "topics: allowed profiles can read" on topics using (is_allowed_user());

alter policy "payments: allowed profiles can read" on payments using (is_allowed_user());
alter policy "payments: allowed profiles can write" on payments using (is_allowed_user()) with check (is_allowed_user());

alter policy "planning_items: allowed profiles can read" on planning_items using (is_allowed_user());
alter policy "planning_items: allowed profiles can write" on planning_items using (is_allowed_user()) with check (is_allowed_user());

alter policy "wedding_functions: allowed profiles can read" on wedding_functions to authenticated using (is_allowed_user());
alter policy "wedding_functions: allowed profiles can write" on wedding_functions to authenticated
  using (is_allowed_user()) with check (is_allowed_user());

alter policy "swipe_decks: read if allowed" on swipe_decks using (
  is_allowed_user()
  and (feature is null or exists (select 1 from feature_access fa where fa.profile_id = (select auth.uid()) and fa.feature = swipe_decks.feature))
);
alter policy "swipe_cards: read if deck visible" on swipe_cards using (
  is_allowed_user() and exists (select 1 from swipe_decks d where d.id = swipe_cards.deck_id)
);
alter policy "swipes: read if card visible" on swipes using (
  is_allowed_user() and exists (select 1 from swipe_cards c where c.id = swipes.card_id)
);
alter policy "swipes: write own on visible cards" on swipes with check (
  profile_id = (select auth.uid()) and is_allowed_user() and exists (select 1 from swipe_cards c where c.id = swipes.card_id)
);
