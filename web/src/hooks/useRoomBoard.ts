import { supabase } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { useLiveData } from './useLiveData';
import type { RoomStay, StayRoom } from '../lib/rooms';

const EMPTY = { rooms: [] as StayRoom[], roomStays: [] as RoomStay[] };

async function loadBoard() {
  const [r, s] = await Promise.all([
    supabase.from('stay_rooms').select('*').order('sort_order'),
    supabase.from('room_stays').select('id, room_id, guest_id, people, extra_nights, check_in, check_out, locked'),
  ]);
  return { rooms: rowsOf<StayRoom>(r), roomStays: rowsOf<RoomStay>(s) };
}

// The rooms at each place and which households sleep in them (ids and head counts only). Updates live.
export function useRoomBoard() {
  const { data, loaded, loadError, reload } = useLiveData({ tables: ['stay_rooms', 'room_stays'], load: loadBoard, initial: EMPTY });
  return { ...data, loaded, loadError, reload };
}
