import { describe, expect, it } from 'vitest';
import { dueLabel, dueSoon } from '../duePayments';

const p = (id: string, due: string | null, status = 'pending', amount = 1000) => ({ id, payee: id, amount, due_date: due, status });

describe('dueSoon', () => {
  const today = '2026-11-21';
  it('keeps overdue and near payments, oldest first, and drops paid, undated and far ones', () => {
    const out = dueSoon([p('far', '2027-01-01'), p('paid', '2026-11-22', 'paid'), p('none', null), p('soon', '2026-11-30'), p('late', '2026-11-10')], today);
    expect(out.map((x) => x.id)).toEqual(['late', 'soon']);
    expect(out.map((x) => x.days)).toEqual([-11, 9]);
  });
  it('includes the window edge', () => {
    expect(dueSoon([p('a', '2026-12-05')], today, 14)).toHaveLength(1);
    expect(dueSoon([p('a', '2026-12-06')], today, 14)).toHaveLength(0);
  });
  it('words the label', () => {
    expect(dueLabel(-1)).toBe('1 day overdue');
    expect(dueLabel(0)).toBe('due today');
    expect(dueLabel(3)).toBe('due in 3 days');
  });
});
