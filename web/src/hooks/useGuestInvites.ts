import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { totalsByDay, type InviteWithSize } from '../lib/rsvp';
import { useLiveData } from './useLiveData';

const NONE: InviteWithSize[] = [];

async function loadInvites() {
  return rowsOf<InviteWithSize>(await supabase.from('guest_rsvps').select('id, guest_id, event_date, coming, maybe, declined, guests(persons)'));
}

// All RSVP rows (ids and statuses only, no names) plus per-day headcounts. Updates live.
export function useGuestInvites() {
  const { data: invites, loaded, loadError, reload } = useLiveData({ tables: ['guest_rsvps', 'guests'], load: loadInvites, initial: NONE });
  const totals = useMemo(() => totalsByDay(invites), [invites]);
  return { invites, totals, loaded, loadError, reload };
}
