import { describe, expect, it } from 'vitest';
import { scrub, toProposals, validDate } from '../../../../supabase/functions/doc-extract/extract';

const TODAY = '2026-11-18';

describe('doc-extract helpers', () => {
  it('removes bank, UPI, PAN, GST, phone and email details', () => {
    const out = scrub('A/c 123456789012 IFSC HDFC0001234 upi pay@okhdfc PAN ABCDE1234F call 9876543210 mail a@b.com');
    expect(out).not.toMatch(/123456789012|HDFC0001234|okhdfc|ABCDE1234F|9876543210|a@b\.com/);
    expect(out).toContain('[removed]');
  });

  it('accepts only real dates in range', () => {
    expect(validDate('2026-11-30')).toBe('2026-11-30');
    expect(validDate('2026-02-30')).toBeNull();
    expect(validDate('30/11/2026')).toBeNull();
    expect(validDate('2031-01-01')).toBeNull();
  });

  it('keeps dated payments and tasks, skips malformed, undated and repeated ones', () => {
    const raw = {
      vendor: 'Lensflix',
      topic_key: 'photography',
      summary: 'Photography quote',
      payments: [
        { label: 'Advance', amount: 50000, due_date: '2026-11-30', source_line: 'Advance Rs 50,000 by 30 Nov' },
        { label: 'Balance', amount: 'lots', due_date: '2027-02-10', source_line: 'x' },
        { label: 'Final', amount: 100000, due_date: null, source_line: 'Balance on delivery' },
        { label: 'Again', amount: 50000, due_date: '2026-11-30', source_line: 'dup' },
      ],
      tasks: [{ title: 'Confirm the shot list', due_date: '2027-01-15', priority: 'high', source_line: 'shot list by 15 Jan' }, { title: '', source_line: '' }],
      terms: { cancellation: 'Advance not refundable', inclusions: ['2 photographers'] },
    };
    const p = toProposals(raw, [], TODAY, null);
    expect(p.topicKey).toBe('photography');
    expect(p.payments.map((x) => x.amount)).toEqual([50000]);
    expect(p.payments[0].payee).toBe('Lensflix - Advance');
    expect(p.dropped.some((d) => d.includes('Final') && d.includes('no due date'))).toBe(true);
    expect(p.tasks).toHaveLength(1);
    expect(p.tasks[0].priority).toBe('high');
    expect(p.termsNote?.detail).toContain('Advance not refundable');
    expect(p.dropped.length).toBe(3);
  });

  it('skips payments the planner already has and anything for Royal Pepper', () => {
    const existing = [{ payee: 'Lensflix advance', amount: 50000, due_date: '2026-11-30', topic_key: 'photography' }];
    const dup = toProposals({ vendor: 'Lensflix', payments: [{ label: 'Advance', amount: 50000, due_date: '2026-12-05', source_line: 's' }] }, existing, TODAY, null);
    expect(dup.payments).toEqual([]);
    const rp = toProposals({ vendor: 'Royal Pepper', payments: [{ label: 'Rooms', amount: 900000, due_date: '2027-01-01', source_line: 's' }] }, [], TODAY, null);
    expect(rp.payments).toEqual([]);
  });

  it('falls back to the document topic when the model gives none', () => {
    expect(toProposals({}, [], TODAY, 'decor').topicKey).toBe('decor');
    expect(toProposals(null, [], TODAY, null).topicKey).toBe('dates_logistics');
  });
});
