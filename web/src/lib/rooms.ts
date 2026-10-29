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
  paid_by: PaidBy | null;
  notes: string | null;
  sort_order: number;
};

// One household in one room. people null = the household's people split evenly across its rooms.
export type RoomStay = { id: string; room_id: string; guest_id: string; people: number | null };

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

export const roomOpenOn = (room: StayRoom, night: string) => !room.available_from || room.available_from <= night;

// The day after the last night: everyone checks out then.
export function checkoutOf(allNights: string[]) {
  const last = allNights[allNights.length - 1];
  if (!last) return null;
  const d = new Date(last + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type Household = {
  g: RoomGuest;
  people: number; // people who might come: the household minus those who said no
  roomsNeeded: number; // whole rooms (a half room still takes a room)
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
    out.push({ g, people: need.people, roomsNeeded, nights: need.nights, firstNight: need.firstNight });
  }
  return out;
}

export type HouseholdState = 'none' | 'partly' | 'placed' | 'extra';

export function stateOf(roomsPlaced: number, roomsNeeded: number): HouseholdState {
  if (roomsPlaced === 0) return 'none';
  if (roomsPlaced < roomsNeeded) return 'partly';
  return roomsPlaced > roomsNeeded ? 'extra' : 'placed';
}

export type Occupant = { stay: RoomStay; guest: RoomGuest; people: number; nights: string[]; firstNight: string | null };

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
    list.push({ stay: s, guest, people, nights: h?.nights ?? allNights, firstNight: h?.firstNight ?? allNights[0] ?? null });
    out.set(s.room_id, list);
  }
  return out;
}

export type RoomIssue = 'over' | 'stairs' | 'not_open' | 'shared';

// What is worth a look in a room. "over" is the most people on any night against its capacity; "stairs" is a household
// that cannot manage stairs in a place without a lift; "not_open" is a household arriving before the room is open;
// "shared" is information, not a problem: two households in one room.
export function roomIssues(room: StayRoom, site: StaySite | undefined, occupants: Occupant[], allNights: string[]): RoomIssue[] {
  const issues: RoomIssue[] = [];
  const worst = Math.max(0, ...allNights.map((n) => occupants.filter((o) => o.nights.includes(n)).reduce((a, o) => a + o.people, 0)));
  if (worst > room.capacity) issues.push('over');
  if (site && !site.has_lift && occupants.some((o) => o.guest.needs_lift)) issues.push('stairs');
  if (room.available_from && occupants.some((o) => o.firstNight && o.firstNight < room.available_from!)) issues.push('not_open');
  if (occupants.length > 1) issues.push('shared');
  return issues;
}

export const ISSUE_TEXT: Record<RoomIssue, string> = {
  over: 'More people than the room holds',
  stairs: 'Needs a lift, but this place has none',
  not_open: 'Arrives before the room is open',
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
  const checkout = checkoutOf(allNights);
  for (const site of sites) {
    const mine = rooms.filter((r) => r.site_id === site.id).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, undefined, { numeric: true }));
    for (const room of mine) {
      const here = occ.get(room.id) ?? [];
      if (here.length === 0) continue;
      const first = here.map((o) => o.firstNight).filter((x): x is string => !!x).sort()[0] ?? allNights[0];
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
