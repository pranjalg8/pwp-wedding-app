import { describe, expect, it } from 'vitest';
import { buildTimeline, groupByMonth, visibleEntries } from '../timeline';

const today = '2026-11-20';

describe('buildTimeline', () => {
  const entries = buildTimeline(
    {
      tasks: [
        { id: 't1', title: 'Pre-move-in inspection', due_date: '2026-11-19', status: 'open' },
        { id: 't2', title: 'Book photographer', due_date: '2026-11-30', status: 'in_progress' },
        { id: 't3', title: 'Buy rings', due_date: '2026-10-29', status: 'done' },
        { id: 't4', title: 'No date yet', due_date: null, status: 'open' },
      ],
      payments: [
        { id: 'p1', payee: 'Deposit balance', amount: 104000, due_date: '2026-11-22', status: 'pending' },
        { id: 'p2', payee: 'Brokerage', amount: '28500.00', due_date: '2026-11-22', status: 'pending' },
        { id: 'p3', payee: 'Photographer advance', amount: 50000, due_date: '2026-11-30', status: 'pending' },
        { id: 'p4', payee: 'DJ', amount: 30000, due_date: '2027-02-05', status: 'cancelled' },
      ],
      functions: [{ id: 'f1', name: 'Haldi', event_date: '2027-02-15' }],
      honeymoon: { start: '2027-02-20', end: '2027-02-25' },
    },
    today
  );

  it('marks open tasks past their date as overdue, finished ones as done, and skips undated tasks', () => {
    expect(entries.find((e) => e.id === 'task-t1')?.state).toBe('overdue');
    expect(entries.find((e) => e.id === 'task-t3')?.state).toBe('done');
    expect(entries.find((e) => e.id === 'task-t4')).toBeUndefined();
  });

  it('folds payments on the same day into one entry and leaves cancelled lines out', () => {
    const day = entries.find((e) => e.id === 'pay-2026-11-22');
    expect(day?.title).toBe('2 payments due');
    expect(day?.detail).toBe('₹1.33L: Deposit balance, Brokerage');
    expect(day?.to).toBe('/budget');
    expect(entries.find((e) => e.id === 'pay-2027-02-05')).toBeUndefined();
    expect(entries.find((e) => e.id === 'pay-2026-11-30')?.title).toBe('Pay: Photographer advance');
  });

  it('sorts by date, with payments before tasks on the same day, and links each entry to its page', () => {
    const nov30 = entries.filter((e) => e.date === '2026-11-30').map((e) => e.section);
    expect(nov30).toEqual(['budget', 'tasks']);
    expect(entries.map((e) => e.date)).toEqual([...entries.map((e) => e.date)].sort());
    expect(entries.find((e) => e.id === 'honeymoon')?.to).toBe('/honeymoon');
    expect(entries.find((e) => e.id === 'fn-f1')?.milestone).toBe(true);
  });

  it('filters by planning or executing and hides finished work unless asked', () => {
    expect(visibleEntries(entries, 'plan', false).every((e) => e.phase === 'plan' && e.state !== 'done')).toBe(true);
    expect(visibleEntries(entries, 'execute', false).some((e) => e.section === 'tasks')).toBe(false);
    expect(visibleEntries(entries, 'all', true).some((e) => e.id === 'task-t3')).toBe(true);
  });

  it('groups under month headings in order', () => {
    const months = groupByMonth(visibleEntries(entries, 'all', false)).map((g) => g.key);
    expect(months).toEqual(['2026-11', '2027-02']);
  });
});
