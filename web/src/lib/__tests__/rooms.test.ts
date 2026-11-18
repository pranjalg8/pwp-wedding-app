import { describe, expect, it } from 'vitest';
import { autoPlace, checkoutOf, isFixedStay, suggestLayout, householdsNeedingRooms, nightsBetween, occupantsByRoom, roomIssues, roomOpenOn, roomingRows, stateOf, stayNights, type RoomStay, type StayRoom } from '../rooms';
import { DAY1, DAY2, HOTEL_SAI, ROYAL_PEPPER, SHRI_KANTH, guest, invite } from './fixtures';

const room = (over: Partial<StayRoom> = {}): StayRoom => ({
  id: 'r1', site_id: SHRI_KANTH.id, label: '101', floor: 1, capacity: 4, available_from: null, paid_by: null, notes: null, sort_order: 0, ...over,
});
const stay = (guest_id: string, people: number | null = null, room_id = 'r1'): RoomStay => ({ id: `${guest_id}-${room_id}`, room_id, guest_id, people });

describe('checkoutOf', () => {
  it('is the day after the last guest night, including across a month end', () => {
    expect(checkoutOf([DAY1, DAY2])).toBe('2027-02-16');
    expect(checkoutOf(['2027-02-28'])).toBe('2027-03-01');
    expect(checkoutOf([])).toBeNull();
  });
});

describe('stateOf', () => {
  it('reads none, partly, placed and extra', () => {
    expect(stateOf(0, 2)).toBe('none');
    expect(stateOf(1, 2)).toBe('partly');
    expect(stateOf(2, 2)).toBe('placed');
    expect(stateOf(3, 2)).toBe('extra');
  });
});

describe('roomIssues', () => {
  const nights = [DAY1, DAY2];
  const guests = [guest('a', 3, 1), guest('b', 3, 1), guest('elders', 2, 1, 0, { needs_lift: true })];
  const inv = [invite('a', DAY1), invite('b', DAY2), invite('elders', DAY1)];
  const households = householdsNeedingRooms(guests, inv, nights);

  it('flags more people than the room holds only on a night they overlap', () => {
    const occ = occupantsByRoom([stay('a'), stay('b')], households, guests, nights).get('r1')!;
    // a (3) stays both nights, b (3) only 15 Feb: 6 people that night in a room for 4.
    expect(roomIssues(room(), SHRI_KANTH, occ, nights)).toEqual(['over', 'shared']);
  });

  it('flags a household that needs a lift at a place with none, and not at one with a lift', () => {
    const occ = occupantsByRoom([stay('elders')], households, guests, nights).get('r1')!;
    expect(roomIssues(room(), SHRI_KANTH, occ, nights)).toEqual(['stairs']);
    expect(roomIssues(room({ site_id: HOTEL_SAI.id }), HOTEL_SAI, occ, nights)).toEqual([]);
  });

  it('flags a room that opens after the household arrives', () => {
    const occ = occupantsByRoom([stay('a')], households, guests, nights).get('r1')!;
    expect(roomIssues(room({ available_from: DAY2 }), SHRI_KANTH, occ, nights)).toEqual(['not_open']);
  });
});

describe('extra nights (12 and 16 Feb)', () => {
  const EARLY = '2027-02-12';
  const LATE = '2027-02-16';
  const guestNights = [DAY1, DAY2];
  const guests = [guest('a', 3, 1)];
  const households = householdsNeedingRooms(guests, [invite('a', DAY1)], guestNights);
  const withExtras = { ...stay('a'), extra_nights: [EARLY, LATE] };

  it('adds the extra nights to the household nights in that room and keeps the guest nights apart', () => {
    const occ = occupantsByRoom([withExtras], households, guests, guestNights).get('r1')![0];
    expect(occ.nights).toEqual([EARLY, DAY1, DAY2, LATE]);
    expect(occ.baseNights).toEqual([DAY1, DAY2]);
  });

  it('is open from and until the given nights', () => {
    const r = room({ available_from: EARLY, available_until: LATE });
    expect(roomOpenOn(r, EARLY)).toBe(true);
    expect(roomOpenOn(r, LATE)).toBe(true);
    expect(roomOpenOn(room({ available_until: DAY2 }), LATE)).toBe(false);
  });

  it('flags an extra night the room is not open', () => {
    const occ = occupantsByRoom([withExtras], households, guests, guestNights).get('r1')!;
    expect(roomIssues(room({ available_from: DAY1, available_until: DAY2 }), SHRI_KANTH, occ, guestNights)).toContain('not_open');
    expect(roomIssues(room({ available_from: EARLY, available_until: LATE }), SHRI_KANTH, occ, [EARLY, ...guestNights, LATE])).toEqual([]);
  });

  it('lists check in and check out from the nights in the room, not from every place', () => {
    const occ = occupantsByRoom([withExtras], households, guests, guestNights);
    const [row] = roomingRows([SHRI_KANTH], [room()], occ, guestNights, false);
    expect(row.checkIn).toMatch(/12/);
    expect(row.checkOut).toMatch(/17/);
    const plain = occupantsByRoom([stay('a')], households, guests, guestNights);
    expect(roomingRows([SHRI_KANTH], [room()], plain, guestNights, false)[0].checkOut).toMatch(/16/);
  });
});

