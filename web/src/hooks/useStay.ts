import { supabase } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { useLiveData } from './useLiveData';
import type { StayNight, StaySite } from '../lib/stay';

const EMPTY = { sites: [] as StaySite[], nights: [] as StayNight[] };

async function loadStay() {
  const [s, n] = await Promise.all([
    supabase.from('stay_sites').select('*').order('sort_order'),
    supabase.from('stay_nights').select('*').order('night'),
  ]);
  return { sites: rowsOf<StaySite>(s), nights: rowsOf<StayNight>(n) };
}

// The places guests can stay and their rooms per night. Updates live.
export function useStay() {
  const { data, loaded, loadError, reload } = useLiveData({ tables: ['stay_sites', 'stay_nights'], load: loadStay, initial: EMPTY });
  return { ...data, loaded, loadError, reload };
}
