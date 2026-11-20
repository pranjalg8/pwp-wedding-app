import { describe, expect, it } from 'vitest';
import { clock, publicSchedule, type FunctionRow } from '../../../../supabase/functions/invite-schedule/rules';
import { whenLabel } from '../schedule';
import { mealCost, mealLineChecks, mealsByDay, type Meal } from '../meals';

const row = (over: Partial<FunctionRow>): FunctionRow => ({
  key: 'tilak',
  name: 'Tilak',
  event_date: '2027-02-14',
  slot: 'first_half',
  sort_order: 10,
  family_only: false,
  start_time: null,
  end_time: null,
  show_time: false,
  venue_site_id: 'rp',
  venue_text: null,
  invite_name: null,
  invite_part: null,
  invite_blurb: 'Begins it.',
  dress: 'Festive',
  ...over,
});
const SITES = [{ id: 'rp', name: 'Royal Pepper', maps_query: 'Royal Pepper Bawal', maps_url: null }];

describe('clock', () => {
  it('reads a database time as a 12-hour clock', () => {
    expect(clock('09:00:00')).toBe('9:00 am');
    expect(clock('21:30')).toBe('9:30 pm');
    expect(clock('00:00')).toBe('12:00 am');
    expect(clock('12:15')).toBe('12:15 pm');
  });
});

describe('publicSchedule', () => {
  it('leaves out family-only functions and orders by day, then sort order', () => {
    const days = publicSchedule(
      [
        row({ key: 'haldi', event_date: '2027-02-15', sort_order: 50 }),
        row({ key: 'mehndi', sort_order: 20 }),
        row({ key: 'tilak', sort_order: 10 }),
        row({ key: 'nikasi', event_date: '2027-02-13', family_only: true }),
      ],
      SITES,
    );
    expect(days.map((d) => d.date)).toEqual(['2027-02-14', '2027-02-15']);
    expect(days[0].functions.map((f) => f.key)).toEqual(['tilak', 'mehndi']);
  });

  it('keeps a time off the invite until it is switched on', () => {
    const [hidden] = publicSchedule([row({ start_time: '09:00:00' })], SITES);
    expect(hidden.functions[0]).toMatchObject({ time: null, start: null, end: null, part: 'Daytime' });
    const [shown] = publicSchedule([row({ start_time: '09:00:00', end_time: '13:00:00', show_time: true })], SITES);
    expect(shown.functions[0]).toMatchObject({ time: '9:00 am to 1:00 pm', start: '09:00', end: '13:00' });
  });

  it('uses the invite words when set, and the site or free-text venue', () => {
    const [d] = publicSchedule(
      [
        row({ invite_name: 'Sagai', name: 'Sagai (ring ceremony)', invite_part: 'Evening', slot: 'second_half' }),
        row({ key: 'x', venue_site_id: null, venue_text: 'Bride’s home', sort_order: 99 }),
        row({ key: 'y', venue_site_id: null, sort_order: 100 }),
      ],
      SITES,
    );
    expect(d.functions[0]).toMatchObject({ name: 'Sagai', part: 'Evening', venue: { name: 'Royal Pepper', query: 'Royal Pepper Bawal', maps: '' } });
    expect(d.functions[1].venue).toEqual({ name: 'Bride’s home', query: 'Bride’s home', maps: '' });
    expect(d.functions[2].venue).toBeNull();
  });

  it('never passes on anything but the public fields', () => {
    const [d] = publicSchedule([{ ...row({}), notes: 'secret', status: 'open' } as FunctionRow], SITES);
    expect(Object.keys(d.functions[0]).sort()).toEqual(['blurb', 'dress', 'end', 'key', 'name', 'part', 'start', 'time', 'venue']);
  });
});

const meal = (over: Partial<Meal>): Meal => ({
  id: Math.random().toString(36),
  meal_date: '2027-02-13',
  meal: 'lunch',
  site_id: null,
  place_text: null,
  for_whom: 'Everyone',
  people: 80,
  rate: 550,
  menu: null,
  notes: null,
  schedule_id: 'l13',
  ...over,
});

describe('meals', () => {
  it('lists every wedding day, with meals in serving order', () => {
    const days = mealsByDay([meal({ meal: 'dinner' }), meal({ meal: 'breakfast' })]);
    expect(days.map((d) => d.date)).toEqual(['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15', '2027-02-16']);
    expect(days[1].meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner']);
    expect(days[0].meals).toEqual([]);
  });

  it('costs a meal only when people and rate are known', () => {
    expect(mealCost({ people: 80, rate: 400 })).toBe(32000);
    expect(mealCost({ people: null, rate: 400 })).toBeNull();
  });

  it('matches the meals to their budget line, before part payments', () => {
    const meals = [meal({ meal: 'breakfast', rate: 400 }), meal({ meal: 'lunch' }), meal({ meal: 'dinner' })];
    const line = { id: 'l13', payee: '13 Feb', quantity: 80, rate: 1500 };
    expect(mealLineChecks(meals, [line])).toEqual([{ line, meals: 120000, budget: 120000, diff: 0, unpriced: 0 }]);
    const more = [...meals.slice(0, 2), meal({ meal: 'dinner', people: 100 })];
    expect(mealLineChecks(more, [line])[0].diff).toBe(11000);
  });

  it('skips lines with no meals and counts meals with no price', () => {
    const line = { id: 'l13', payee: '13 Feb', quantity: 80, rate: 1500 };
    expect(mealLineChecks([], [line])).toEqual([]);
    expect(mealLineChecks([meal({ rate: null })], [line])[0]).toMatchObject({ meals: 0, unpriced: 1 });
  });
});

describe('whenLabel', () => {
  it('shows the time once set, else the half of the day', () => {
    expect(whenLabel({ slot: 'first_half' })).toBe('First half');
    expect(whenLabel({ slot: 'first_half', start_time: '09:00:00' })).toBe('9:00 am');
    expect(whenLabel({ slot: 'second_half', start_time: '19:00:00', end_time: '00:00:00' })).toBe('7:00 pm to 12:00 am');
  });
});
