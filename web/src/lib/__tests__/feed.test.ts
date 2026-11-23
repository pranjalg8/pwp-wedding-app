import { describe, expect, it, vi } from 'vitest';

// feed.ts imports the Supabase client, which needs env vars CI doesn't have; these tests are pure helpers.
vi.mock('../supabase', () => ({ supabase: {} }));
import { daysUntil, dueLabel, isLive, nextQuietSlot, type FeedCard } from '../feed';

const at = (h: number, m = 0) => new Date(2026, 10, 23, h, m);

describe('nextQuietSlot', () => {
  it('lands on 8am before 8', () => expect(nextQuietSlot(at(6)).getHours()).toBe(8));
  it('lands on 5pm during the day', () => expect(nextQuietSlot(at(11)).getHours()).toBe(17));
  it('lands on tomorrow 8am in the evening', () => {
    const d = nextQuietSlot(at(21));
    expect([d.getDate(), d.getHours()]).toEqual([24, 8]);
  });
});

describe('due dates', () => {
  it('counts days from today', () => expect(daysUntil('2026-11-25', at(10))).toBe(2));
  it('labels overdue and today', () => {
    expect(dueLabel(null)).toBeNull();
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(dueLabel(iso)?.text).toBe('Due today');
  });
});

describe('isLive', () => {
  const base = { status: 'open', snooze_until: null } as FeedCard;
  it('shows open cards', () => expect(isLive(base)).toBe(true));
  it('hides snoozed cards until their slot', () => {
    const now = Date.now();
    expect(isLive({ ...base, status: 'snoozed', snooze_until: new Date(now + 60000).toISOString() }, now)).toBe(false);
    expect(isLive({ ...base, status: 'snoozed', snooze_until: new Date(now - 60000).toISOString() }, now)).toBe(true);
  });
  it('hides done and waiting cards', () => {
    expect(isLive({ ...base, status: 'done' })).toBe(false);
    expect(isLive({ ...base, status: 'waiting' })).toBe(false);
  });
});
