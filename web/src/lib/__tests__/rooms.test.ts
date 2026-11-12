import { describe, expect, it } from 'vitest';
import { checkoutOf, householdsNeedingRooms, occupantsByRoom, roomIssues, stateOf, type RoomStay, type StayRoom } from '../rooms';
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
