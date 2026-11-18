import { useCallback, useState } from 'react';
import { useRealtime } from './useRealtime';
import { supabase } from '../lib/supabase';
import { firstError } from '../lib/loadState';
import type { InviteCode, InviteReply } from '../lib/replies';

export type InviteSettings = { open: boolean; site_url: string | null };

// Personal-link codes, the replies that came in through them, and whether replies are open. Updates live.
export function useInviteReplies() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [replies, setReplies] = useState<InviteReply[]>([]);
  const [settings, setSettings] = useState<InviteSettings>({ open: false, site_url: null });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [c, r, s] = await Promise.all([
      supabase.from('invite_codes').select('code, guest_id, revoked_at'),
      supabase.from('invite_responses').select('*').order('submitted_at', { ascending: false }),
      supabase.from('invite_settings').select('open, site_url').maybeSingle(),
    ]);
    const failed = firstError(c, r, s);
    setLoadError(failed);
    setLoaded(true);
    if (failed) return; // keep what is on screen
    setCodes((c.data ?? []) as InviteCode[]);
    setReplies((r.data ?? []) as InviteReply[]);
    if (s.data) setSettings(s.data as InviteSettings);
  }, []);

  useRealtime(['invite_codes', 'invite_responses', 'invite_settings'], reload, { immediate: true });

  return { codes, replies, settings, loaded, loadError, reload };
}