describe('stays with their own dates', () => {
  const EARLY = '2027-02-12';
  const LATE = '2027-02-16';
  const guestNights = [DAY1, DAY2];
  const guests = [guest('a', 3, 1), guest('b', 3, 1)];
  const households = householdsNeedingRooms(guests, [invite('a', DAY1), invite('b', DAY1)], guestNights);
  const dated = (guest_id: string, check_in: string, check_out: string, extra: string[] = []): RoomStay => ({ ...stay(guest_id), check_in, check_out, extra_nights: extra });

  it('runs from check-in up to the night before check-out, across a month end, and is empty when out is not after in', () => {
    expect(nightsBetween(EARLY, '2027-02-17')).toEqual([EARLY, '2027-02-13', DAY1, DAY2, LATE]);
    expect(nightsBetween('2027-02-27', '2027-03-02')).toEqual(['2027-02-27', '2027-02-28', '2027-03-01']);
    expect(nightsBetween(DAY2, DAY2)).toEqual([]);
    expect(nightsBetween(DAY2, DAY1)).toEqual([]);
  });

  it('uses its own dates over the guest nights and ignores extra nights; with no dates it keeps the old rule', () => {
    expect(stayNights(dated('a', EARLY, '2027-02-17', ['2027-02-20']), guestNights)).toEqual([EARLY, '2027-02-13', DAY1, DAY2, LATE]);
    expect(stayNights({ check_in: null, check_out: null, extra_nights: [LATE] }, guestNights)).toEqual([DAY1, DAY2, LATE]);
    const occ = occupantsByRoom([dated('a', EARLY, '2027-02-17')], households, guests, guestNights).get('r1')![0];
    expect(occ.nights[0]).toBe(EARLY);
    expect(occ.baseNights).toEqual(guestNights);
  });

  it('counts people only on the nights each stay covers', () => {
    // a (3) keeps 14 and 15 Feb; b (3) has its own dates for 16 Feb only, so the room for 4 is never over.
    const occ = occupantsByRoom([stay('a'), dated('b', LATE, '2027-02-17')], households, guests, guestNights).get('r1')!;
    expect(roomIssues(room({ available_until: LATE }), SHRI_KANTH, occ, guestNights)).toEqual(['shared']);
    // The same room closing after 15 Feb flags b.
    expect(roomIssues(room({ available_until: DAY2 }), SHRI_KANTH, occ, guestNights)).toContain('not_open');
  });

  it('puts its own check-in and check-out on the rooming list', () => {
    const occ = occupantsByRoom([dated('a', '2027-02-13', LATE)], households, guests, guestNights);
    const [row] = roomingRows([SHRI_KANTH], [room()], occ, guestNights, false);
    expect(row.checkIn).toMatch(/13/);
    expect(row.checkOut).toMatch(/16/);
  });
});

