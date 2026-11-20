import { describe, expect, it } from 'vitest';
import {
  CODES,
  fingerprint,
  figuresIn,
  handoverFromNotes,
  headerTotals,
  reviewBudget,
  type Flag,
  type PaymentRow,
  type ReviewInput,
  type ScheduleRow,
} from '../../../../supabase/functions/budget-review/checks';

const TODAY = '2026-11-20';
const TOPICS = [
  { id: 't-wed', key: 'stay', label: 'Stay', budget_group: 'wedding' as const },
  { id: 't-gold', key: 'gold', label: 'Gold', budget_group: 'gold' as const },
  { id: 't-home', key: 'home', label: 'New home', budget_group: 'post_wedding' as const },
  { id: 't-buf', key: 'buffer', label: 'Buffer', budget_group: 'buffer' as const },
];
const VENDORS = [
  { id: 'v-sai', name: 'Hotel Sai, Bawal', kind: 'hotel' },
  { id: 'v-mal', name: 'Malabar Gold & Diamonds', kind: 'jeweller' },
];

const row = (over: Partial<ScheduleRow> & Pick<ScheduleRow, 'id' | 'amount'>): ScheduleRow => ({
  payee: over.id,
  due_date: '2027-01-15',
  topic_id: 't-wed',
  note: null,
  is_estimate: true,
  status: 'pending',
  paid_payment_id: null,
  paridhi_amount: 0,
  ...over,
});
const pay = (over: Partial<PaymentRow> & Pick<PaymentRow, 'id' | 'amount'>): PaymentRow => ({
  paid_on: '2026-10-29',
  payee: over.id,
  topic_id: 't-wed',
  paridhi_amount: 0,
  reference: 'UTR123',
  method: 'NEFT',
  verification: 'receipt_checked',
  ...over,
});
const review = (over: Partial<ReviewInput> = {}) => reviewBudget({ today: TODAY, schedule: [], payments: [], settings: null, topics: TOPICS, vendors: VENDORS, ...over });
const codes = (flags: Flag[]) => flags.map((f) => f.code);
const about = (flags: Flag[], id: string) => flags.filter((f) => f.rowId === id);

// ---- the four mistakes found in the 20 Nov 2026 review ---------------------------------------------------------

describe('regression: Hotel Sai balance (20 Nov 2026)', () => {
  // 45 room-nights at 2,500, breakfast 200 a person 2 a room, token 10,000 paid. The row had no GST and Paridhi 70,000.
  const wrong = row({
    id: 'sai', payee: 'Hotel Sai, Bawal: balance', vendor_id: 'v-sai', amount: 120500, paridhi_amount: 70000,
    quantity: 45, unit: 'room-nights', rate: 2500, adjustment: 8000,
    note: '45 room-nights at ₹2,500 = ₹1,12,500. Breakfast ₹200 a person, 2 a room = ₹18,000. Total ₹1,30,500. Less the ₹10,000 token = ₹1,20,500 still to pay.',
  });
  const right = row({
    id: 'sai', payee: 'Hotel Sai, Bawal: balance', vendor_id: 'v-sai', amount: 127025, paridhi_amount: 73080,
    quantity: 45, unit: 'room-nights', rate: 2500, adjustment: 14525,
    note: '45 room-nights at ₹2,500 = ₹1,12,500. Breakfast ₹200 a person, 2 a room = ₹18,000. GST 5% on both = ₹6,525. Total ₹1,37,025. Less the ₹10,000 token = ₹1,27,025 still to pay.',
  });

  it('flags the rounded Paridhi share and the missing GST on the old row', () => {
    const f = about(review({ schedule: [wrong] }), 'sai');
    expect(codes(f)).toContain(CODES.PARIDHI_ROUNDED);
    expect(codes(f)).toContain(CODES.GST_NOT_STATED);
    expect(codes(f)).not.toContain(CODES.LINE_ARITHMETIC); // the arithmetic itself was right
  });

  it('is quiet about the corrected row', () => {
    expect(about(review({ schedule: [right] }), 'sai')).toEqual([]);
  });

  it('flags a note whose total the row does not follow', () => {
    const f = about(review({ schedule: [{ ...wrong, note: 'Hotel total ₹1,37,025 incl. GST, token ₹10,000 paid.' }] }), 'sai');
    expect(codes(f)).toContain(CODES.NOTE_AMOUNT_MISMATCH);
    expect(f.find((x) => x.code === CODES.NOTE_AMOUNT_MISMATCH)!.message).toMatch(/16,525/);
  });

  it('flags quantity x rate that no longer gives the amount', () => {
    const f = about(review({ schedule: [{ ...right, amount: 120500 }] }), 'sai');
    expect(f.find((x) => x.code === CODES.LINE_ARITHMETIC)!.details).toMatchObject({ expected: 127025, amount: 120500 });
  });
});

