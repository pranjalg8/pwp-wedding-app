import { scaleRooms, type Invite } from './rsvp';

export type StaySite = {
  id: string;
  name: string;
  role: 'main' | 'other';
  sort_order: number;
  has_lift: boolean;
  floors: string | null;
  people_per_room: string | null;
  distance_note: string | null;
  booking_note: string | null;
  notes: string | null;
};

export type StayNight = { id: string; site_id: string; night: string; rooms: number };

type GuestRooms = { id: string; persons: number; rooms_inside: number | string; rooms_outside: number | string };

// Rooms the households need on a night, split the way the guest list splits them: the main stay ("rooms inside")
// and everywhere else ("rooms outside"). A household that is invited on a day or an earlier one has a bed that
// night: people who come on day 1 stay over to day 2 and keep their rooms, and households that only come on
// day 2 take the extra rooms. The answer of the latest day up to that night decides how many people come.
// "most" drops only those who said no; "least" keeps only the yeses.
export function roomsWanted(guests: GuestRooms[], invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[], night: string, pick: 'most' | 'least') {
  let main = 0;
  let other = 0;
  let households = 0;
  for (const g of guests) {
    const upToNight = invites.filter((i) => i.guest_id === g.id && i.event_date <= night).sort((a, b) => b.event_date.localeCompare(a.event_date));
    const latest = upToNight[0];
    if (!latest) continue;
    const people = pick === 'most' ? Math.max(0, g.persons - latest.declined) : Math.min(g.persons, latest.coming);
    households += 1;
    main += scaleRooms(Number(g.rooms_inside), g.persons, people);
    other += scaleRooms(Number(g.rooms_outside), g.persons, people);
  }
  return { main, other, households };
}

export function roomsAvailable(sites: StaySite[], nights: StayNight[], night: string) {
  const bySite = sites
    .map((s) => ({ site: s, rooms: nights.find((n) => n.site_id === s.id && n.night === night)?.rooms ?? 0 }))
    .filter((x) => x.rooms > 0);
  return {
    main: bySite.filter((x) => x.site.role === 'main').reduce((a, x) => a + x.rooms, 0),
    other: bySite.filter((x) => x.site.role === 'other').reduce((a, x) => a + x.rooms, 0),
    bySite,
  };
}
