import { useState } from 'react';
import { useRealtime } from './useRealtime';
import { supabase } from '../lib/supabase';
import type { StayNight, StaySite } from '../lib/stay';

// The places guests can stay and their rooms per night. Updates live.
export function useStay() {
  const [sites, setSites] = useState<StaySite[]>([]);
  const [nights, setNights] = useState<StayNight[]>([]);
  const [loaded, setLoaded] = useState(false);

  useRealtime(
    ['stay_sites', 'stay_nights'],
    async (isActive) => {
      const [s, n] = await Promise.all([
        supabase.from('stay_sites').select('*').order('sort_order'),
        supabase.from('stay_nights').select('*').order('night'),
      ]);
      if (!isActive()) return;
      setSites((s.data ?? []) as StaySite[]);
      setNights((n.data ?? []) as StayNight[]);
      setLoaded(true);
    },
    { immediate: true }
  );

  return { sites, nights, loaded };
}
