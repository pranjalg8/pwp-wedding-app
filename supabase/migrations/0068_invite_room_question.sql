-- Room question on the RSVP for Pranjal's friends and colleagues (households handled by Pranjal).
-- Papa's room plan covers the family; friends were left out of it, so their replies now say plainly whether they need
-- a room. The nights they pick are still stored as arrive_on / leave_on, so Apply and the room board work unchanged.
--
--   needs_room: true = wants a room, false = heading home after, null = the household was not asked.
--   room_share: a guest coming alone who is happy to share a room with another friend; null when not asked.
--
-- Both are written once with the reply, like the other answers (invite_responses_keep_answers covers them).

alter table invite_responses
  add column needs_room boolean,
  add column room_share boolean,
  add constraint invite_responses_room_nights check (needs_room is not true or (arrive_on is not null and leave_on is not null)),
  add constraint invite_responses_room_share check (room_share is null or needs_room is true);
