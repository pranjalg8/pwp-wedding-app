import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { totalsByDay, type InviteWithSize } from '../lib/rsvp';
import { useRealtime } from './useRealtime';
import { fetchAll } from '../lib/fetchAll';

// One row per household per day, so this passes the 1000-row response cap with a few hundred households.
const fetchInvites = () =>
  fetchAll((from, to) => supabase.from('guest_rsvps').select('id, guest_id, event_date, coming, maybe, declined, guests(persons)').order('id').range(from, to));

// All RSVP rows (ids and statuses only, no names) plus per-day headcounts. Updates live.
export function useGuestInvites() {
  const [invites, setInvites] = useState<InviteWithSize[]>([]);
  const [loaded, setLoaded] = useState(false);

  useRealtime(
    ['guest_rsvps', 'guests'],
    async (isActive) => {
      const { data } = await fetchInvites();
      if (!isActive()) return;
      setInvites((data ?? []) as unknown as InviteWithSize[]);
      setLoaded(true);
    },
    { immediate: true }
  );

  const totals = useMemo(() => totalsByDay(invites), [invites]);
  const reload = useCallback(async () => {
    const { data } = await fetchInvites();
    setInvites((data ?? []) as unknown as InviteWithSize[]);
  }, []);
  return { invites, totals, loaded, reload };
}