describe('regression: new-home rent changed without Paridhi share (20 Nov 2026)', () => {
  const rent = row({
    id: 'rent', payee: 'New home IC4-102: prorated November rent', topic_id: 't-home', due_date: '2026-11-22',
    amount: 17100, paridhi_amount: 6333.33, note: '9 days of Rs 57,000 for 22-30 Nov = Rs 17,100. Split 1:2.',
  });
  it('flags a Paridhi share that does not follow the 1:2 split', () => {
    const f = about(review({ schedule: [rent] }), 'rent').find((x) => x.code === CODES.SPLIT_NOTE_MISMATCH)!;
    expect(f.severity).toBe('error');
    expect(f.details.expected_paridhi).toBe(5700);
    expect(f.message).toMatch(/5,700/);
  });
  it('passes with 5,700', () => {
    expect(codes(review({ schedule: [{ ...rent, paridhi_amount: 5700 }] }))).not.toContain(CODES.SPLIT_NOTE_MISMATCH);
  });
});

describe('regression: payments missing from the ledger (20 Nov 2026)', () => {
  const paidItems = [
    { id: 'i-kalyan', title: 'Kalyan: mangalsutra', amount: 160880, amount_kind: 'paid', topic_id: 't-gold' },
    { id: 'i-home', title: 'New home: token', amount: 10000, amount_kind: 'paid', topic_id: 't-home' },
    { id: 'i-malabar', title: 'Malabar: advance', amount: 37500, amount_kind: 'paid', topic_id: 't-gold' },
    { id: 'i-sai', title: 'Hotel Sai: token', amount: 10000, amount_kind: 'paid', topic_id: 't-wed' },
  ];
  it('flags the three paid items with no ledger entry, and not the one that has one', () => {
    const payments = [pay({ id: 'p-sai', payee: 'Hotel Sai', amount: 10000, item_id: 'i-sai' })];
    const f = review({ paidItems, payments }).filter((x) => x.code === CODES.PAID_ITEM_NOT_IN_LEDGER);
    expect(f.map((x) => x.rowId).sort()).toEqual(['i-home', 'i-kalyan', 'i-malabar']);
  });
  it('does not let one 10,000 ledger entry cover two 10,000 paid items', () => {
    const payments = [pay({ id: 'p1', amount: 10000 })];
    const two = paidItems.filter((i) => i.amount === 10000);
    expect(review({ paidItems: two, payments }).filter((x) => x.code === CODES.PAID_ITEM_NOT_IN_LEDGER)).toHaveLength(1);
  });
  it('flags a schedule line marked paid with no ledger entry', () => {
    const f = review({ schedule: [row({ id: 'k', payee: 'Kalyan', amount: 160880, status: 'paid' })] });
    expect(codes(f)).toContain(CODES.PAID_NOT_IN_LEDGER);
  });
  it('accepts a paid line that is linked, or that someone else paid', () => {
    const payments = [pay({ id: 'p1', amount: 5000 })];
    const f = review({ payments, schedule: [row({ id: 'a', amount: 5000, status: 'paid', paid_payment_id: 'p1' }), row({ id: 'b', amount: 9000, status: 'paid', in_budget: false })] });
    expect(codes(f)).not.toContain(CODES.PAID_NOT_IN_LEDGER);
  });
});

