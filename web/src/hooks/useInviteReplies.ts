import { supabase } from '../lib/supabase';
import { oneOf, rowsOf } from '../lib/liveData';
import { useLiveData } from './useLiveData';
import type { InviteCode, InviteReply } from '../lib/replies';

export type InviteSettings = { open: boolean; site_url: string | null };

const EMPTY = { codes: [] as InviteCode[], replies: [] as InviteReply[], settings: { open: false, site_url: null } as InviteSettings };

async function loadReplies() {
  const [c, r, s] = await Promise.all([
    supabase.from('invite_codes').select('code, guest_id, revoked_at'),
    supabase.from('invite_responses').select('*').order('submitted_at', { ascending: false }),
    supabase.from('invite_settings').select('open, site_url').maybeSingle(),
  ]);
  return { codes: rowsOf<InviteCode>(c), replies: rowsOf<InviteReply>(r), settings: oneOf<InviteSettings>(s) ?? EMPTY.settings };
}

// Personal-link codes, the replies that came in through them, and whether replies are open. Updates live.
export function useInviteReplies() {
  const { data, loaded, loadError, reload } = useLiveData({ tables: ['invite_codes', 'invite_responses', 'invite_settings'], load: loadReplies, initial: EMPTY });
  return { ...data, loaded, loadError, reload };
}
