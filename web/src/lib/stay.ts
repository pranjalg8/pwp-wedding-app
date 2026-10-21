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

// ---- Room assignment: which place each household sleeps at ----

export type GuestStay = { id: string; guest_id: string; site_id: string; rooms: number | string };
type Inv = Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>;
type GuestPlan = GuestRooms & { name: string; priority: 1 | 2 | null; needs_lift?: boolean };

// What one invited household needs: rooms for the main stay and elsewhere (scaled to the people who might come,
// from its latest answer) and the nights it is there. It arrives on the first day it is invited to and stays until
// checkout, so a day-1 household has every night and a day-2-only household just the last one. Null = not invited.
export function householdNeed(g: GuestRooms, invites: Inv[], allNights: string[]) {
  const mine = invites.filter((i) => i.guest_id === g.id).sort((a, b) => a.event_date.localeCompare(b.event_date));
  if (mine.length === 0) return null;
  const latest = mine[mine.length - 1];
  const people = Math.max(0, g.persons - latest.declined);
  return {
    main: scaleRooms(Number(g.rooms_inside), g.persons, people),
    other: scaleRooms(Number(g.rooms_outside), g.persons, people),
    people,
    firstNight: mine[0].event_date,
    nights: allNights.filter((n) => n >= mine[0].event_date),
  };
}

export const allNightsOf = (nights: StayNight[]) => [...new Set(nights.map((n) => n.night))].sort();

const capacity = (nights: StayNight[], siteId: string, night: string) => nights.find((n) => n.site_id === siteId && n.night === night)?.rooms ?? 0;

// Rooms placed at each place on each night: a household's rooms count on every night it is there.
export function usedByNight(stays: Pick<GuestStay, 'guest_id' | 'site_id' | 'rooms'>[], nightsOfGuest: Map<string, string[]>, allNights: string[]) {
  const used: Record<string, Record<string, number>> = {};
  for (const s of stays) {
    for (const n of nightsOfGuest.get(s.guest_id) ?? allNights) {
      const site = (used[s.site_id] ??= {});
      site[n] = (site[n] ?? 0) + Number(s.rooms);
    }
  }
  return used;
}

export type PlanRow = { guest_id: string; site_id: string; rooms: number };
export type Unplaced = { guest_id: string; kind: 'main' | 'other'; rooms: number };

// A suggested plan. Households that arrive on day 1 go first because they hold their rooms for every night; then
// bigger needs before smaller. Main-stay rooms go to the main place, other rooms to the nearest place with space
// (Hotel Sai only when the nearer one is full, or the household needs a lift). Nothing is placed where a night has
// no room left, and a household needing a lift never goes to a place without one.
export function suggestPlan(guests: GuestPlan[], invites: Inv[], sites: StaySite[], nights: StayNight[]) {
  const all = allNightsOf(nights);
  const used: Record<string, Record<string, number>> = {};
  const left = (siteId: string, ns: string[]) =>
    Math.min(...ns.map((n) => capacity(nights, siteId, n) - (used[siteId]?.[n] ?? 0)));
  const take = (siteId: string, ns: string[], rooms: number) => {
    for (const n of ns) (used[siteId] ??= {})[n] = (used[siteId]?.[n] ?? 0) + rooms;
  };

  const mainSites = sites.filter((s) => s.role === 'main').sort((a, b) => a.sort_order - b.sort_order);
  const otherSites = sites.filter((s) => s.role === 'other').sort((a, b) => a.sort_order - b.sort_order);

  const households = guests
    .map((g) => ({ g, need: householdNeed(g, invites, all) }))
    .filter((x): x is { g: GuestPlan; need: NonNullable<ReturnType<typeof householdNeed>> } => !!x.need && x.need.main + x.need.other > 0)
    .sort(
      (a, b) =>
        a.need.firstNight.localeCompare(b.need.firstNight) ||
        b.need.main + b.need.other - (a.need.main + a.need.other) ||
        (a.g.priority ?? 9) - (b.g.priority ?? 9)
    );

  const rows = new Map<string, PlanRow>();
  const unplaced: Unplaced[] = [];
  const add = (guest_id: string, site_id: string, rooms: number) => {
    const key = `${guest_id}:${site_id}`;
    const row = rows.get(key);
    if (row) row.rooms += rooms;
    else rows.set(key, { guest_id, site_id, rooms });
  };

  for (const { g, need } of households) {
    const place = (rooms: number, order: StaySite[], kind: 'main' | 'other') => {
      if (rooms <= 0) return;
      const usable = order.filter((s) => !g.needs_lift || s.has_lift);
      let remaining = rooms;
      const whole = usable.find((s) => left(s.id, need.nights) >= remaining);
      if (whole) {
        take(whole.id, need.nights, remaining);
        add(g.id, whole.id, remaining);
        return;
      }
      for (const s of usable) {
        const room = Math.min(remaining, Math.floor(Math.max(0, left(s.id, need.nights)) * 2) / 2);
        if (room > 0) {
          take(s.id, need.nights, room);
          add(g.id, s.id, room);
          remaining -= room;
        }
        if (remaining <= 0) return;
      }
      if (remaining > 0) unplaced.push({ guest_id: g.id, kind, rooms: remaining });
    };
    place(need.main, [...mainSites, ...otherSites], 'main');
    place(need.other, [...otherSites, ...mainSites], 'other');
  }

  return { rows: [...rows.values()], unplaced };
}

// ---- What if: the households not invited yet are all invited ----

export type ForecastScenario = 'both' | 'last';

// Nights are shown from the first day on. The households not invited yet are given an invite with no reply for the
// days of the scenario ("both" = every day, "last" = the final day only, so they need no room before it), then the
// same night-by-night counts and the same planner as the real page run on that. Households with answers keep them.
export function forecastRooms(guests: GuestPlan[], invites: Inv[], sites: StaySite[], nights: StayNight[], dates: string[], scenario: ForecastScenario) {
  const invitedIds = new Set(invites.map((i) => i.guest_id));
  const rest = guests.filter((g) => !invitedIds.has(g.id));
  const pick = scenario === 'both' ? dates : dates.slice(-1);
  const synth: Inv[] = rest.flatMap((g) => pick.map((event_date) => ({ guest_id: g.id, event_date, coming: 0, declined: 0 })));
  const all = [...invites, ...synth];
  const allNights = allNightsOf(nights);

  const restNeeds = rest.map((g) => householdNeed(g, synth, allNights)).filter((x): x is NonNullable<typeof x> => !!x && x.main + x.other > 0);
  const perNight = allNights
    .filter((n) => n >= (dates[0] ?? ''))
    .map((night) => {
      const have = roomsAvailable(sites, nights, night);
      const need = roomsWanted(guests, all, night, 'most');
      const now = roomsWanted(guests, invites, night, 'most');
      return { night, have: have.main + have.other, need: need.main + need.other, needNow: now.main + now.other };
    });
  const plan = suggestPlan(guests, all, sites, nights);
  return {
    restHouseholds: restNeeds.length,
    restRooms: restNeeds.reduce((a, x) => a + x.main + x.other, 0),
    perNight,
    unplacedRooms: plan.unplaced.reduce((a, u) => a + u.rooms, 0),
  };
}