describe('regression: Paridhi NEFT of 87,000 recorded as 82,000 (20 Nov 2026)', () => {
  it('flags the amount against the figure in its note', () => {
    const p = pay({ id: 'neft', payee: 'Paridhi: transfer to Pranjal', amount: 82000, verification_note: 'NEFT of ₹87,000 on 29 Oct, UTR checked in bank app' });
    const f = review({ payments: [p] }).find((x) => x.code === CODES.PAYMENT_NOTE_MISMATCH)!;
    expect(f.severity).toBe('error');
    expect(f.details).toEqual({ amount: 82000, note_figure: 87000 });
  });
  it('is quiet when the note agrees', () => {
    const p = pay({ id: 'neft', amount: 87000, verification_note: 'NEFT of ₹87,000 on 29 Oct' });
    expect(codes(review({ payments: [p] }))).not.toContain(CODES.PAYMENT_NOTE_MISMATCH);
  });
  it('ignores unrelated figures in a note', () => {
    const p = pay({ id: 'x', amount: 87000, purpose: 'Advance, balance ₹5,00,000 later' });
    expect(codes(review({ payments: [p] }))).not.toContain(CODES.PAYMENT_NOTE_MISMATCH);
  });
});

// ---- the other checks ------------------------------------------------------------------------------------------

describe('Paridhi shares', () => {
  it('flags a share larger than the amount', () => {
    expect(codes(review({ schedule: [row({ id: 'a', amount: 1000, paridhi_amount: 1500 })] }))).toContain(CODES.PARIDHI_EXCEEDS_AMOUNT);
  });
  it('flags instalments above her share', () => {
    const r = row({ id: 'a', amount: 1000, paridhi_amount: 500, paridhi_plan: [{ on: '2027-01-01', amount: 300 }, { on: '2027-02-01', amount: 300 }] });
    expect(codes(review({ schedule: [r] }))).toContain(CODES.PARIDHI_PLAN_EXCEEDS);
  });
  it("leaves the photographer's deliberate uneven split alone", () => {
    const r = row({ id: 'p', amount: 160000, paridhi_amount: 105000, note: 'Photography cost is split 50/50 with Paridhi (assumed).' });
    expect(codes(review({ schedule: [r] }))).not.toContain(CODES.SPLIT_NOTE_MISMATCH);
  });
});

describe('dates', () => {
  it('flags pending lines past their due date', () => {
    expect(codes(review({ schedule: [row({ id: 'a', amount: 100, due_date: '2026-11-01' })] }))).toContain(CODES.DUE_PAST);
    expect(codes(review({ schedule: [row({ id: 'a', amount: 100, due_date: '2026-11-20' })] }))).not.toContain(CODES.DUE_PAST);
    expect(codes(review({ schedule: [row({ id: 'a', amount: 100, due_date: '2026-11-01', status: 'paid', paid_payment_id: 'x' })] }))).not.toContain(CODES.DUE_PAST);
  });
  it('flags new-home lines due before the handover read from the notes', () => {
    const lines = [
      row({ id: 'dep', payee: 'New home IC4-102: deposit', amount: 104000, due_date: '2026-11-20', note: 'Possession postponed from 20 to 22 Nov (Pranjal, 18 Nov).' }),
      row({ id: 'rent', payee: 'New home IC4-102: rent', amount: 17100, due_date: '2026-11-22' }),
    ];
    expect(handoverFromNotes(lines, TODAY)).toBe('2026-11-22');
    const f = review({ schedule: lines });
    expect(about(f, 'dep').map((x) => x.code)).toContain(CODES.DUE_BEFORE_HANDOVER);
    expect(about(f, 'rent').map((x) => x.code)).not.toContain(CODES.DUE_BEFORE_HANDOVER);
  });
});

describe('estimates and GST', () => {
  it('flags round placeholders and notes that say rough', () => {
    const f = review({ schedule: [row({ id: 'a', amount: 50000, is_estimate: false }), row({ id: 'b', amount: 12345, is_estimate: false, note: 'Rough figure, no quote yet' }), row({ id: 'c', amount: 50000, is_estimate: true })] });
    expect(about(f, 'a').map((x) => x.code)).toContain(CODES.ESTIMATE_NOT_MARKED);
    expect(about(f, 'b').map((x) => x.code)).toContain(CODES.ESTIMATE_NOT_MARKED);
    expect(about(f, 'c')).toEqual([]);
  });
  it('asks about GST on vendor lines only when the note is silent', () => {
    const f = review({ schedule: [row({ id: 'a', amount: 292500, vendor_id: 'v-mal', is_estimate: false }), row({ id: 'b', amount: 292500, vendor_id: 'v-mal', note: 'GST 3% included', is_estimate: false })] });
    expect(about(f, 'a').map((x) => x.code)).toContain(CODES.GST_NOT_STATED);
    expect(about(f, 'b').map((x) => x.code)).not.toContain(CODES.GST_NOT_STATED);
  });
});

