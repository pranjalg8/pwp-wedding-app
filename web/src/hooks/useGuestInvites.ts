import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { totalsByDay, type InviteWithSize } from '../lib/rsvp';

// All RSVP rows (ids and statuses only, no names) plus per-day headcounts. Updates live.
export function useGuestInvites() {
  const [invites, setInvites] = useState<InviteWithSize[]>([]);
  const [loaded, setLoaded] = useState(false);
  const channelName = useRef(`guest_rsvps_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.from('guest_rsvps').select('id, guest_id, event_date, coming, maybe, declined, guests(persons)');
      if (!active) return;
      setInvites((data ?? []) as unknown as InviteWithSize[]);
      setLoaded(true);
    }
    load();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_rsvps' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const totals = useMemo(() => totalsByDay(invites), [invites]);
  const reload = async () => {
    const { data } = await supabase.from('guest_rsvps').select('id, guest_id, event_date, coming, maybe, declined, guests(persons)');
    setInvites((data ?? []) as unknown as InviteWithSize[]);
  };
  return { invites, totals, loaded, reload };
}
