import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { totalsByDay, type InviteWithSize } from '../lib/rsvp';
import { useRealtime } from './useRealtime';
import { fetchAll } from '../lib/fetchAll';

// One row per household per day, so this passes the 1000-row response cap with a few hundred households.
const fetchInvites = () =>
  fetchAll((from, to) => supabase.from('guest_rsvps').select('id, guest_id, event_date, coming, maybe, declined, part, guests(persons)').order('id').range(from, to));

// All RSVP rows (ids and statuses only, no names) plus per-day headcounts. Updates live.
export function useGuestInvites() {
  const [invites, setInvites] = useState<InviteWithSize[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error } = await fetchInvites();
    if (!isActive()) return;
    setLoadError(error?.message ?? null);
    setLoaded(true);
    if (error) return; // keep what is on screen
    setInvites((data ?? []) as unknown as InviteWithSize[]);
  }, []);

  useRealtime(['guest_rsvps', 'guests'], load, { immediate: true });
  const reload = useCallback(() => load(() => true), [load]);

  const totals = useMemo(() => totalsByDay(invites), [invites]);
  return { invites, totals, loaded, loadError, reload };
}
