import { describe, expect, it } from 'vitest';
import {
  HOTEL_SAI,
  SHRI_KANTH,
  pranjalShare,
  shapeSnapshot,
  tokenMatches,
  type ScheduleRow,
  type SnapshotInput,
} from '../../../../supabase/functions/sheet-snapshot/rules';

const NOW = new Date('2026-11-20T10:00:00Z');

const line = (o: Partial<ScheduleRow>): ScheduleRow => ({
  payee: 'Line',
  amount: 1000,
  paridhi_amount: 0,
  due_date: '2027-01-01',
  topic_id: 'tw',
  note: null,
  is_estimate: false,
  status: 'pending',
  paid_payment_id: null,
  vendor_id: null,
  quantity: null,
  unit: null,
  rate: null,
  adjustment: 0,
  in_budget: true,
  ...o,
});

const base = (): SnapshotInput => ({
  topics: [
    { id: 'tw', budget_group: 'wedding' },
    { id: 'tg', budget_group: 'gold' },
    { id: 'tp', budget_group: 'post_wedding' },
    { id: 'tb', budget_group: 'buffer' },
  ],
  payments: [],
  schedule: [],
  vendors: [
    { id: 'vsk', name: SHRI_KANTH },
    { id: 'vhs', name: HOTEL_SAI },
  ],
  stayNights: [],
  settings: { total_budget: '2000000', funds_available: '500000', funds_as_of: '2026-11-01', monthly_addition: '0' },
});

describe('pranjalShare', () => {
  it('is the amount less Paridhi share, capped at the amount', () => {
    expect(pranjalShare(1000, 400)).toBe(600);
    expect(pranjalShare('1000.00', '0.00')).toBe(1000);
    expect(pranjalShare(1000, 5000)).toBe(0);
  });
});

describe('shapeSnapshot totals', () => {
  it('counts paid from the ledger and pending from the schedule, Pranjal share only', () => {
    const i = base();
    i.payments = [{ amount: '60000.00', paridhi_amount: '10000.00', topic_id: 'tw' }];
    i.schedule = [line({ amount: 100000, paridhi_amount: 25000 }), line({ amount: 5000 })];
    const s = shapeSnapshot(i, NOW);
    expect(s.wedding).toEqual({ total: 130000, paid: 50000, pending: 80000, paid_count: 1, pending_count: 2 });
  });

  it('counts a ledger entry once when its schedule line is marked paid', () => {
    const i = base();
    i.payments = [{ amount: 60000, paridhi_amount: 0, topic_id: 'tw' }];
    i.schedule = [line({ status: 'paid', amount: 60000, paid_payment_id: 'pay1' })];
    const s = shapeSnapshot(i, NOW);
    expect(s.wedding.paid).toBe(60000);
    expect(s.wedding.paid_count).toBe(1);
    expect(s.wedding.total).toBe(60000);
  });

  it('counts a paid line with no ledger entry as paid', () => {
    const i = base();
    i.schedule = [line({ status: 'paid', amount: 7000, paridhi_amount: 2000 })];
    expect(shapeSnapshot(i, NOW).wedding.paid).toBe(5000);
  });

  it('leaves out cancelled lines and lines outside the budget', () => {
    const i = base();
    i.schedule = [line({ status: 'cancelled', amount: 305000 }), line({ in_budget: false, amount: 9999 }), line({ amount: 1 })];
    expect(shapeSnapshot(i, NOW).wedding.pending).toBe(1);
  });

  it('leaves out gold, post-wedding and buffer, but keeps lines with no area as wedding', () => {
    const i = base();
    i.payments = [
      { amount: 1635285, paridhi_amount: 0, topic_id: 'tg' },
      { amount: 10000, paridhi_amount: 0, topic_id: 'tp' },
      { amount: 60000, paridhi_amount: 0, topic_id: 'tw' },
      { amount: 500, paridhi_amount: 0, topic_id: null },
    ];
    i.schedule = [
      line({ amount: 175000, topic_id: 'tg' }),
      line({ amount: 635333.34, topic_id: 'tp' }),
      line({ amount: 150000, topic_id: 'tb' }),
      line({ amount: 1895295, topic_id: 'tw' }),
    ];
    const s = shapeSnapshot(i, NOW);
    expect(s.wedding.paid).toBe(60500);
    expect(s.wedding.pending).toBe(1895295);
  });

  it('rounds to paise and tolerates string numerics', () => {
    const i = base();
    i.schedule = [line({ amount: '100.10', paridhi_amount: '0.05' }), line({ amount: '0.20' })];
    expect(shapeSnapshot(i, NOW).wedding.pending).toBe(100.25);
  });
});

