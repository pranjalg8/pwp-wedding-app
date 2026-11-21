import { describe, expect, it } from 'vitest';
import { arrivalsByDay } from '../transport';
import { enqueue, flush } from '../checkinQueue';

const g = (id: string, persons: number, arrive_on: string | null, needs_lift = false) => ({ id, name: id, persons, needs_lift, arrive_on });

describe('arrivalsByDay', () => {
  it('groups by day, counts lifts and vehicles, and counts undated households', () => {
    const { days, undated } = arrivalsByDay(
      [g('a', 3, '2027-02-13', true), g('b', 4, '2027-02-13', true), g('c', 2, '2027-02-12'), g('d', 5, null)],
      [{ guest_id: 'a', travel: ' Train 12951, 6am ' }, { guest_id: 'c', travel: null }],
    );
    expect(undated).toBe(1);
    expect(days.map((d) => d.date)).toEqual(['2027-02-12', '2027-02-13']);
    const d13 = days[1];
    expect(d13.people).toBe(7);
    expect(d13.liftPeople).toBe(7);
    expect(d13.vehicles).toBe(2);
    expect(d13.households[0].travel).toBe('Train 12951, 6am');
    expect(days[0].vehicles).toBe(0);
  });
  it('guards a bad seat count', () => {
    expect(arrivalsByDay([g('a', 3, '2027-02-13', true)], [], 0).days[0].vehicles).toBe(3);
  });
});

describe('check-in queue', () => {
  it('keeps only the latest write per household and day', () => {
    let q = enqueue([], { guest_id: 'a', event_date: '2027-02-15', people: 2 });
    q = enqueue(q, { guest_id: 'a', event_date: '2027-02-15', people: 0 });
    q = enqueue(q, { guest_id: 'a', event_date: '2027-02-14', people: 1 });
    expect(q).toHaveLength(2);
    expect(q.find((w) => w.event_date === '2027-02-15')?.people).toBe(0);
  });
  it('flush keeps failures, including thrown ones', async () => {
    const q = [1, 2, 3].map((n) => ({ guest_id: `g${n}`, event_date: '2027-02-15', people: n }));
    const left = await flush(q, async (w) => {
      if (w.people === 2) return false;
      if (w.people === 3) throw new Error('offline');
      return true;
    });
    expect(left.map((w) => w.people)).toEqual([2, 3]);
  });
});
