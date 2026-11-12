// Test data shaped like the live planner after the 7 Nov family meeting. Place and night numbers match the
// database; households and amounts are made up for the tests, not copied from the guest list or the budget.
import type { StayNight, StaySite } from '../stay';
import type { Scheduled } from '../budgetPlan';

export const ROYAL_PEPPER: StaySite = {
  id: 'rp', name: 'Royal Pepper', role: 'main', sort_order: 1, has_lift: true,
  floors: null, people_per_room: null, distance_note: null, booking_note: null, notes: null,
};
export const SHRI_KANTH: StaySite = { ...ROYAL_PEPPER, id: 'sk', name: 'Shri Kanth Hotel', role: 'other', sort_order: 2, has_lift: false };
export const HOTEL_SAI: StaySite = { ...ROYAL_PEPPER, id: 'sai', name: 'Hotel Sai, Bawal', role: 'other', sort_order: 3, has_lift: true };
export const SITES = [ROYAL_PEPPER, SHRI_KANTH, HOTEL_SAI];

const night = (site_id: string, n: string, rooms: number): StayNight => ({ id: `${site_id}-${n}`, site_id, night: n, rooms });

// 7 Nov: Shri Kanth gets 10 extra rooms on 12 and 16 Feb, on top of 18 rooms on 13, 14 and 15 Feb.
export const NIGHTS: StayNight[] = [
  night('sk', '2027-02-12', 10),
  night('sk', '2027-02-13', 18),
  night('rp', '2027-02-14', 34),
  night('sai', '2027-02-14', 3),
  night('sk', '2027-02-14', 18),
  night('rp', '2027-02-15', 50),
  night('sk', '2027-02-15', 18),
  night('sai', '2027-02-15', 18),
  night('sk', '2027-02-16', 10),
];

export const DAY1 = '2027-02-14';
export const DAY2 = '2027-02-15';

export type TestGuest = {
  id: string; name: string; persons: number; rooms_inside: number; rooms_outside: number;
  priority: 1 | 2 | null; needs_lift?: boolean; family_members?: string | null; sort_order: number;
};
export const guest = (id: string, persons: number, rooms_inside: number, rooms_outside = 0, extra: Partial<TestGuest> = {}): TestGuest => ({
  id, name: `Household ${id}`, persons, rooms_inside, rooms_outside, priority: 1, sort_order: 0, ...extra,
});

export const invite = (guest_id: string, event_date: string, coming = 0, declined = 0) => ({ guest_id, event_date, coming, declined, maybe: 0, id: `${guest_id}-${event_date}` });

export const line = (over: Partial<Scheduled> & Pick<Scheduled, 'id' | 'amount' | 'due_date'>): Scheduled => ({
  payee: over.id, topic_id: 't-stay', note: null, is_estimate: true, status: 'pending', paid_payment_id: null,
  paridhi_amount: 0, paridhi_due_date: null, paridhi_plan: [], ...over,
});