describe('autoPlace (Fill rooms)', () => {
  const nights = [DAY1, DAY2];
  const rp = (n: number, from: string | null = null) => room({ id: `rp${n}`, site_id: ROYAL_PEPPER.id, label: `R${n}`, sort_order: n, available_from: from });
  const sk = (n: number) => room({ id: `sk${n}`, site_id: SHRI_KANTH.id, label: `F${n}`, sort_order: n });
  const sai = (n: number) => room({ id: `sai${n}`, site_id: HOTEL_SAI.id, label: `S${n}`, sort_order: n });
  const sites = [ROYAL_PEPPER, SHRI_KANTH, HOTEL_SAI];
  const run = (guests: ReturnType<typeof guest>[], inv: ReturnType<typeof invite>[], rooms: StayRoom[], stays: RoomStay[] = []) => {
    const hh = householdsNeedingRooms(guests, inv, nights);
    const occ = occupantsByRoom(stays, hh, guests, nights);
    const placed = new Map<string, number>();
    stays.forEach((s) => placed.set(s.guest_id, (placed.get(s.guest_id) ?? 0) + 1));
    return autoPlace(hh, rooms, sites, occ, placed);
  };

  it('sends main-stay rooms to the main place and the rest elsewhere, keeping a household at one place', () => {
    const plan = run([guest('a', 6, 2, 1)], [invite('a', DAY1)], [rp(1), rp(2), rp(3), sk(1), sk(2)]);
    expect(plan.rows.map((r) => r.room_id)).toEqual(['rp1', 'rp2', 'sk1']);
    expect(plan.short).toEqual([]);
  });

  it('never uses a room that is taken or not open on one of the nights, and reports what is short', () => {
    // b is already in rp1 both nights; rp2 opens only on 15 Feb, so a (both nights) cannot use it.
    const plan = run([guest('a', 3, 1), guest('b', 3, 1)], [invite('a', DAY1), invite('b', DAY1)], [rp(1), rp(2, DAY2)], [stay('b', null, 'rp1')]);
    expect(plan.rows).toEqual([]);
    expect(plan.short).toEqual([{ guest_id: 'a', rooms: 1 }]);
  });

  it('lets a day-2-only household take a room free on its one night', () => {
    const plan = run([guest('a', 3, 1), guest('late', 3, 1)], [invite('a', DAY1), invite('late', DAY2)], [rp(1), rp(2, DAY2)]);
    expect(plan.rows).toEqual([
      { guest_id: 'a', room_id: 'rp1' },
      { guest_id: 'late', room_id: 'rp2' },
    ]);
  });

  it('puts a household needing a lift only where there is one', () => {
    const plan = run([guest('elders', 2, 0, 1, { needs_lift: true })], [invite('elders', DAY1)], [sk(1), sai(1)]);
    expect(plan.rows).toEqual([{ guest_id: 'elders', room_id: 'sai1' }]);
  });

  it('places only the rooms still missing and leaves placed households alone', () => {
    const plan = run([guest('a', 6, 2)], [invite('a', DAY1)], [rp(1), rp(2), rp(3)], [stay('a', null, 'rp3')]);
    expect(plan.rows).toEqual([{ guest_id: 'a', room_id: 'rp1' }]);
  });
});

describe('autoPlace: families together, elders low', () => {
  const nights = [DAY1, DAY2];
  const sites = [ROYAL_PEPPER, SHRI_KANTH, HOTEL_SAI];
  const rp = (n: number, floor: number) => room({ id: `rp${n}`, site_id: ROYAL_PEPPER.id, label: `R${n}`, floor, sort_order: n });
  const run = (guests: ReturnType<typeof guest>[], inv: ReturnType<typeof invite>[], rooms: StayRoom[]) => {
    const hh = householdsNeedingRooms(guests, inv, nights);
    return autoPlace(hh, rooms, sites, new Map(), new Map());
  };

  it('puts a household needing a lift on the lowest floor, ahead of households that come first', () => {
    const rooms = [rp(1, 1), rp(2, 1), rp(3, 2), rp(4, 0)];
    const plan = run([guest('a', 2, 1), guest('elders', 2, 1, 0, { needs_lift: true, priority: 2 })], [invite('a', DAY1), invite('elders', DAY1)], rooms);
    expect(plan.rows).toContainEqual({ guest_id: 'elders', room_id: 'rp4' });
    expect(plan.rows).toContainEqual({ guest_id: 'a', room_id: 'rp1' });
  });

  it('keeps one household\'s rooms on one floor and side by side', () => {
    // Floor 1 has rooms 1 and 3 free but not 2; floor 2 has 4, 5, 6. Three rooms go on floor 2, in a row.
    const rooms = [rp(1, 1), rp(2, 1), rp(3, 1), rp(4, 2), rp(5, 2), rp(6, 2)];
    const hh = householdsNeedingRooms([guest('a', 9, 3), guest('b', 3, 1)], [invite('a', DAY1), invite('b', DAY1)], nights);
    const occ = occupantsByRoom([stay('b', null, 'rp2')], hh, [guest('a', 9, 3), guest('b', 3, 1)], nights);
    const plan = autoPlace(hh, rooms, sites, occ, new Map([['b', 1]]));
    expect(plan.rows.filter((r) => r.guest_id === 'a').map((r) => r.room_id)).toEqual(['rp4', 'rp5', 'rp6']);
  });
});

