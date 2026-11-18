import { useCallback, useState } from 'react';
import { useRealtime } from './useRealtime';
import { supabase } from '../lib/supabase';
import { firstError } from '../lib/loadState';
import type { StayNight, StaySite } from '../lib/stay';

// The places guests can stay and their rooms per night. Updates live.
export function useStay() {
  const [sites, setSites] = useState<StaySite[]>([]);
  const [nights, setNights] = useState<StayNight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    const [s, n] = await Promise.all([
      supabase.from('stay_sites').select('*').order('sort_order'),
      supabase.from('stay_nights').select('*').order('night'),
    ]);
    if (!isActive()) return;
    const failed = firstError(s, n);
    setLoadError(failed);
    setLoaded(true);
    if (failed) return; // keep what is on screen
    setSites((s.data ?? []) as StaySite[]);
    setNights((n.data ?? []) as StayNight[]);
  }, []);

  useRealtime(['stay_sites', 'stay_nights'], load, { immediate: true });
  const reload = useCallback(() => load(() => true), [load]);

  return { sites, nights, loaded, loadError, reload };
}
