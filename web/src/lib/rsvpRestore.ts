import { supabase } from './supabase';

// Kept apart from lib/rsvp.ts so that file stays free of the database client and testable on its own.

// What the households' invites looked like before a bulk change, so the change can be undone.
export type InviteSnapshot = { guestIds: string[]; rows: { guest_id: string; event_date: string; coming: number; maybe: number; declined: number }[] };

// Put the selected households' invites back exactly as they were: clear what is there now, then restore the snapshot.
export async function restoreInvites(snapshot: InviteSnapshot): Promise<string | null> {
  const del = await supabase.from('guest_rsvps').delete().in('guest_id', snapshot.guestIds);
  if (del.error) return del.error.message;
  if (snapshot.rows.length > 0) {
    const ins = await supabase.from('guest_rsvps').insert(snapshot.rows);
    if (ins.error) return ins.error.message;
  }
  return null;
}
