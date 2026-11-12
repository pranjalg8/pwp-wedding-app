import { describe, expect, it } from 'vitest';
import { guestNightsOf, householdNeed, roomCeiling, roomsAvailable, roomsWanted, suggestPlan } from '../stay';
import { DAY1, DAY2, HOTEL_SAI, NIGHTS, ROYAL_PEPPER, SHRI_KANTH, SITES, guest, invite } from './fixtures';

describe('guest nights (7 Nov: Shri Kanth extra rooms on 12 and 16 Feb)', () => {
  it('counts only the nights between the first and last guest day', () => {
    expect(guestNightsOf(NIGHTS, [invite('a', DAY1), invite('b', DAY2)])).toEqual([DAY1, DAY2]);
  });

  it('falls back to every night when nobody is invited yet', () => {
    expect(guestNightsOf(NIGHTS, [])).toEqual(['2027-02-12', '2027-02-13', DAY1, DAY2, '2027-02-16']);
  });

  it('still reports the rooms that exist on the nights before and after', () => {
    expect(roomsAvailable(SITES, NIGHTS, '2027-02-12')).toMatchObject({ main: 0, other: 10 });
    expect(roomsAvailable(SITES, NIGHTS, '2027-02-16')).toMatchObject({ main: 0, other: 10 });
    expect(roomsAvailable(SITES, NIGHTS, DAY1)).toMatchObject({ main: 34, other: 21 });
  });
});

describe('householdNeed', () => {
  const nights = [DAY1, DAY2];

  it('gives a day-1 household both nights and a day-2-only household just the last', () => {
    const g = guest('a', 4, 1);
    expect(householdNeed(g, [invite('a', DAY1), invite('a', DAY2)], nights)?.nights).toEqual(nights);
    expect(householdNeed(g, [invite('a', DAY2)], nights)?.nights).toEqual([DAY2]);
  });

  it('scales rooms down to half rooms when people say no', () => {
    const need = householdNeed(guest('a', 4, 2), [invite('a', DAY1, 0, 2)], nights);
    expect(need).toMatchObject({ people: 2, main: 1 });
  });

  it('returns null for a household that is not invited', () => {
    expect(householdNeed(guest('a', 4, 1), [], nights)).toBeNull();
  });
});

describe('roomsWanted', () => {
  it('takes the latest answer up to that night, with most and least readings', () => {
    const guests = [guest('a', 4, 2), guest('b', 2, 1)];
    const inv = [invite('a', DAY1, 4, 0), invite('b', DAY2, 0, 0)];
    expect(roomsWanted(guests, inv, DAY1, 'most')).toEqual({ main: 2, other: 0, households: 1 });
    expect(roomsWanted(guests, inv, DAY2, 'most')).toEqual({ main: 3, other: 0, households: 2 });
    expect(roomsWanted(guests, inv, DAY2, 'least')).toEqual({ main: 2, other: 0, households: 2 });
  });
});

describe('suggestPlan', () => {
  it('never puts a household that needs a lift at Shri Kanth', () => {
    const guests = [guest('elders', 2, 0, 1, { needs_lift: true })];
    const { rows } = suggestPlan(guests, [invite('elders', DAY1)], SITES, NIGHTS);
    expect(rows).toEqual([{ guest_id: 'elders', site_id: HOTEL_SAI.id, rooms: 1 }]);
  });

  it('sends outside rooms to the nearer place first', () => {
    const { rows } = suggestPlan([guest('a', 4, 0, 1)], [invite('a', DAY1)], SITES, NIGHTS);
    expect(rows).toEqual([{ guest_id: 'a', site_id: SHRI_KANTH.id, rooms: 1 }]);
  });

  it('holds a day-1 household on both nights, so the tighter night decides', () => {
    // Hotel Sai has 3 rooms on 14 Feb and 18 on 15 Feb. A lift household needing 4 outside rooms fits there
    // when it comes on day 2 only, but from day 1 the 14th is too tight, so it stays together at the main stay.
    const big = guest('big', 8, 0, 4, { needs_lift: true });
    expect(suggestPlan([big], [invite('big', DAY2)], SITES, NIGHTS).rows).toEqual([{ guest_id: 'big', site_id: HOTEL_SAI.id, rooms: 4 }]);
    expect(suggestPlan([big], [invite('big', DAY1)], SITES, NIGHTS).rows).toEqual([{ guest_id: 'big', site_id: ROYAL_PEPPER.id, rooms: 4 }]);
  });

  it('splits a household across places only when no single place can take it', () => {
    // 36 main rooms from day 1: the main stay has 34 on the 14th, so 2 spill to the nearest other place.
    const { rows, unplaced } = suggestPlan([guest('clan', 120, 36)], [invite('clan', DAY1)], SITES, NIGHTS);
    expect(unplaced).toEqual([]);
    expect(rows).toEqual([
      { guest_id: 'clan', site_id: ROYAL_PEPPER.id, rooms: 34 },
      { guest_id: 'clan', site_id: SHRI_KANTH.id, rooms: 2 },
    ]);
  });

  it('reports what does not fit instead of overbooking', () => {
    const guests = [guest('huge', 200, 60)];
    const { unplaced } = suggestPlan(guests, [invite('huge', DAY1)], SITES, NIGHTS);
    // 34 main + 18 Shri Kanth + 3 Hotel Sai rooms on the tighter night (14 Feb) = 55 of 60.
    expect(unplaced).toEqual([{ guest_id: 'huge', kind: 'main', rooms: 5 }]);
  });

  it('places no rooms for a household whose only day has no night left', () => {
    // Invited only on 17 Feb, after the last night in the stay table: no night to sleep, so no room.
    const { rows, unplaced } = suggestPlan([guest('late', 2, 1)], [invite('late', '2027-02-17')], SITES, NIGHTS);
    expect(rows).toEqual([]);
    expect(unplaced).toEqual([]);
  });
});

describe('roomCeiling', () => {
  it('uses the tightest night for everyone-for-every-day and holds staff rooms back from the main stay', () => {
    const { setups } = roomCeiling(SITES, NIGHTS, [DAY1, DAY2], 4, 0.25, 1);
    const both = setups.find((s) => s.key === 'both');
    // 14 Feb has 34 + 18 + 3 = 55 rooms, less 4 held back = 51; at 0.25 rooms a person that is 204 people.
    expect(both).toMatchObject({ rooms: 51, people: 204 });
  });
});
