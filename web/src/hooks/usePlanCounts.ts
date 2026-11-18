import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { peopleByNight, type PlanCounts } from '../lib/lineBasis';
import { householdsNeedingRooms, occupantsByRoom, type RoomGuest } from '../lib/rooms';
import { guestNightsOf } from '../lib/stay';
import { useGuestInvites } from './useGuestInvites';
import { useLiveData } from './useLiveData';
import { useRoomBoard } from './useRoomBoard';
import { useStay } from './useStay';

const NONE: RoomGuest[] = [];

async function loadGuests() {
  return rowsOf<RoomGuest>(
    await supabase.from('guests').select('id, name, persons, priority, rooms_inside, rooms_outside, needs_lift, family_members, arrive_on, leave_on, sort_order')
  );
}

// The rooms booked and the people on the room board, for checking budget lines against the plan.
export function usePlanCounts(): PlanCounts {
  const { nights } = useStay();
  const { rooms, roomStays } = useRoomBoard();
  const { invites } = useGuestInvites();
  const { data: guests } = useLiveData({ tables: ['guests'], load: loadGuests, initial: NONE });

  return useMemo(() => {
    const guestNights = guestNightsOf(nights, invites);
    const households = householdsNeedingRooms(guests, invites, guestNights);
    const placed = new Map<string, number>();
    for (const s of roomStays) placed.set(s.guest_id, (placed.get(s.guest_id) ?? 0) + 1);
    const complete = households.length > 0 && households.every((h) => (placed.get(h.g.id) ?? 0) >= h.roomsNeeded);
    return { nights, boardPeople: complete ? peopleByNight(rooms, occupantsByRoom(roomStays, households, guests, guestNights)) : null };
  }, [nights, rooms, roomStays, invites, guests]);
}
