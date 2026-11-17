import { describe, expect, it } from 'vitest';
import { buildPlan, lineAmount, splitByBudget, vendorTotals, type BudgetSettings, type Vendor } from '../budgetPlan';
import { line } from './fixtures';

const vendor = (id: string, name: string): Vendor => ({ id, name, kind: 'hotel', planning_item_id: null, notes: null });

describe('lineAmount', () => {
  it('is quantity x rate rounded to the rupee, and null unless both are set', () => {
    // Shri Kanth: 10 extra rooms on 12 Feb at Rs 3,500.
    expect(lineAmount(10, 3500)).toBe(35000);
    expect(lineAmount(2.5, 999.99)).toBe(2500);
    expect(lineAmount(10, null)).toBeNull();
    expect(lineAmount(null, 3500)).toBeNull();
    expect(lineAmount(0, 3500)).toBe(0);
  });
});

describe('splitByBudget', () => {
  it('keeps lines in the budget unless marked outside; old rows with no flag count', () => {
    const rows = [line({ id: 'a', amount: 1, due_date: '2026-12-01' }), line({ id: 'b', amount: 1, due_date: '2026-12-01', in_budget: false }), line({ id: 'c', amount: 1, due_date: '2026-12-01', in_budget: true })];
    const { inBudget, outside } = splitByBudget(rows);
    expect(inBudget.map((r) => r.id)).toEqual(['a', 'c']);
    expect(outside.map((r) => r.id)).toEqual(['b']);
  });
});

describe('a Rs 0 "included" line', () => {
  it('stays on the plan and costs nothing', () => {
    // 13 Feb meals confirmed with the hall at no charge.
    const settings: BudgetSettings = { total_budget: 100000, funds_available: 50000, funds_as_of: '2026-11-01', monthly_addition: 0, paridhi_funds_available: null, paridhi_monthly_addition: 0 };
    const pending = [line({ id: 'meals', amount: 0, due_date: '2027-02-13' }), line({ id: 'rooms', amount: 35000, due_date: '2027-02-01' })];
    const plan = buildPlan({ pending, paid: [], settings, today: '2026-11-18', throughMonth: '2027-02' });
    expect(plan.pendingTotal).toBe(35000);
    expect(plan.months.flatMap((m) => m.items.map((p) => p.id))).toContain('meals');
    expect(plan.pendingCount).toBe(2);
  });
});

describe('vendorTotals', () => {
  it('adds paid and still-to-pay per vendor, leaving out cancelled lines and other vendors', () => {
    const rows = [
      line({ id: 'r1', amount: 157200, due_date: '2027-01-15', vendor_id: 'sk' }),
      line({ id: 'r2', amount: 24750, due_date: '2027-02-12', vendor_id: 'sk', status: 'paid' }),
      line({ id: 'r3', amount: 40000, due_date: '2027-02-12', vendor_id: 'sk', status: 'cancelled' }),
      line({ id: 'r4', amount: 120500, due_date: '2027-01-20', vendor_id: 'sai' }),
      line({ id: 'r5', amount: 5000, due_date: '2027-01-20' }),
    ];
    const out = vendorTotals([vendor('sai', 'Hotel Sai, Bawal'), vendor('sk', 'Shri Kanth Hotel'), vendor('rp', 'Royal Pepper')], rows);
    expect(out.map((r) => [r.vendor.id, r.paid, r.pending, r.lines])).toEqual([
      ['sk', 24750, 157200, 2],
      ['sai', 0, 120500, 1],
      ['rp', 0, 0, 0],
    ]);
  });
});
