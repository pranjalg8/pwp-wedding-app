import { describe, expect, it } from 'vitest';
import { buildTree } from '../budgetTree';
import type { PaidRow, TopicRef } from '../budgetPlan';
import { line } from './fixtures';

const topics: TopicRef[] = [
  { id: 'j', key: 'jewellery', label: 'Jewellery', budget_group: 'gold' },
  { id: 'o', key: 'outfits', label: 'Outfits', budget_group: 'wedding' },
  { id: 'a', key: 'accommodations', label: 'Accommodations', budget_group: 'wedding' },
  { id: 'h', key: 'honeymoon', label: 'Honeymoon', budget_group: 'post_wedding' },
  { id: 'c', key: 'contingency', label: 'Contingency', budget_group: 'buffer' },
  { id: 'e', key: 'empty', label: 'Empty', budget_group: 'wedding' },
];
const paid = (over: Partial<PaidRow> & Pick<PaidRow, 'id' | 'amount'>): PaidRow => ({ paid_on: '2026-10-01', topic_id: 'j', paridhi_amount: 0, payee: over.id, ...over });
const pending = [
  line({ id: 'nath', amount: 175_000, due_date: '2026-11-21', topic_id: 'j' }),
  line({ id: 'sherwani', amount: 120_000, due_date: '2026-11-25', topic_id: 'o' }),
  line({ id: 'rooms', amount: 100_000, paridhi_amount: 40_000, due_date: '2027-01-15', topic_id: 'a', is_estimate: false }),
  line({ id: 'flights', amount: 150_000, due_date: '2026-11-15', topic_id: 'h' }),
  line({ id: 'buffer', amount: 150_000, due_date: '2027-02-05', topic_id: 'c' }),
  line({ id: 'cancelled', amount: 9_999, due_date: '2027-01-01', topic_id: 'o', status: 'cancelled' }),
];
const ledger = [paid({ id: 'necklace', amount: 900_000 }), paid({ id: 'ring', amount: 100_000, paridhi_amount: 82_000, topic_id: 'j' })];
const group = (t: ReturnType<typeof buildTree>, key: string) => t.groups.find((g) => g.key === key)!;

describe('budget tree', () => {
  it('rolls payments up into areas and areas up into headers', () => {
    const t = buildTree({ topics, paid: ledger, pending, side: 'both' });
    const gold = group(t, 'gold');
    expect(gold.paid).toBe(1_000_000);
    expect(gold.pending).toBe(175_000);
    expect(gold.children.map((c) => c.label)).toEqual(['Jewellery']);
    expect(gold.children[0].lines.map((l) => l.label)).toEqual(['necklace', 'ring', 'nath']);
    expect(group(t, 'wedding').pending).toBe(220_000);
    expect(group(t, 'post_wedding').pending).toBe(150_000);
  });

  it('keeps the buffer out of the grand total', () => {
    const t = buildTree({ topics, paid: ledger, pending, side: 'both' });
    expect(t.total.pending).toBe(175_000 + 220_000 + 150_000);
    expect(t.total.paid).toBe(1_000_000);
    expect(t.outside?.pending).toBe(150_000);
  });

  it('leaves out cancelled payments and areas with no money', () => {
    const t = buildTree({ topics, paid: ledger, pending, side: 'both' });
    const wedding = group(t, 'wedding');
    expect(wedding.children.map((c) => c.label)).toEqual(['Outfits', 'Accommodations']);
    expect(wedding.children[0].pending).toBe(120_000);
  });

  it('splits each payment by side', () => {
    const p = buildTree({ topics, paid: ledger, pending, side: 'paridhi' });
    expect(p.total.paid).toBe(82_000);
    expect(p.total.pending).toBe(40_000);
    const m = buildTree({ topics, paid: ledger, pending, side: 'pranjal' });
    expect(m.total.paid).toBe(918_000);
    expect(group(m, 'wedding').pending).toBe(120_000 + 60_000);
  });

  it('shows budgets only in Pranjal view and sums them for the total', () => {
    const budgets = { gold: 1_460_000, wedding: 1_500_000, post_wedding: 640_000 };
    const m = buildTree({ topics, paid: ledger, pending, side: 'pranjal', budgets });
    expect(group(m, 'gold').budget).toBe(1_460_000);
    expect(m.total.budget).toBe(3_600_000);
    expect(buildTree({ topics, paid: ledger, pending, side: 'both', budgets }).total.budget).toBeNull();
  });

  it('puts payments with no area under an Unassigned area of the wedding', () => {
    const t = buildTree({ topics, paid: [paid({ id: 'cash', amount: 5_000, topic_id: null })], pending: [], side: 'both' });
    const wedding = group(t, 'wedding');
    expect(wedding.children.map((c) => c.label)).toEqual(['Unassigned']);
    expect(wedding.paid).toBe(5_000);
  });
});