describe('suggestLayout (pinned stays)', () => {
  const nights = [DAY1, DAY2];
  const sites = [ROYAL_PEPPER, SHRI_KANTH, HOTEL_SAI];
  const rp = (n: number) => room({ id: `rp${n}`, site_id: ROYAL_PEPPER.id, label: `R${n}`, floor: 1, sort_order: n });
  const rooms = [rp(1), rp(2), rp(3)];
  const guests = [guest('a', 3, 1), guest('b', 3, 1), guest('c', 3, 1)];
  const inv = [invite('a', DAY1), invite('b', DAY1), invite('c', DAY1)];
  const hh = householdsNeedingRooms(guests, inv, nights);
  const suggest = (stays: RoomStay[]) => suggestLayout(hh, rooms, sites, stays, guests, nights);

  it('treats pinned stays and stays with their own details as fixed', () => {
    expect(isFixedStay({ ...stay('a'), locked: true })).toBe(true);
    expect(isFixedStay(stay('a', 2))).toBe(true);
    expect(isFixedStay({ ...stay('a'), check_in: DAY1, check_out: '2027-02-16' })).toBe(true);
    expect(isFixedStay({ ...stay('a'), extra_nights: ['2027-02-13'] })).toBe(true);
    expect(isFixedStay(stay('a'))).toBe(false);
  });

  it('never moves a pinned stay and plans the rest around it', () => {
    // a is pinned in rp1; b and c sit in rp2 and rp3 unpinned.
    const stays = [{ ...stay('a', null, 'rp1'), locked: true }, stay('b', null, 'rp3'), stay('c', null, 'rp2')];
    const out = suggest(stays);
    expect(out.fixed).toBe(1);
    expect(out.removeIds).toEqual([]); // b and c are well placed, so they stay
    expect(out.kept).toBe(2);
    expect(out.rows).toEqual([]);
  });

  it('moves an unpinned household out of the way of a pinned one and reports who moves', () => {
    // b is pinned in rp1; a sits unpinned in rp1 too (shared). a should move to the first free room, rp2.
    const stays = [{ ...stay('b', null, 'rp1'), locked: true }, stay('a', null, 'rp1')];
    const out = suggest(stays);
    expect(out.removeIds).toEqual(['a-rp1']);
    expect(out.rows).toContainEqual({ guest_id: 'a', room_id: 'rp2' });
    expect(out.changes.find((c) => c.guest_id === 'a')).toEqual({ guest_id: 'a', from: ['rp1'], to: ['rp2'] });
  });

  it('with fresh, plans every unfixed stay again', () => {
    const stays = [{ ...stay('a', null, 'rp1'), locked: true }, stay('b', null, 'rp3'), stay('c', null, 'rp2')];
    const out = suggestLayout(hh, rooms, sites, stays, guests, nights, { fresh: true });
    expect(out.removeIds.sort()).toEqual(['b-rp3', 'c-rp2']);
    expect(out.rows).toEqual([{ guest_id: 'b', room_id: 'rp2' }, { guest_id: 'c', room_id: 'rp3' }]);
  });

  it('moves a household that needs a lift out of a place with none, even when not fresh', () => {
    const els = [guest('elders', 2, 1, 0, { needs_lift: true })];
    const eh = householdsNeedingRooms(els, [invite('elders', DAY1)], nights);
    const sk = room({ id: 'sk1', site_id: SHRI_KANTH.id, label: 'F1', sort_order: 1 });
    const sai = room({ id: 'sai1', site_id: HOTEL_SAI.id, label: 'S1', sort_order: 1 });
    const out = suggestLayout(eh, [sk, sai], sites, [stay('elders', null, 'sk1')], els, nights);
    expect(out.changes).toEqual([{ guest_id: 'elders', from: ['sk1'], to: ['sai1'] }]);
  });

  it('places households that have no room yet and reports a shortage', () => {
    const out = suggestLayout(hh, [rp(1)], sites, [], guests, nights);
    expect(out.rows).toHaveLength(1);
    expect(out.short.reduce((x, y) => x + y.rooms, 0)).toBe(2);
  });
});

