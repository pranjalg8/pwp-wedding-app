import { describe, expect, it } from 'vitest';
import { checkoutOf, householdsNeedingRooms, nightsBetween, occupantsByRoom, roomIssues, roomOpenOn, roomingRows, stateOf, stayNights, type RoomStay, type StayRoom } from '../rooms';
import { DAY1, DAY2, HOTEL_SAI, SHRI_KANTH, guest, invite } from './fixtures';

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
