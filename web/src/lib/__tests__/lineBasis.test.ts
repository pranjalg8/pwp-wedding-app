import { describe, expect, it } from 'vitest';
import { lineAmount, type Scheduled } from '../budgetPlan';
import { peopleByNight, planChanges, plannedQuantity, type PlanCounts } from '../lineBasis';
import { line } from './fixtures';

const SK = 'sk';
const SAI = 'sai';
// The bookings on the plan: Shri Kanth 10, 18, 18, 18, 10 and Hotel Sai 3, 18.
const nights = [
  ['2027-02-12', 10], ['2027-02-13', 18], ['2027-02-14', 18], ['2027-02-15', 18], ['2027-02-16', 10],
].map(([night, rooms]) => ({ site_id: SK, night: night as string, rooms: rooms as number }));
const sai = [{ site_id: SAI, night: '2027-02-14', rooms: 3 }, { site_id: SAI, night: '2027-02-15', rooms: 18 }];
const counts = (over: Partial<PlanCounts> = {}): PlanCounts => ({ nights: [...nights, ...sai], boardPeople: null, ...over });

const rooms: Scheduled = line({ id: 'rooms', amount: 157200, due_date: '2027-01-20', basis: 'room_nights', basis_site_id: SK, quantity: 74, unit: 'room-nights', rate: 2800, adjustment: -50000 });
const beds: Scheduled = line({ id: 'beds', amount: 44400, due_date: '2027-01-20', basis: 'room_nights', basis_site_id: SK, basis_multiplier: 2, quantity: 148, unit: 'bed-nights', rate: 300 });
const hotelSai: Scheduled = line({ id: 'sai', amount: 120500, due_date: '2027-01-15', basis: 'room_nights', basis_site_id: SAI, basis_extra: 24, quantity: 45, unit: 'room-nights', rate: 2500, adjustment: 8000 });
const dinner: Scheduled = line({ id: 'dinner', amount: 24750, due_date: '2027-02-05', basis: 'meal_people', basis_site_id: SK, basis_night: '2027-02-12', quantity: 45, unit: 'people', rate: 550 });

describe('hotel lines from the rooms booked', () => {
  it('match the amounts on the budget today', () => {
    expect(plannedQuantity(rooms, counts())).toBe(74);
    expect(plannedQuantity(beds, counts())).toBe(148);
    expect(plannedQuantity(hotelSai, counts())).toBe(45);
    expect(planChanges([rooms, beds, hotelSai], counts())).toEqual([]);
  });

  it('report the new amount when rooms are added, keeping the advance taken off', () => {
    const more = counts({ nights: [...nights, { site_id: SK, night: '2027-02-17', rooms: 10 }] });
    const [c] = planChanges([rooms], more);
    expect(c.quantity).toBe(84);
    expect(c.amount).toBe(84 * 2800 - 50000);
    expect(c.difference).toBe(28000);
  });

  it('ignore lines already paid and lines with no basis', () => {
    const more = counts({ nights: [{ site_id: SK, night: '2027-02-13', rooms: 1 }] });
    expect(planChanges([{ ...rooms, status: 'paid' }, line({ id: 'x', amount: 5, due_date: '2027-01-01', quantity: 1, rate: 9 })], more)).toEqual([]);
  });
});

describe('meal lines from the room board', () => {
  it('say nothing until every household has a room', () => {
    expect(plannedQuantity(dinner, counts())).toBeNull();
    expect(planChanges([dinner], counts())).toEqual([]);
  });

  it('follow the people sleeping there that night once the board is complete', () => {
    const board = peopleByNight([{ id: 'r1', site_id: SK }, { id: 'r2', site_id: SK }], new Map([
      ['r1', [{ people: 4, nights: ['2027-02-12', '2027-02-13'] }]],
      ['r2', [{ people: 3, nights: ['2027-02-13'] }]],
    ]));
    expect(board.get('sk|2027-02-13')).toBe(7);
    const [c] = planChanges([dinner], counts({ boardPeople: board }));
    expect(c.quantity).toBe(4);
    expect(c.amount).toBe(2200);
  });
});

describe('lineAmount with an adjustment', () => {
  it('takes an advance off and never goes below zero', () => {
    expect(lineAmount(74, 2800, -50000)).toBe(157200);
    expect(lineAmount(1, 100, -500)).toBe(0);
  });
});
