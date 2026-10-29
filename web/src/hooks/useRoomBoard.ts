import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RoomStay, StayRoom } from '../lib/rooms';

// The rooms at each place and which households sleep in them (ids and head counts only). Updates live.
export function useRoomBoard() {
  const [rooms, setRooms] = useState<StayRoom[]>([]);
  const [roomStays, setRoomStays] = useState<RoomStay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const channelName = useRef(`room_board_${Math.random().toString(36).slice(2)}`);

  const reload = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.from('stay_rooms').select('*').order('sort_order'),
      supabase.from('room_stays').select('id, room_id, guest_id, people'),
    ]);
    setRooms((r.data ?? []) as StayRoom[]);
    setRoomStays((s.data ?? []) as RoomStay[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stay_rooms' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return { rooms, roomStays, loaded, reload };
}
