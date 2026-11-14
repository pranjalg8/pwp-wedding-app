import type { Invite } from './rsvp';
import { householdNeed, type StaySite } from './stay';

export type PaidBy = 'pranjal_family' | 'paridhi' | 'shared';

export const PAID_BY_LABEL: Record<PaidBy, string> = {
  pranjal_family: "Pranjal's family",
  paridhi: 'Paridhi',
  shared: 'Shared',
};

export type StayRoom = {
  id: string;
  site_id: string;
  label: string;
  floor: number | null;
  capacity: number;
  available_from: string | null;
  available_until?: string | null; // the last night the room is open; null = open to the end
  paid_by: PaidBy | null;
  notes: string | null;
  sort_order: number;
};

// One household in one room. people null = the household's people split evenly across its rooms.
// extra_nights: nights outside the household's own guest nights that it also keeps this room (12 or 16 Feb at Shri Kanth).
// check_in / check_out: when set, the stay's own dates; the nights run from check_in up to the night before check_out,
// and extra_nights is ignored. When empty the stay follows the household's guest nights plus extra_nights.
export type RoomStay = {
  id: string;
  room_id: string;
  guest_id: string;
  people: number | null;
  extra_nights?: string[] | null;
  check_in?: string | null;
  check_out?: string | null;
};

export type RoomGuest = {
  id: string;
  name: string;
  persons: number;
  priority: 1 | 2 | null;
  rooms_inside: number | string;
  rooms_outside: number | string;
  needs_lift?: boolean;
  family_members?: string | null;
  sort_order: number;
};

type Inv = Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>;

export const roomOpenOn = (room: StayRoom, night: string) => (!room.available_from || room.available_from <= night) && (!room.available_until || night <= room.available_until);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function addDays(day: string, n: number) {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
}

// The day after the last night: everyone checks out then.
export function checkoutOf(allNights: string[]) {
  const last = allNights[allNights.length - 1];
  return last ? addDays(last, 1) : null;
}

