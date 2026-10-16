import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { StayNight, StaySite } from '../lib/stay';

// The places guests can stay and their rooms per night. Updates live.
export function useStay() {
  const [sites, setSites] = useState<StaySite[]>([]);
  const [nights, setNights] = useState<StayNight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const channelName = useRef(`stay_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let active = true;
    async function load() {
      const [s, n] = await Promise.all([
        supabase.from('stay_sites').select('*').order('sort_order'),
        supabase.from('stay_nights').select('*').order('night'),
      ]);
      if (!active) return;
      setSites((s.data ?? []) as StaySite[]);
      setNights((n.data ?? []) as StayNight[]);
      setLoaded(true);
    }
    load();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stay_sites' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stay_nights' }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { sites, nights, loaded };
}