describe('ledger against schedule', () => {
  it('flags a pending line that the ledger already shows paid', () => {
    const f = review({ schedule: [row({ id: 'a', payee: 'Decor advance', amount: 25000, vendor_id: 'v-sai' })], payments: [pay({ id: 'p', payee: 'Decor advance', amount: 25000, vendor_id: 'v-sai' })] });
    expect(codes(f)).toContain(CODES.PAID_STILL_PENDING);
  });
  it('flags a broken ledger link, one payment closing two lines, and a duplicate entry', () => {
    const f = review({
      payments: [pay({ id: 'p1', amount: 100 }), pay({ id: 'p2', payee: 'Dup', amount: 200 }), pay({ id: 'p3', payee: 'Dup', amount: 200 })],
      schedule: [
        row({ id: 'a', amount: 100, status: 'paid', paid_payment_id: 'gone' }),
        row({ id: 'b', amount: 50, status: 'paid', paid_payment_id: 'p1' }),
        row({ id: 'c', amount: 50, status: 'paid', paid_payment_id: 'p1' }),
      ],
    });
    expect(codes(f)).toEqual(expect.arrayContaining([CODES.LEDGER_LINK_BROKEN, CODES.DOUBLE_COUNT]));
    expect(f.filter((x) => x.code === CODES.DOUBLE_COUNT)).toHaveLength(2);
  });
  it('does not call two same-day payments a duplicate when their receipts differ', () => {
    const a = pay({ id: 'a', payee: 'Malabar', amount: 37000, reference: 'Advance ...134' });
    const b = pay({ id: 'b', payee: 'Malabar', amount: 37000, reference: 'Advance ...135' });
    expect(codes(review({ payments: [a, b] }))).not.toContain(CODES.DOUBLE_COUNT);
    expect(codes(review({ payments: [a, { ...b, reference: null }] }))).toContain(CODES.DOUBLE_COUNT);
  });
  it('does not read a quoted price in a note as the amount transferred', () => {
    const p = pay({ id: 'k', amount: 160880, verification_note: 'Paid on the card; quote before discount about 1,68,527' });
    expect(codes(review({ payments: [p] }))).not.toContain(CODES.PAYMENT_NOTE_MISMATCH);
  });
  it('flags unverified payments and missing references, but not cash', () => {
    const f = review({ payments: [pay({ id: 'a', amount: 10, verification: 'chat_only', reference: null }), pay({ id: 'b', amount: 10, method: 'cash', reference: null })] });
    expect(about(f, 'a').map((x) => x.code).sort()).toEqual([CODES.PAYMENT_NO_REFERENCE, CODES.PAYMENT_UNVERIFIED]);
    expect(about(f, 'b')).toEqual([]);
  });
  it("flags a payment where Paridhi's part exceeds the payment", () => {
    expect(codes(review({ payments: [pay({ id: 'a', amount: 100, paridhi_amount: 200 })] }))).toContain(CODES.PAYMENT_PARIDHI_EXCEEDS);
  });
});

describe('room plan', () => {
  const sites = [{ id: 'sai', name: 'Hotel Sai, Bawal' }];
  const stayNights = [{ site_id: 'sai', night: '2027-02-14', rooms: 3 }, { site_id: 'sai', night: '2027-02-15', rooms: 18 }];
  it('flags a line tied to the plan whose quantity has drifted', () => {
    const r = row({ id: 'a', amount: 100, quantity: 40, rate: 2, unit: 'room-nights', basis: 'room_nights', basis_site_id: 'sai', basis_extra: 24 });
    const f = review({ schedule: [r], stayNights, staySites: sites });
    expect(f.find((x) => x.code === CODES.STAY_QUANTITY_MISMATCH)).toMatchObject({ severity: 'error', details: { quantity: 40, planned: 45 } });
    expect(codes(review({ schedule: [{ ...r, quantity: 45, amount: 90 }], stayNights, staySites: sites }))).not.toContain(CODES.STAY_QUANTITY_MISMATCH);
  });
  it('only mentions an untied hotel line, and does not mistake a different vendor for the stay', () => {
    const r = row({ id: 'a', amount: 100, quantity: 45, rate: 2, unit: 'room-nights', vendor_id: 'v-sai' });
    const f = review({ schedule: [r], stayNights, staySites: sites }).find((x) => x.code === CODES.STAY_QUANTITY_MISMATCH)!;
    expect(f.severity).toBe('info');
    expect(codes(review({ schedule: [{ ...r, vendor_id: 'v-mal' }], stayNights, staySites: sites }))).not.toContain(CODES.STAY_QUANTITY_MISMATCH);
  });
});