describe('household dates from a reply', () => {
  const EARLY = '2027-02-13';
  it('decides the nights before the household has a room, and any room it gets later follows them', () => {
    const guests = [guest('a', 3, 1, 0, { arrive_on: EARLY, leave_on: DAY2 })];
    const [h] = householdsNeedingRooms(guests, [invite('a', DAY1)], [DAY1, DAY2]);
    expect(h.nights).toEqual([EARLY, DAY1]);
    expect(h.firstNight).toBe(EARLY);
    const occ = occupantsByRoom([stay('a')], [h], guests, [DAY1, DAY2]).get('r1')![0];
    expect(occ.nights).toEqual([EARLY, DAY1]);
  });
});

describe('a household that no longer needs its room', () => {
  it('is flagged, because the stay would otherwise hold the room unnoticed', () => {
    const guests = [guest('gone', 3, 1)];
    const households = householdsNeedingRooms(guests, [invite('gone', DAY1, 0, 3)], [DAY1, DAY2]);
    expect(households).toEqual([]);
    const occ = occupantsByRoom([stay('gone')], households, guests, [DAY1, DAY2]).get('r1')!;
    expect(roomIssues(room(), SHRI_KANTH, occ, [DAY1, DAY2])).toContain('not_needed');
  });
});

describe('Fill rooms and room sizes', () => {
  const nights = [DAY1, DAY2];
  const at = (site_id: string, id: string, capacity: number, sort_order: number) => room({ id, site_id, label: id, capacity, sort_order, floor: null });
  const fill = (guests: ReturnType<typeof guest>[], rooms: StayRoom[], sites = [ROYAL_PEPPER, SHRI_KANTH, HOTEL_SAI]) => {
    const hh = householdsNeedingRooms(guests, guests.map((g) => invite(g.id, DAY1)), nights);
    return autoPlace(hh, rooms, sites, new Map(), new Map());
  };

  it('takes a room big enough at its own place before a smaller one', () => {
    const plan = fill([guest('big', 5, 1)], [at(ROYAL_PEPPER.id, 'small', 4, 1), at(ROYAL_PEPPER.id, 'large', 6, 2)]);
    expect(plan.rows).toEqual([{ guest_id: 'big', room_id: 'large' }]);
    expect(plan.tight).toEqual([]);
  });

  it('stays at the main place and reports the room when nothing there is big enough', () => {
    const plan = fill([guest('big', 6, 1)], [at(ROYAL_PEPPER.id, 'rp', 4, 1), at(SHRI_KANTH.id, 'sk', 6, 2)]);
    expect(plan.rows).toEqual([{ guest_id: 'big', room_id: 'rp' }]);
    expect(plan.tight).toEqual([{ guest_id: 'big', room_id: 'rp', people: 6, capacity: 4 }]);
  });

  it('puts two half-room households with the same nights in one room, and no third', () => {
    const halves = ['a', 'b', 'c'].map((id) => guest(id, 1, 0, 0.5));
    const plan = fill(halves, [at(SHRI_KANTH.id, 's1', 5, 1), at(SHRI_KANTH.id, 's2', 5, 2)]);
    expect(plan.rows).toEqual([
      { guest_id: 'a', room_id: 's1' },
      { guest_id: 'b', room_id: 's1' },
      { guest_id: 'c', room_id: 's2' },
    ]);
  });

  it('does not pair half-room households on different nights', () => {
    const guests = [guest('a', 1, 0, 0.5), guest('b', 1, 0, 0.5)];
    const hh = householdsNeedingRooms(guests, [invite('a', DAY1), invite('b', DAY2)], nights);
    const plan = autoPlace(hh, [at(SHRI_KANTH.id, 's1', 5, 1), at(SHRI_KANTH.id, 's2', 5, 2)], [SHRI_KANTH], new Map(), new Map());
    expect(new Set(plan.rows.map((r) => r.room_id)).size).toBe(2);
  });
});
