-- Pinned stays: a household's stay in a room can be pinned, so "Suggest layout" on the room board never moves it.
--   room_stays.locked: true when someone chose this room on purpose (a grandparent on the ground floor, a family
--                      next to the couple). The suggestion keeps pinned stays exactly as they are and plans around them.
-- Stays with their own head count, own dates or extra nights are also kept by the suggestion, pinned or not.
-- Additive: one new column with a default, so the deployed app keeps working.

alter table room_stays add column if not exists locked boolean not null default false;
