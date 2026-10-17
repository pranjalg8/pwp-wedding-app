import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GuestStay } from '../lib/stay';

// Which place each household sleeps at (ids and room counts only, no names). Updates live.
export function useGuestStays() {
  const [stays, setStays] = useState<GuestStay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const channelName = useRef(`guest_stays_${Math.random().toString(36).slice(2)}`);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('guest_stays').select('id, guest_id, site_id, rooms');
    setStays(((data ?? []) as GuestStay[]).map((s) => ({ ...s, rooms: Number(s.rooms) })));
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_stays' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return { stays, loaded, reload };
}
