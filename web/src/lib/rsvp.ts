// What people said, as a vocabulary shared by the bar, the cells and the totals. 'invited' means no reply yet.
export type InviteStatus = 'invited' | 'confirmed' | 'maybe' | 'declined';

// One household's answer for one function, as counts of people. Whoever is not in coming, maybe or declined
// has not replied. The database keeps coming + maybe + declined within the household size.
export type Invite = {
  id: string;
  guest_id: string;
  function_id: string;
  coming: number;
  maybe: number;
  declined: number;
};

// An invite row joined with the household's size, so headcounts need no second query.
export type InviteWithSize = Invite & { guests: { persons: number } | null };

export const INVITE_LABEL: Record<InviteStatus, string> = {
  invited: 'No reply yet',
  confirmed: 'Yes',
  maybe: 'Maybe',
  declined: 'No',
};

export const INVITE_COLOR: Record<InviteStatus, string> = {
  invited: 'gray',
  confirmed: 'teal',
  maybe: 'yellow',
  declined: 'red',
};

export const INVITE_ORDER: InviteStatus[] = ['confirmed', 'maybe', 'declined', 'invited'];

// People, not households.
export type RsvpTotals = Record<InviteStatus, number> & { households: number };

export const emptyTotals = (): RsvpTotals => ({ invited: 0, confirmed: 0, maybe: 0, declined: 0, households: 0 });

export type Split = { coming: number; maybe: number; declined: number; noReply: number };

export function splitOf(invite: Pick<InviteWithSize, 'coming' | 'maybe' | 'declined' | 'guests'>): Split {
  const household = invite.guests?.persons ?? 0;
  const noReply = Math.max(0, household - invite.coming - invite.maybe - invite.declined);
  return { coming: invite.coming, maybe: invite.maybe, declined: invite.declined, noReply };
}

export function totalsByFunction(invites: InviteWithSize[]): Record<string, RsvpTotals> {
  const out: Record<string, RsvpTotals> = {};
  for (const i of invites) {
    const t = (out[i.function_id] ??= emptyTotals());
    const s = splitOf(i);
    t.confirmed += s.coming;
    t.maybe += s.maybe;
    t.declined += s.declined;
    t.invited += s.noReply;
    t.households += 1;
  }
  return out;
}

export const answered = (t: RsvpTotals) => t.confirmed + t.maybe + t.declined;
export const invitedPeople = (t: RsvpTotals) => answered(t) + t.invited;

// How many of a household's people might stay, across all functions it is invited to. Not invited anywhere
// means no information, so the whole household is assumed. "most" assumes everyone who has not said no comes;
// "least" counts only those who said yes (for the function with the most yeses).
export function stayRange(persons: number, invites: Pick<Invite, 'coming' | 'declined'>[]) {
  if (invites.length === 0) return { most: persons, least: persons };
  const fewestNo = Math.min(...invites.map((i) => i.declined));
  const mostYes = Math.max(...invites.map((i) => i.coming));
  return { most: Math.max(0, persons - fewestNo), least: Math.min(persons, mostYes) };
}

// Rooms scale with the share of the household that might come, rounded up to a half room.
export const scaleRooms = (rooms: number, persons: number, people: number) =>
  persons > 0 ? Math.ceil((rooms * people * 2) / persons) / 2 : 0;
