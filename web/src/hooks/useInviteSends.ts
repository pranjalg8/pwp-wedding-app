import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { useRealtime } from './useRealtime';
import type { InviteSend } from '../lib/invites';

// Every invite, reminder and save-the-date sent (ids, dates and who; no names or numbers). Updates live.
export function useInviteSends() {
  const [sends, setSends] = useState<InviteSend[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error } = await fetchAll((from, to) =>
      supabase.from('invite_sends').select('id, guest_id, kind, channel, sent_by, sent_by_uid, sent_at, note').order('id').range(from, to)
    );
    if (!isActive()) return;
    setLoadError(error?.message ?? null);
    if (error) return; // keep what is on screen
    setSends((data ?? []) as InviteSend[]);
  }, []);

  useRealtime(['invite_sends'], load, { immediate: true });
  const reload = useCallback(() => load(() => true), [load]);
  return { sends, loadError, reload };
}
