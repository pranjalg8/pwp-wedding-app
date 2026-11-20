import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer, parseSourcesKey, sourcesKey, uniqueChannelName } from '../realtime';
import { createAsyncCache } from '../asyncCache';
import { fetchAll } from '../fetchAll';
import { contactTextByGuest, guestMatches } from '../guestSearch';
import { firstError } from '../loadState';
import { daysFromFunctions } from '../rsvp';

describe('realtime helpers', () => {
  it('round-trips sources through the key, filters included', () => {
    const sources = ['tasks', { table: 'task_options', filter: 'task_id=eq.abc' }, { table: 'x', filter: 'id=in.(1,2)' }];
    const key = sourcesKey(sources);
    expect(key).toBe('tasks|task_options?task_id=eq.abc|x?id=in.(1,2)');
    expect(parseSourcesKey(key)).toEqual([{ table: 'tasks' }, { table: 'task_options', filter: 'task_id=eq.abc' }, { table: 'x', filter: 'id=in.(1,2)' }]);
    expect(parseSourcesKey('')).toEqual([]);
  });

  it('never hands out the same channel name twice', () => {
    const names = new Set(Array.from({ length: 50 }, () => uniqueChannelName(['guests', 'guest_contacts'])));
    expect(names.size).toBe(50);
    expect([...names][0]).toMatch(/^rt_guests_guest_contacts_/);
  });
});

describe('createDebouncer', () => {
  afterEach(() => vi.useRealTimers());

  it('collapses a burst into one trailing call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createDebouncer(fn, 300);
    for (let i = 0; i < 50; i++) d.call();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel drops a pending call, flush runs it now, 0 ms calls straight away', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createDebouncer(fn, 100);
    d.call();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    d.call();
    expect(d.pending()).toBe(true);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(d.pending()).toBe(false);
    const now = vi.fn();
    createDebouncer(now, 0).call();
    expect(now).toHaveBeenCalledTimes(1);
  });
});

describe('createAsyncCache', () => {
  it('shares one load until invalidated, and retries after a failure', async () => {
    let n = 0;
    const load = vi.fn(async () => {
      n += 1;
      if (n === 2) throw new Error('boom');
      return n;
    });
    const cache = createAsyncCache(load);
    expect(await Promise.all([cache.get(), cache.get()])).toEqual([1, 1]);
    expect(load).toHaveBeenCalledTimes(1);
    cache.invalidate();
    await expect(cache.get()).rejects.toThrow('boom');
    expect(await cache.get()).toBe(3);
    expect(await cache.get()).toBe(3);
  });

  it('reloads once the copy is older than maxAgeMs', async () => {
    let t = 0;
    let n = 0;
    const cache = createAsyncCache(async () => ++n, { maxAgeMs: 1000, now: () => t });
    expect(await cache.get()).toBe(1);
    t = 999;
    expect(await cache.get()).toBe(1);
    t = 1000;
    expect(await cache.get()).toBe(2);
  });
});

describe('fetchAll', () => {
  const table = Array.from({ length: 2500 }, (_, i) => i);
  it('pages until a short page comes back', async () => {
    const calls: [number, number][] = [];
    const { data, error } = await fetchAll(async (from, to) => {
      calls.push([from, to]);
      return { data: table.slice(from, to + 1), error: null };
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('asks once more when the last page is exactly full, and stops on an error', async () => {
    const exact = await fetchAll(async (from, to) => ({ data: table.slice(0, 20).slice(from, to + 1), error: null }), 10);
    expect(exact.data).toHaveLength(20);
    const failed = await fetchAll(async (from) => (from === 0 ? { data: [1, 2], error: null } : { data: null, error: { message: 'nope' } }), 2);
    expect(failed).toEqual({ data: null, error: { message: 'nope' } });
  });
});

describe('guest search', () => {
  const contacts = [
    { guest_id: 'a', person: 'Ravi', value: '+91 98765' },
    { guest_id: 'a', person: 'Meena', value: 'meena@example.com' },
    { guest_id: 'b', person: 'Arjun', value: '+91 11111' },
  ];
  const text = contactTextByGuest(contacts);
  const a = { id: 'a', name: 'Sharma family', location: 'Jaipur' };
  const c = { id: 'c', name: 'Gupta', relation: 'Cousin' };

  it('matches on guest fields or any of their contacts', () => {
    expect(guestMatches(a, '', text)).toBe(true);
    expect(guestMatches(a, 'jaipur', text)).toBe(true);
    expect(guestMatches(a, 'meena@', text)).toBe(true);
    expect(guestMatches(a, '98765', text)).toBe(true);
    expect(guestMatches(a, 'arjun', text)).toBe(false);
    expect(guestMatches(c, 'cousin', text)).toBe(true);
    expect(guestMatches(c, 'ravi', text)).toBe(false);
  });

  it('does not match across two contacts', () => {
    expect(guestMatches(a, '98765ravi', text)).toBe(false);
  });
});

describe('firstError', () => {
  it('returns the first failure message', () => {
    expect(firstError({ error: null }, { error: null })).toBeNull();
    expect(firstError({ error: null }, { error: { message: 'one' } }, { error: { message: 'two' } })).toBe('one');
  });
});

describe('daysFromFunctions', () => {
  it('groups guest functions by day and skips family-only ones', () => {
    const days = daysFromFunctions([
      { name: 'Haldi', event_date: '2027-02-15' },
      { name: 'Tilak', event_date: '2027-02-14' },
      { name: 'Puja', event_date: '2027-02-13', family_only: true },
      { name: 'Sangeet', event_date: '2027-02-14' },
    ]);
    expect(days.map((d) => d.date)).toEqual(['2027-02-14', '2027-02-15']);
    expect(days[0].functions).toEqual(['Tilak', 'Sangeet']);
  });
});
