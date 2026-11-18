import { useCallback, useState } from 'react';
import { useRealtime } from './useRealtime';
import { supabase } from '../lib/supabase';
import type { RoomStay, StayRoom } from '../lib/rooms';

// The rooms at each place and which households sleep in them (ids and head counts only). Updates live.
export function useRoomBoard() {
  const [rooms, setRooms] = useState<StayRoom[]>([]);
  const [roomStays, setRoomStays] = useState<RoomStay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.from('stay_rooms').select('*').order('sort_order'),
      supabase.from('room_stays').select('id, room_id, guest_id, people, extra_nights, check_in, check_out, locked'),
    ]);
    const failed = r.error ?? s.error;
    setLoaded(true);
    if (failed) {
      setLoadError(failed.message);
      return;
    }
    setLoadError(null);
    setRooms((r.data ?? []) as StayRoom[]);
    setRoomStays((s.data ?? []) as RoomStay[]);
  }, []);

  useRealtime(['stay_rooms', 'room_stays'], reload, { immediate: true });

  return { rooms, roomStays, loaded, loadError, reload };
}