// The nights of a stay from check-in up to, not including, check-out. Capped at 60 so bad data cannot hang the page.
export function nightsBetween(checkIn: string, checkOut: string) {
  const out: string[] = [];
  for (let d = checkIn; d < checkOut && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}

// The nights one stay covers: its own dates when set, otherwise the household's guest nights plus its extra nights.
export function stayNights(stay: Pick<RoomStay, 'check_in' | 'check_out' | 'extra_nights'>, baseNights: string[]) {
  if (stay.check_in && stay.check_out) return nightsBetween(stay.check_in, stay.check_out);
  return [...new Set([...baseNights, ...(stay.extra_nights ?? [])])].sort();
}

export type Household = {
  g: RoomGuest;
  people: number; // people who might come: the household minus those who said no
  roomsNeeded: number; // whole rooms (a half room still takes a room)
  mainRooms: number; // of roomsNeeded, the ones meant for the main stay; the rest go elsewhere
  nights: string[]; // the nights it is there; every night when it is not invited yet
  firstNight: string | null;
};

// The households that need rooms, with how many rooms they need and the nights they are there.
export function householdsNeedingRooms(guests: RoomGuest[], invites: Inv[], allNights: string[]): Household[] {
  const out: Household[] = [];
  for (const g of guests) {
    const need = householdNeed(g, invites, allNights);
    if (!need) continue;
    const roomsNeeded = Math.ceil(need.main + need.other - 0.001);
    if (roomsNeeded <= 0) continue;
    const mainRooms = Math.min(roomsNeeded, Math.ceil(need.main - 0.001));
    out.push({ g, people: need.people, roomsNeeded, mainRooms, nights: need.nights, firstNight: need.firstNight });
  }
  return out;
}

export type HouseholdState = 'none' | 'partly' | 'placed' | 'extra';

export function stateOf(roomsPlaced: number, roomsNeeded: number): HouseholdState {
  if (roomsPlaced === 0) return 'none';
  if (roomsPlaced < roomsNeeded) return 'partly';
  return roomsPlaced > roomsNeeded ? 'extra' : 'placed';
}

// nights = the nights the household is in this room (its own dates, or its guest nights plus extra nights);
// baseNights = the guest nights alone.
export type Occupant = { stay: RoomStay; guest: RoomGuest; people: number; nights: string[]; baseNights: string[]; firstNight: string | null };

// Who sleeps in each room: the households in it, how many people each puts there, and the nights they are there.
export function occupantsByRoom(stays: RoomStay[], households: Household[], guests: RoomGuest[], allNights: string[]) {
  const byGuest = new Map(households.map((h) => [h.g.id, h]));
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const roomsOfGuest = new Map<string, number>();
  for (const s of stays) roomsOfGuest.set(s.guest_id, (roomsOfGuest.get(s.guest_id) ?? 0) + 1);

  const out = new Map<string, Occupant[]>();
  for (const s of stays) {
    const guest = guestById.get(s.guest_id);
    if (!guest) continue;
    const h = byGuest.get(s.guest_id);
    const total = h?.people ?? guest.persons;
    const people = s.people ?? Math.max(1, Math.ceil(total / (roomsOfGuest.get(s.guest_id) ?? 1)));
    const list = out.get(s.room_id) ?? [];
    const baseNights = h?.nights ?? allNights;
    const nights = stayNights(s, baseNights);
    list.push({ stay: s, guest, people, nights, baseNights, firstNight: nights[0] ?? null });
    out.set(s.room_id, list);
  }
  return out;
}

// ---- Fill rooms: put the households still to place into rooms that are free on all their nights ----

export type AutoPlace = { rows: { guest_id: string; room_id: string }[]; short: { guest_id: string; rooms: number }[] };

// Households that arrive first go first, then bigger before smaller, then by priority. Main-stay rooms go to the main
// place first and the rest to the other places first, in the places' order. A room is used only when it is open and
// empty on every night the household is there, and a household needing a lift only goes where there is one. A
// household is kept at one place when one place has all the rooms it still needs. Rooms already placed stay as they
// are; nothing is moved.
export function autoPlace(households: Household[], rooms: StayRoom[], sites: StaySite[], occ: Map<string, Occupant[]>, placed: Map<string, number>): AutoPlace {
  const busy = new Map<string, Set<string>>();
  for (const [roomId, list] of occ) busy.set(roomId, new Set(list.flatMap((o) => o.nights)));
  const bySite = (siteId: string) =>
    rooms.filter((r) => r.site_id === siteId).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const ordered = [...sites].sort((a, b) => a.sort_order - b.sort_order);
  const main = ordered.filter((s) => s.role === 'main');
  const other = ordered.filter((s) => s.role !== 'main');

  const todo = households
    .filter((h) => h.nights.length > 0 && (placed.get(h.g.id) ?? 0) < h.roomsNeeded)
    .sort(
      (a, b) =>
        (a.firstNight ?? '').localeCompare(b.firstNight ?? '') ||
        b.roomsNeeded - a.roomsNeeded ||
        (a.g.priority ?? 9) - (b.g.priority ?? 9) ||
        a.g.sort_order - b.g.sort_order
    );

  const rows: AutoPlace['rows'] = [];
  const short: AutoPlace['short'] = [];
  for (const h of todo) {
    const have = placed.get(h.g.id) ?? 0;
    const mainLeft = Math.max(0, h.mainRooms - have);
    const otherLeft = h.roomsNeeded - have - mainLeft;
    const free = (siteId: string) => bySite(siteId).filter((r) => h.nights.every((n) => roomOpenOn(r, n) && !busy.get(r.id)?.has(n)));
    const take = (count: number, order: StaySite[]) => {
      if (count <= 0) return 0;
      const usable = order.filter((s) => !h.g.needs_lift || s.has_lift);
      const whole = usable.find((s) => free(s.id).length >= count);
      const picks = whole ? free(whole.id).slice(0, count) : usable.flatMap((s) => free(s.id)).slice(0, count);
      for (const r of picks) {
        rows.push({ guest_id: h.g.id, room_id: r.id });
        const set = busy.get(r.id) ?? new Set<string>();
        h.nights.forEach((n) => set.add(n));
        busy.set(r.id, set);
      }
      return count - picks.length;
    };
    const left = take(mainLeft, [...main, ...other]) + take(otherLeft, [...other, ...main]);
    if (left > 0) short.push({ guest_id: h.g.id, rooms: left });
  }
  return { rows, short };
}

export type RoomIssue = 'over' | 'stairs' | 'not_open' | 'shared';

// What is worth a look in a room. "over" is the most people on any night against its capacity; "stairs" is a household
// that cannot manage stairs in a place without a lift; "not_open" is a household with a night when the room is not open;
// "shared" is information, not a problem: two households in one room.
export function roomIssues(room: StayRoom, site: StaySite | undefined, occupants: Occupant[], allNights: string[]): RoomIssue[] {
  const issues: RoomIssue[] = [];
  const worst = Math.max(0, ...[...new Set([...allNights, ...occupants.flatMap((o) => o.nights)])].map((n) => occupants.filter((o) => o.nights.includes(n)).reduce((a, o) => a + o.people, 0)));
  if (worst > room.capacity) issues.push('over');
  if (site && !site.has_lift && occupants.some((o) => o.guest.needs_lift)) issues.push('stairs');
  if (occupants.some((o) => o.nights.some((n) => !roomOpenOn(room, n)))) issues.push('not_open');
  if (occupants.length > 1) issues.push('shared');
  return issues;
}

export const ISSUE_TEXT: Record<RoomIssue, string> = {
  over: 'More people than the room holds',
  stairs: 'Needs a lift, but this place has none',
  not_open: 'Stays a night when the room is not open',
  shared: 'Shared by more than one household',
};

export const isProblem = (i: RoomIssue) => i !== 'shared';

// ---- Rooming list ----

export type RoomingRow = {
  site: string;
  room: string;
  floor: string;
  guests: string; // "Household (people)" joined, plus the family names when known
  people: number;
  checkIn: string;
  checkOut: string;
  paidBy: string;
  notes: string;
};

const dayLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// One row per room that has someone in it, in the order of the places and the rooms.
export function roomingRows(sites: StaySite[], rooms: StayRoom[], occ: Map<string, Occupant[]>, allNights: string[], withMembers: boolean): RoomingRow[] {
  const out: RoomingRow[] = [];
  for (const site of sites) {
    const mine = rooms.filter((r) => r.site_id === site.id).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, undefined, { numeric: true }));
    for (const room of mine) {
      const here = occ.get(room.id) ?? [];
      if (here.length === 0) continue;
      const nightsHere = here.flatMap((o) => o.nights).sort();
      const first = nightsHere[0] ?? allNights[0];
      const checkout = checkoutOf(nightsHere.length > 0 ? nightsHere : allNights);
      out.push({
        site: site.name,
        room: room.label,
        floor: room.floor === null ? '' : String(room.floor),
        guests: here
          .map((o) => {
            const members = withMembers && o.guest.family_members ? `: ${o.guest.family_members}` : '';
            return `${o.guest.name} (${o.people})${members}`;
          })
          .join(' + '),
        people: here.reduce((a, o) => a + o.people, 0),
        checkIn: first ? dayLabel(first) : '',
        checkOut: checkout ? dayLabel(checkout) : '',
        paidBy: room.paid_by ? PAID_BY_LABEL[room.paid_by] : '',
        notes: [room.notes, here.some((o) => o.guest.needs_lift) ? 'Needs a lift' : null].filter(Boolean).join('. '),
      });
    }
  }
  return out;
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function roomingCsv(rows: RoomingRow[]) {
  const head = ['Place', 'Room', 'Floor', 'Guests', 'People', 'Check in', 'Check out', 'Paid by', 'Notes'];
  const body = rows.map((r) => [r.site, r.room, r.floor, r.guests, r.people, r.checkIn, r.checkOut, r.paidBy, r.notes]);
  return [head, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A plain page for printing or saving as PDF.
export function roomingHtml(title: string, rows: RoomingRow[]) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.room)}</td><td>${esc(r.floor)}</td><td>${esc(r.guests)}</td><td class="n">${r.people}</td><td>${esc(r.checkIn)}</td><td>${esc(r.checkOut)}</td><td>${esc(r.notes)}</td></tr>`
    )
    .join('');
  const people = rows.reduce((a, r) => a + r.people, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font:13px/1.4 system-ui,sans-serif;margin:24px;color:#222}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#666}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f3f3f3}.n{text-align:right}
@media print{body{margin:10mm}}</style></head><body><h1>${esc(title)}</h1><p>${rows.length} rooms, ${people} people</p>
<table><thead><tr><th>Room</th><th>Floor</th><th>Guests</th><th>People</th><th>Check in</th><th>Check out</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
}