describe('shapeSnapshot vendors, nights and settings', () => {
  it('returns the vendor lines for the two hotels with their numbers, ordered by due date', () => {
    const i = base();
    i.schedule = [
      line({ payee: 'Hotel Sai, Bawal: balance', vendor_id: 'vhs', quantity: '45', unit: 'room-nights', rate: '2500', adjustment: '14525', amount: '127025.00', paridhi_amount: '73080.00', due_date: '2027-01-15', note: 'n' }),
      line({ payee: 'Shri Kanth Hotel: rooms', vendor_id: 'vsk', quantity: 74, unit: 'room-nights', rate: 2800, adjustment: -50000, amount: 157200, due_date: '2027-01-20' }),
      line({ payee: '13 Feb: meals for everyone', vendor_id: 'vsk', quantity: 80, unit: 'people', rate: 1500, amount: 120000, due_date: '2027-02-05' }),
      line({ payee: 'Other vendor', vendor_id: 'vother', amount: 1 }),
      line({ payee: 'Cancelled', vendor_id: 'vsk', status: 'cancelled' }),
      line({ payee: 'Gold-area line', vendor_id: 'vsk', topic_id: 'tg' }),
    ];
    const s = shapeSnapshot(i, NOW);
    expect(s.vendors.shri_kanth.map((l) => l.item)).toEqual(['Shri Kanth Hotel: rooms', '13 Feb: meals for everyone']);
    expect(s.vendors.hotel_sai).toEqual([
      {
        item: 'Hotel Sai, Bawal: balance',
        quantity: 45,
        unit: 'room-nights',
        rate: 2500,
        adjustment: 14525,
        amount: 127025,
        paridhi_amount: 73080,
        pranjal_amount: 53945,
        due_date: '2027-01-15',
        status: 'pending',
        is_estimate: false,
        note: 'n',
      },
    ]);
  });

  it('gives empty vendor lines when a vendor is missing', () => {
    const i = base();
    i.vendors = [];
    expect(shapeSnapshot(i, NOW).vendors).toEqual({ shri_kanth: [], hotel_sai: [] });
  });

  it('groups stay nights per site, sorted, for the two hotels only', () => {
    const i = base();
    i.stayNights = [
      { night: '2027-02-15', rooms: 18, stay_sites: { name: HOTEL_SAI } },
      { night: '2027-02-14', rooms: 3, stay_sites: [{ name: HOTEL_SAI }] },
      { night: '2027-02-13', rooms: 18, stay_sites: { name: SHRI_KANTH } },
      { night: '2027-02-12', rooms: 10, stay_sites: { name: SHRI_KANTH } },
      { night: '2027-02-14', rooms: 34, stay_sites: { name: 'Royal Pepper' } },
      { night: '2027-02-14', rooms: 1, stay_sites: null },
    ];
    const s = shapeSnapshot(i, NOW);
    expect(s.stay_nights.hotel_sai).toEqual([{ night: '2027-02-14', rooms: 3 }, { night: '2027-02-15', rooms: 18 }]);
    expect(s.stay_nights.shri_kanth).toEqual([{ night: '2027-02-12', rooms: 10 }, { night: '2027-02-13', rooms: 18 }]);
  });

  it('shares only the wedding budget figures, stamped with the time', () => {
    const s = shapeSnapshot(base(), NOW);
    expect(s.generated_at).toBe('2026-11-20T10:00:00.000Z');
    expect(s.budget_settings).toEqual({ total_budget: 2000000, funds_available: 500000, funds_as_of: '2026-11-01', monthly_addition: 0 });
    expect(s.scope).toBe('wedding');
    expect(JSON.stringify(s)).not.toMatch(/gold|post_wedding/);
  });

  it('copes with no settings row', () => {
    const i = base();
    i.settings = null;
    expect(shapeSnapshot(i, NOW).budget_settings).toEqual({ total_budget: null, funds_available: null, funds_as_of: null, monthly_addition: 0 });
  });
});

describe('tokenMatches', () => {
  it('accepts only the exact token', async () => {
    expect(await tokenMatches('s3cret-value', 's3cret-value')).toBe(true);
    expect(await tokenMatches('s3cret-valuE', 's3cret-value')).toBe(false);
    expect(await tokenMatches('s3cret', 's3cret-value')).toBe(false);
    expect(await tokenMatches('s3cret-value-and-more', 's3cret-value')).toBe(false);
  });

  it('fails closed when the header or the secret is missing or empty', async () => {
    expect(await tokenMatches(null, 'x')).toBe(false);
    expect(await tokenMatches('', 'x')).toBe(false);
    expect(await tokenMatches('x', undefined)).toBe(false);
    expect(await tokenMatches('x', '')).toBe(false);
    expect(await tokenMatches('', '')).toBe(false);
    expect(await tokenMatches(undefined, undefined)).toBe(false);
  });
});
