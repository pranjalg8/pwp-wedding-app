import { describe, expect, it } from 'vitest';
import { buildAreas, buildPlan, filterScope, forSide, paridhiParts, scheduleForSide, shareOf, topUps, withFullFunds, type BudgetSettings } from '../budgetPlan';
import { line } from './fixtures';

const settings = (over: Partial<BudgetSettings> = {}): BudgetSettings => ({
  total_budget: null, funds_available: 100_000, funds_as_of: '2026-11-01', monthly_addition: 0,
  paridhi_funds_available: null, paridhi_monthly_addition: 0, ...over,
});

describe('splits', () => {
  it('splits a 1:2 line (new home) between the two sides', () => {
    expect(shareOf(30_000, 10_000, 'paridhi')).toBe(10_000);
    expect(shareOf(30_000, 10_000, 'pranjal')).toBe(20_000);
    expect(shareOf(30_000, 10_000, 'both')).toBe(30_000);
  });

  it('never gives Paridhi more than the whole payment, even if the stored share is too big', () => {
    expect(shareOf(10_000, 15_000, 'paridhi')).toBe(10_000);
    expect(shareOf(10_000, 15_000, 'pranjal')).toBe(0);
  });

  it('leaves out lines that cost a side nothing', () => {
    const rows = [line({ id: 'pranjal-only', amount: 5_000, due_date: '2026-12-01' }), line({ id: 'shared', amount: 9_000, paridhi_amount: 3_000, due_date: '2026-12-01' })];
    expect(forSide(rows, 'paridhi').map((r) => [r.id, r.amount])).toEqual([['shared', 3_000]]);
  });
});

describe('Paridhi instalments', () => {
  const photo = line({
    id: 'photo-final', amount: 160_000, due_date: '2027-02-01', paridhi_amount: 100_000,
    paridhi_plan: [{ on: '2026-12-15', amount: 40_000 }], paridhi_due_date: '2027-03-01',
  });

  it('puts her instalments first and the rest on her own date', () => {
    expect(paridhiParts(photo)).toEqual([{ on: '2026-12-15', amount: 40_000 }, { on: '2027-03-01', amount: 60_000 }]);
  });

  it('has Pranjal cover what she pays after the due date and shows it coming back', () => {
    const rows = scheduleForSide([photo], 'pranjal');
    // He pays 160k less her 40k paid before the due date, then gets 60k back on 1 Mar.
    expect(rows.map((r) => [r.due_date, r.amount, !!r.inflow])).toEqual([
      ['2027-02-01', 120_000, false],
      ['2027-03-01', -60_000, true],
    ]);
  });

  it('shows Paridhi only her own dated parts', () => {
    expect(scheduleForSide([photo], 'paridhi').map((r) => [r.due_date, r.amount])).toEqual([
      ['2026-12-15', 40_000],
      ['2027-03-01', 60_000],
    ]);
  });
});

describe('buildPlan', () => {
  const today = '2026-11-12';

  it('drops a cancelled line from what is still to pay (7 Nov: meals included at no charge)', () => {
    const pending = [
      line({ id: '13 Feb meals', amount: 120_000, due_date: '2027-02-05', status: 'cancelled' }),
      line({ id: '12 Feb dinner', amount: 24_750, due_date: '2027-02-05' }),
    ];
    const plan = buildPlan({ pending, paid: [], settings: settings(), today, throughMonth: '2027-02' });
    expect(plan.pendingTotal).toBe(24_750);
    expect(plan.pendingCount).toBe(1);
  });

  it('adds the monthly top-up and finds the first month that runs short', () => {
    const pending = [line({ id: 'rooms', amount: 150_000, due_date: '2027-01-20' })];
    const plan = buildPlan({ pending, paid: [], settings: settings({ monthly_addition: 20_000 }), today, throughMonth: '2027-02' });
    const jan = plan.months.find((m) => m.key === '2027-01')!;
    // 100k on 1 Nov, plus 20k in each of Dec and Jan = 140k, against 150k due: 10k short in January.
    expect(jan.balance).toBe(-10_000);
    expect(plan.firstShort?.key).toBe('2027-01');
    expect(topUps(plan)).toEqual([{ by: '2027-01-20', amount: 10_000 }]);
  });

  it('takes payments made after the funds date off the funds figure', () => {
    const plan = buildPlan({
      pending: [], paid: [{ id: 'p', paid_on: '2026-11-05', amount: 30_000, topic_id: null, paridhi_amount: 0 }],
      settings: settings(), today, throughMonth: '2026-11',
    });
    expect(plan.fundsNow).toBe(70_000);
  });

  it('counts an overdue line from the current month on', () => {
    const plan = buildPlan({ pending: [line({ id: 'late', amount: 5_000, due_date: '2026-11-01' })], paid: [], settings: settings(), today, throughMonth: '2026-11' });
    expect(plan.overdueTotal).toBe(5_000);
    expect(plan.months[0].cumulativeDue).toBe(5_000);
  });
});

describe('buildAreas', () => {
  it('shows each side its own share of paid and pending, and allocations only together', () => {
    const topics = [{ id: 't-stay', key: 'stay', label: 'Stay' }];
    const opts = {
      topics, items: [],
      paid: [{ id: 'p', paid_on: '2026-11-01', amount: 9_000, topic_id: 't-stay', paridhi_amount: 3_000 }],
      pending: [line({ id: 'sai', amount: 12_000, paridhi_amount: 7_000, due_date: '2027-01-15' })],
      areas: [{ id: 'a', topic_id: 't-stay', allocation: 50_000 }],
    };
    expect(buildAreas({ ...opts, side: 'both' })[0]).toMatchObject({ paid: 9_000, pending: 12_000, allocation: 50_000, left: 29_000 });
    expect(buildAreas({ ...opts, side: 'paridhi' })[0]).toMatchObject({ paid: 3_000, pending: 7_000, allocation: null });
  });
});

describe('wedding and after-the-wedding scopes', () => {
  const topics = [
    { id: 't-decor', key: 'decor', label: 'Decor', budget_group: 'wedding' as const },
    { id: 't-honey', key: 'honey', label: 'Honeymoon', budget_group: 'post_wedding' as const },
  ];
  const rows = [
    line({ id: 'decor', amount: 40_000, due_date: '2026-12-10', topic_id: 't-decor' }),
    line({ id: 'trip', amount: 60_000, due_date: '2026-12-15', topic_id: 't-honey' }),
  ];
  const opts = { paid: [], settings: settings(), today: '2026-11-15', throughMonth: '2026-12' };

  it('lists and totals each scope apart, but keeps the funds picture of everything', () => {
    const all = buildPlan({ pending: rows, ...opts });
    const wedding = withFullFunds(buildPlan({ pending: filterScope(rows, topics, 'wedding'), ...opts }), all);
    expect(wedding.pendingTotal).toBe(40_000);
    expect(wedding.months.find((m) => m.key === '2026-12')?.items.map((i) => i.id)).toEqual(['decor']);
    // the funds are one pool: 100,000 less both payments, not less the wedding alone
    expect(wedding.months.find((m) => m.key === '2026-12')?.balance).toBe(0);
    expect(wedding.leftAfterAll).toBe(0);
  });

  it('treats a payment with no area as part of the wedding', () => {
    expect(filterScope([line({ id: 'x', amount: 1, due_date: '2026-12-01', topic_id: null })], topics, 'wedding')).toHaveLength(1);
    expect(filterScope([line({ id: 'x', amount: 1, due_date: '2026-12-01', topic_id: null })], topics, 'post_wedding')).toHaveLength(0);
  });
});
