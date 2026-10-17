import { splitOf, type Invite } from './rsvp';

// Where a household stands overall, in one word, so the summary, the quick views and the list all agree.
// Each household is in exactly one of these, so the counts add up to the whole list.
export type HouseholdStatus = 'not_invited' | 'waiting' | 'coming' | 'maybe' | 'declined';
export type HouseholdView = 'all' | HouseholdStatus;

export const STATUS_ORDER: HouseholdStatus[] = ['coming', 'maybe', 'declined', 'waiting', 'not_invited'];

export const STATUS_LABEL: Record<HouseholdStatus, string> = {
  not_invited: 'Not invited yet',
  waiting: 'Waiting for a reply',
  coming: 'Coming',
  maybe: 'Maybe',
  declined: 'Not coming',
};

export const STATUS_COLOR: Record<HouseholdStatus, string> = {
  not_invited: 'gray',
  waiting: 'blue',
  coming: 'teal',
  maybe: 'yellow',
  declined: 'red',
};

// Not invited to any day, or: anyone still to reply on any day means waiting; once everyone has replied it is
// coming if anyone is coming on any day, otherwise maybe if anyone is unsure, otherwise not coming.
export function householdStatus(persons: number, invites: Pick<Invite, 'coming' | 'maybe' | 'declined'>[]): HouseholdStatus {
  if (invites.length === 0) return 'not_invited';
  const splits = invites.map((i) => splitOf({ ...i, guests: { persons } }));
  if (splits.some((s) => s.noReply > 0)) return 'waiting';
  if (splits.some((s) => s.coming > 0)) return 'coming';
  if (splits.some((s) => s.maybe > 0)) return 'maybe';
  return 'declined';
}

export type StatusCounts = Record<HouseholdStatus, { households: number; people: number }>;

export function countByStatus(guests: { id: string; persons: number }[], invites: Pick<Invite, 'guest_id' | 'coming' | 'maybe' | 'declined'>[]) {
  const byGuest = new Map<string, typeof invites>();
  for (const i of invites) byGuest.set(i.guest_id, [...(byGuest.get(i.guest_id) ?? []), i]);
  const counts: StatusCounts = {
    not_invited: { households: 0, people: 0 },
    waiting: { households: 0, people: 0 },
    coming: { households: 0, people: 0 },
    maybe: { households: 0, people: 0 },
    declined: { households: 0, people: 0 },
  };
  const statusById: Record<string, HouseholdStatus> = {};
  for (const g of guests) {
    const s = householdStatus(g.persons, byGuest.get(g.id) ?? []);
    statusById[g.id] = s;
    counts[s].households += 1;
    counts[s].people += g.persons;
  }
  return { counts, statusById };
}