describe('headers and totals', () => {
  const schedule = [
    row({ id: 'w', amount: 1000000, paridhi_amount: 200000 }),
    row({ id: 'g', amount: 1500000, paridhi_amount: 0, topic_id: 't-gold' }),
    row({ id: 'cancelled', amount: 999999, status: 'cancelled' }),
    row({ id: 'outside', amount: 999999, in_budget: false }),
  ];
  const payments = [pay({ id: 'p', amount: 100000, paridhi_amount: 40000 })];
  const settings = { total_budget: 860000, gold_budget: 1460000 };
  it("adds Pranjal's share of paid and pending per header, leaving out cancelled and outside lines", () => {
    const t = headerTotals({ schedule, payments, topics: TOPICS });
    expect(t.wedding).toEqual({ paid: 60000, pending: 800000 });
    expect(t.gold).toEqual({ paid: 0, pending: 1500000 });
  });
  it('flags a header over budget, and only that one', () => {
    const f = review({ schedule, payments, settings }).filter((x) => x.code === CODES.HEADER_OVER_BUDGET);
    expect(f.map((x) => x.details.header)).toEqual(['gold']);
    expect(f[0].details.over_by).toBe(40000);
    expect(review({ schedule, payments, settings: { total_budget: 860000, gold_budget: 1500000 } }).some((x) => x.code === CODES.HEADER_OVER_BUDGET)).toBe(false);
  });
  it('flags the buffer when it has a budget and is over it', () => {
    const f = review({ schedule: [row({ id: 'b', amount: 70000, topic_id: 't-buf' })], settings: { total_budget: null, buffer_budget: 60000 } });
    expect(f.find((x) => x.code === CODES.HEADER_OVER_BUDGET)?.details.header).toBe('buffer');
  });
  it('flags lines with no area', () => {
    expect(codes(review({ schedule: [row({ id: 'a', amount: 100, topic_id: null })] }))).toContain(CODES.UNASSIGNED_AREA);
  });
  it('flags page totals that do not tie to the database', () => {
    const ok = review({ schedule, payments, displayed: { pendingPranjal: 2300000, paidPranjal: 60000, pendingTogether: 2500000, paidTogether: 100000 } });
    expect(ok.some((x) => x.code === CODES.TOTALS_DO_NOT_TIE)).toBe(false);
    const bad = review({ schedule, payments, displayed: { pendingPranjal: 2300000 - 6525, paidTogether: 100000 } });
    const f = bad.filter((x) => x.code === CODES.TOTALS_DO_NOT_TIE);
    expect(f).toHaveLength(1);
    expect(f[0].details).toMatchObject({ total: 'pendingPranjal', shown: 2293475, database: 2300000 });
  });
});

describe('helpers', () => {
  it('reads rupee figures in Indian and western grouping', () => {
    expect(figuresIn('₹1,37,025 less Rs 10,000, 45 rooms, 2500.50')).toEqual([137025, 10000, 45, 2500.5]);
    expect(figuresIn(null)).toEqual([]);
  });
  it('gives the same finding the same fingerprint, and a changed figure a new one', () => {
    const a = review({ schedule: [row({ id: 'a', amount: 1000, paridhi_amount: 1500 })] })[0];
    const b = review({ schedule: [row({ id: 'a', amount: 1000, paridhi_amount: 1500 })] })[0];
    const c = review({ schedule: [row({ id: 'a', amount: 1000, paridhi_amount: 1600 })] })[0];
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).not.toBe(fingerprint(c));
  });
  it('lists errors before warnings before info', () => {
    const f = review({ schedule: [row({ id: 'a', amount: 50000, is_estimate: false, paridhi_amount: 60000, due_date: '2026-01-01' })] });
    const order = f.map((x) => x.severity);
    expect(order).toEqual([...order].sort((x, y) => ['error', 'warning', 'info'].indexOf(x) - ['error', 'warning', 'info'].indexOf(y)));
  });
});
