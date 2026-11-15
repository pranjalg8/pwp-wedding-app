import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { InviteCode, InviteReply } from '../lib/replies';

export type InviteSettings = { open: boolean; site_url: string | null };

// Personal-link codes, the replies that came in through them, and whether replies are open. Updates live.
export function useInviteReplies() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [replies, setReplies] = useState<InviteReply[]>([]);
  const [settings, setSettings] = useState<InviteSettings>({ open: false, site_url: null });
  const [loaded, setLoaded] = useState(false);
  const channelName = useRef(`invite_replies_${Math.random().toString(36).slice(2)}`);

  const reload = useCallback(async () => {
    const [c, r, s] = await Promise.all([
      supabase.from('invite_codes').select('code, guest_id, revoked_at'),
      supabase.from('invite_responses').select('*').order('submitted_at', { ascending: false }),
      supabase.from('invite_settings').select('open, site_url').maybeSingle(),
    ]);
    setCodes((c.data ?? []) as InviteCode[]);
    setReplies((r.data ?? []) as InviteReply[]);
    if (s.data) setSettings(s.data as InviteSettings);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invite_codes' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invite_responses' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invite_settings' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return { codes, replies, settings, loaded, reload };
}
