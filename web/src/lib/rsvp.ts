export type InviteStatus = 'invited' | 'confirmed' | 'maybe' | 'declined';

export type Invite = {
  id: string;
  guest_id: string;
  function_id: string;
  status: InviteStatus;
  persons_attending: number | null;
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

// People, not households. confirmed/maybe count the people attending (the whole household unless a number was
// set); declined and no-reply count the whole household.
export type RsvpTotals = Record<InviteStatus, number> & { households: number };

export const emptyTotals = (): RsvpTotals => ({ invited: 0, confirmed: 0, maybe: 0, declined: 0, households: 0 });

export function peopleFor(invite: InviteWithSize): number {
  const household = invite.guests?.persons ?? 0;
  return invite.status === 'confirmed' || invite.status === 'maybe' ? (invite.persons_attending ?? household) : household;
}

export function totalsByFunction(invites: InviteWithSize[]): Record<string, RsvpTotals> {
  const out: Record<string, RsvpTotals> = {};
  for (const i of invites) {
    const t = (out[i.function_id] ??= emptyTotals());
    t[i.status] += peopleFor(i);
    t.households += 1;
  }
  return out;
}

export const answered = (t: RsvpTotals) => t.confirmed + t.maybe + t.declined;
export const invitedPeople = (t: RsvpTotals) => answered(t) + t.invited;
