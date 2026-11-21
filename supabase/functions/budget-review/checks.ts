// The deterministic budget review. Pure functions, no imports, no network: the nightly run (edge function), the
// Budget page's "Review now" button and the unit tests all run exactly this code. Every check has a stable code,
// a severity and a plain-language message. A check only ever reports; nothing here writes to the database.
//
// Money rules this file relies on (they mirror web/src/lib/budgetPlan.ts):
//  * amount is the whole payment to the vendor; paridhi_amount is her part of it; Pranjal pays the rest.
//  * quantity x rate + adjustment = amount (rounded to the rupee); the adjustment holds fixed extras and
//    advances already paid, so it can be negative.
//  * A line with in_budget = false is tracked but paid by someone else and is left out of every total.

export type Severity = 'error' | 'warning' | 'info';

export type ScheduleRow = {
  id: string;
  payee: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  topic_id: string | null;
  note: string | null;
  is_estimate: boolean;
  status: 'pending' | 'paid' | 'cancelled';
  paid_payment_id: string | null;
  paridhi_amount: number;
  paridhi_plan?: { on: string; amount: number }[] | null;
  vendor_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  adjustment?: number | null;
  in_budget?: boolean;
  basis?: 'room_nights' | 'meal_people' | null;
  basis_site_id?: string | null;
  basis_night?: string | null;
  basis_multiplier?: number | null;
  basis_extra?: number | null;
};

export type PaymentRow = {
  id: string;
  paid_on: string;
  payee: string;
  amount: number;
  topic_id: string | null;
  paridhi_amount: number;
  vendor_id?: string | null;
  item_id?: string | null;
  method?: string | null;
  reference?: string | null;
  purpose?: string | null;
  verification?: 'receipt_checked' | 'chat_only' | null;
  verification_note?: string | null;
};

export type PaidItem = { id: string; title: string; amount: number | null; amount_kind: string | null; topic_id: string | null };
export type SettingsRow = {
  total_budget: number | null; // the wedding header
  gold_budget?: number | null;
  post_wedding_budget?: number | null;
  buffer_budget?: number | null; // not stored today; accepted so the buffer can be checked once it has a figure
};
export type TopicRow = { id: string; key: string; label: string; budget_group?: 'wedding' | 'post_wedding' | 'gold' | 'buffer' | null };
export type VendorRow = { id: string; name: string; kind: string };
export type StaySiteRow = { id: string; name: string };
export type StayNightRow = { site_id: string; night: string; rooms: number };

// Totals as the Budget page shows them, so the review can say when the page and the database disagree.
export type DisplayedTotals = { pendingPranjal?: number; paidPranjal?: number; pendingTogether?: number; paidTogether?: number };

export type ReviewInput = {
  today: string;
  schedule: ScheduleRow[];
  payments: PaymentRow[];
  paidItems?: PaidItem[];
  settings: SettingsRow | null;
  topics: TopicRow[];
  vendors: VendorRow[];
  stayNights?: StayNightRow[];
  staySites?: StaySiteRow[];
  possessionDate?: string | null; // when the new home is handed over; falls back to what the notes say
  displayed?: DisplayedTotals;
  // Off by default: nudges about payments recorded from chat only or without a transaction reference. Switch on
  // when you want the ledger tightened up.
  checkReceipts?: boolean;
};

export type FlagTable = 'payment_schedule' | 'payments' | 'planning_items' | 'budget_settings' | 'budget';

export type Flag = {
  code: string;
  severity: Severity;
  table: FlagTable;
  rowId: string | null; // null for flags about the budget as a whole
  label: string; // payee or header the flag is about
  message: string;
  details: Record<string, string | number | boolean | null>;
};

export const CODES = {
  LINE_ARITHMETIC: 'LINE_ARITHMETIC',
  PARIDHI_EXCEEDS_AMOUNT: 'PARIDHI_EXCEEDS_AMOUNT',
  PARIDHI_PLAN_EXCEEDS: 'PARIDHI_PLAN_EXCEEDS',
  PARIDHI_ROUNDED: 'PARIDHI_ROUNDED',
  SPLIT_NOTE_MISMATCH: 'SPLIT_NOTE_MISMATCH',
  NOTE_AMOUNT_MISMATCH: 'NOTE_AMOUNT_MISMATCH',
  PAID_NOT_IN_LEDGER: 'PAID_NOT_IN_LEDGER',
  PAID_ITEM_NOT_IN_LEDGER: 'PAID_ITEM_NOT_IN_LEDGER',
  PAID_STILL_PENDING: 'PAID_STILL_PENDING',
  LEDGER_LINK_BROKEN: 'LEDGER_LINK_BROKEN',
  DOUBLE_COUNT: 'DOUBLE_COUNT',
  PAYMENT_NOTE_MISMATCH: 'PAYMENT_NOTE_MISMATCH',
  PAYMENT_PARIDHI_EXCEEDS: 'PAYMENT_PARIDHI_EXCEEDS',
  PAYMENT_UNVERIFIED: 'PAYMENT_UNVERIFIED',
  PAYMENT_NO_REFERENCE: 'PAYMENT_NO_REFERENCE',
  STAY_QUANTITY_MISMATCH: 'STAY_QUANTITY_MISMATCH',
  DUE_PAST: 'DUE_PAST',
  DUE_BEFORE_HANDOVER: 'DUE_BEFORE_HANDOVER',
  HEADER_OVER_BUDGET: 'HEADER_OVER_BUDGET',
  ESTIMATE_NOT_MARKED: 'ESTIMATE_NOT_MARKED',
  GST_NOT_STATED: 'GST_NOT_STATED',
  UNASSIGNED_AREA: 'UNASSIGNED_AREA',
  TOTALS_DO_NOT_TIE: 'TOTALS_DO_NOT_TIE',
} as const;

// ---------------------------------------------------------------------------------------------------------------
// small helpers

const round2 = (n: number) => Math.round(n * 100) / 100;
export const inr = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(round2(n));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const num = (v: unknown) => Number(v) || 0;
const same = (a: number, b: number, tol = 1) => Math.abs(a - b) < tol;

const shareOf = (amount: number, paridhi: number, who: 'pranjal' | 'paridhi') =>
  who === 'paridhi' ? Math.min(Math.max(paridhi, 0), amount) : amount - Math.min(Math.max(paridhi, 0), amount);

// Rupee figures in free text: "₹1,37,025", "Rs 57,000", "10,000", "2500". Indian and western grouping both work.
const FIGURE = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
export function figuresIn(text: string | null | undefined): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const m of text.matchAll(FIGURE)) out.push(Number(m[1].replace(/,/g, '')));
  return out.filter((n) => Number.isFinite(n));
}
const parseAmount = (s: string) => Number(s.replace(/,/g, ''));

const flag = (f: Flag): Flag => f;

// ---------------------------------------------------------------------------------------------------------------
// checks on one schedule line

function arithmetic(r: ScheduleRow): Flag[] {
  if (r.status === 'cancelled' || r.quantity == null || r.rate == null) return [];
  const expected = Math.max(0, Math.round(r.quantity * r.rate + (r.adjustment ?? 0)));
  if (same(expected, r.amount)) return [];
  return [
    flag({
      code: CODES.LINE_ARITHMETIC,
      severity: 'error',
      table: 'payment_schedule',
      rowId: r.id,
      label: r.payee,
      message: `${r.payee}: ${r.quantity} × ${inr(r.rate)}${r.adjustment ? ` ${r.adjustment < 0 ? '−' : '+'} ${inr(Math.abs(r.adjustment))}` : ''} comes to ${inr(expected)}, but the line says ${inr(r.amount)} (a difference of ${inr(r.amount - expected)}).`,
      details: { amount: r.amount, expected, quantity: r.quantity, rate: r.rate, adjustment: r.adjustment ?? 0 },
    }),
  ];
}

function paridhiShare(r: ScheduleRow): Flag[] {
  if (r.status === 'cancelled') return [];
  const out: Flag[] = [];
  const base = { table: 'payment_schedule' as const, rowId: r.id, label: r.payee };
  if (r.paridhi_amount > r.amount + 0.005 || r.paridhi_amount < -0.005) {
    out.push(
      flag({
        ...base,
        code: CODES.PARIDHI_EXCEEDS_AMOUNT,
        severity: 'error',
        message: `${r.payee}: Paridhi's share (${inr(r.paridhi_amount)}) ${r.paridhi_amount < 0 ? 'is negative' : `is more than the whole payment (${inr(r.amount)})`}, so Pranjal's share cannot be worked out.`,
        details: { amount: r.amount, paridhi_amount: r.paridhi_amount },
      })
    );
  }
  const plan = sum((r.paridhi_plan ?? []).map((i) => num(i.amount)));
  if (plan > r.paridhi_amount + 0.01) {
    out.push(
      flag({
        ...base,
        code: CODES.PARIDHI_PLAN_EXCEEDS,
        severity: 'error',
        message: `${r.payee}: Paridhi's instalments add up to ${inr(plan)}, more than her share of ${inr(r.paridhi_amount)}.`,
        details: { plan, paridhi_amount: r.paridhi_amount },
      })
    );
  }
  // A line that is worked out as quantity x rate should have a worked-out share too. A share of exactly 70,000 or
  // 1,05,000 on such a line is usually a rounded figure typed in, not a calculation (Hotel Sai, 20 Nov 2026:
  // 70,000 against a true 69,600).
  if (r.quantity != null && r.rate != null && r.paridhi_amount >= 10000 && r.paridhi_amount % 1000 === 0 && r.paridhi_amount < r.amount) {
    out.push(
      flag({
        ...base,
        code: CODES.PARIDHI_ROUNDED,
        severity: 'warning',
        message: `${r.payee}: Paridhi's share is a round ${inr(r.paridhi_amount)} on a line that is worked out from quantity and rate. Is it rounded rather than calculated?`,
        details: { amount: r.amount, paridhi_amount: r.paridhi_amount },
      })
    );
  }
  // "Split 1:2" in the note means Paridhi one part, Pranjal two. When the amount changes, her share must follow.
  const split = r.note?.match(/\bsplit\s+(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/i);
  if (split) {
    const a = Number(split[1]);
    const b = Number(split[2]);
    if (a + b > 0) {
      const expected = round2((r.amount * a) / (a + b));
      if (!same(expected, r.paridhi_amount, 1)) {
        out.push(
          flag({
            ...base,
            code: CODES.SPLIT_NOTE_MISMATCH,
            severity: 'error',
            message: `${r.payee}: the note says the split is ${a}:${b} (Paridhi's part first), which makes her share ${inr(expected)} and Pranjal's ${inr(r.amount - expected)}, but her share is ${inr(r.paridhi_amount)}. Was the amount changed without her share?`,
            details: { amount: r.amount, paridhi_amount: r.paridhi_amount, expected_paridhi: expected },
          })
        );
      }
    }
  }
  return out;
}

// A note that states a total or a balance must agree with the row. A "total" may legitimately differ from the amount
// by a figure the note also mentions (a token or advance already paid), so that is allowed.
function noteMatchesAmount(r: ScheduleRow): Flag[] {
  if (r.status === 'cancelled' || !r.note) return [];
  const out: Flag[] = [];
  const all = figuresIn(r.note);
  const base = { table: 'payment_schedule' as const, rowId: r.id, label: r.payee };
  for (const m of r.note.matchAll(/\btotal\s*(?:of\s*)?(?:₹|rs\.?)\s*(\d[\d,]*(?:\.\d+)?)/gi)) {
    const total = parseAmount(m[1]);
    const gap = total - r.amount;
    if (same(total, r.amount) || all.some((f) => same(f, gap) && f !== total)) continue;
    out.push(
      flag({
        ...base,
        code: CODES.NOTE_AMOUNT_MISMATCH,
        severity: 'warning',
        message: `${r.payee}: the note says the total is ${inr(total)}, but the line is ${inr(r.amount)} and nothing in the note explains the ${inr(Math.abs(gap))} difference.`,
        details: { amount: r.amount, note_total: total },
      })
    );
    break;
  }
  const left = r.note.match(/(?:₹|rs\.?)\s*(\d[\d,]*(?:\.\d+)?)\s+still to pay/i);
  if (left && r.status === 'pending' && !same(parseAmount(left[1]), r.amount)) {
    out.push(
      flag({
        ...base,
        code: CODES.NOTE_AMOUNT_MISMATCH,
        severity: 'warning',
        message: `${r.payee}: the note says ${inr(parseAmount(left[1]))} is still to pay, but the line is ${inr(r.amount)}.`,
        details: { amount: r.amount, note_still_to_pay: parseAmount(left[1]) },
      })
    );
  }
  return out;
}

function dueDates(r: ScheduleRow, today: string, possession: string | null): Flag[] {
  if (r.status !== 'pending') return [];
  const out: Flag[] = [];
  const base = { table: 'payment_schedule' as const, rowId: r.id, label: r.payee };
  if (r.due_date < today) {
    out.push(
      flag({
        ...base,
        code: CODES.DUE_PAST,
        severity: 'warning',
        message: `${r.payee}: ${inr(r.amount)} was due on ${r.due_date} and is still pending. Was it paid, or has the date moved?`,
        details: { due_date: r.due_date, amount: r.amount },
      })
    );
  }
  if (possession && /^new home/i.test(r.payee) && r.due_date < possession) {
    out.push(
      flag({
        ...base,
        code: CODES.DUE_BEFORE_HANDOVER,
        severity: 'warning',
        message: `${r.payee}: due on ${r.due_date}, before the home is handed over on ${possession}.`,
        details: { due_date: r.due_date, possession },
      })
    );
  }
  return out;
}

// Rough figures should be marked as estimates, so the budget shows they can still move.
function estimates(r: ScheduleRow): Flag[] {
  if (r.status !== 'pending' || r.is_estimate || r.amount <= 0) return [];
  const base = { table: 'payment_schedule' as const, rowId: r.id, label: r.payee };
  if (r.note && /\b(placeholder|rough|roughly|no quote|not quoted|approx|about|estimate)/i.test(r.note)) {
    return [flag({ ...base, code: CODES.ESTIMATE_NOT_MARKED, severity: 'warning', message: `${r.payee}: the note calls ${inr(r.amount)} a rough figure, but the line is not marked as an estimate.`, details: { amount: r.amount } })];
  }
  if (r.amount >= 10000 && r.amount % 5000 === 0 && r.quantity == null) {
    return [flag({ ...base, code: CODES.ESTIMATE_NOT_MARKED, severity: 'info', message: `${r.payee}: ${inr(r.amount)} is a round number and not marked as an estimate. Is it a firm quote?`, details: { amount: r.amount } })];
  }
  return [];
}

function gst(r: ScheduleRow, vendors: Map<string, VendorRow>): Flag[] {
  if (r.status !== 'pending' || !r.vendor_id || r.amount <= 0) return [];
  const v = vendors.get(r.vendor_id);
  if (!v || v.kind === 'other') return [];
  if (/\b(gst|tax|taxes)\b/i.test(`${r.note ?? ''} ${r.unit ?? ''}`)) return [];
  return [
    flag({
      code: CODES.GST_NOT_STATED,
      severity: 'info',
      table: 'payment_schedule',
      rowId: r.id,
      label: r.payee,
      message: `${r.payee} (${v.name}): ${inr(r.amount)} does not say whether GST is included or extra.`,
      details: { amount: r.amount, vendor: v.name },
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// stay lines against the rooms planned

function stayQuantity(r: ScheduleRow, nights: StayNightRow[], sites: StaySiteRow[], vendors: Map<string, VendorRow>): Flag[] {
  if (r.status !== 'pending' || r.quantity == null) return [];
  const base = { table: 'payment_schedule' as const, rowId: r.id, label: r.payee };
  // Lines tied to the room plan: the same rule the page's "no longer match the plan" banner uses.
  if (r.basis === 'room_nights' && r.basis_site_id) {
    const mine = nights.filter((n) => n.site_id === r.basis_site_id);
    if (mine.length === 0) return [];
    const planned = sum(mine.map((n) => n.rooms)) * (r.basis_multiplier ?? 1) + (r.basis_extra ?? 0);
    if (same(planned, r.quantity, 0.5)) return [];
    return [flag({ ...base, code: CODES.STAY_QUANTITY_MISMATCH, severity: 'error', message: `${r.payee}: the line has ${r.quantity} room-nights but the room plan gives ${planned}.`, details: { quantity: r.quantity, planned } })];
  }
  // Untied hotel lines counted in room-nights: compare with the nights of the stay whose name matches the vendor.
  if (r.basis || !/room/i.test(r.unit ?? '') || !r.vendor_id) return [];
  const v = vendors.get(r.vendor_id);
  const first = v?.name.toLowerCase().split(/[\s,]+/).slice(0, 2).join(' ');
  const site = first ? sites.find((s) => s.name.toLowerCase().startsWith(first)) : undefined;
  if (!site) return [];
  const planned = sum(nights.filter((n) => n.site_id === site.id).map((n) => n.rooms));
  if (planned === 0 || same(planned, r.quantity, 0.5)) return [];
  return [
    flag({
      ...base,
      code: CODES.STAY_QUANTITY_MISMATCH,
      severity: 'info',
      message: `${r.payee}: ${r.quantity} room-nights, while the room plan has ${planned} for ${site.name}. This may be fine if the line also covers rooms booked outside the plan.`,
      details: { quantity: r.quantity, planned },
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// the ledger against the schedule

const keyWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2)[0] ?? '';

function ledger(input: ReviewInput): Flag[] {
  const out: Flag[] = [];
  const pays = new Map(input.payments.map((p) => [p.id, p]));
  const linked = new Map<string, ScheduleRow[]>();
  for (const r of input.schedule) if (r.paid_payment_id) linked.set(r.paid_payment_id, [...(linked.get(r.paid_payment_id) ?? []), r]);

  for (const r of input.schedule) {
    const base = { table: 'payment_schedule' as const, rowId: r.id, label: r.payee };
    if (r.paid_payment_id && !pays.has(r.paid_payment_id)) {
      out.push(flag({ ...base, code: CODES.LEDGER_LINK_BROKEN, severity: 'error', message: `${r.payee} is marked paid against a payment that is not in the ledger.`, details: { paid_payment_id: r.paid_payment_id } }));
    }
    // Paid on the schedule, nothing in the ledger: the money is in neither the paid total nor the pending total.
    if (r.status === 'paid' && !r.paid_payment_id && r.in_budget !== false && r.amount > 0) {
      const match = input.payments.some((p) => !linked.has(p.id) && same(p.amount, r.amount) && (p.vendor_id && r.vendor_id ? p.vendor_id === r.vendor_id : keyWord(p.payee) === keyWord(r.payee)));
      if (!match) {
        out.push(flag({ ...base, code: CODES.PAID_NOT_IN_LEDGER, severity: 'error', message: `${r.payee}: ${inr(r.amount)} is marked paid, but there is no matching payment in the ledger, so it is missing from the paid total.`, details: { amount: r.amount } }));
      }
    }
    // Paid in the ledger, still pending on the schedule: it would be counted twice.
    if (r.status === 'pending' && r.amount > 0) {
      const hit = input.payments.find((p) => !linked.has(p.id) && same(p.amount, r.amount) && (p.vendor_id && r.vendor_id ? p.vendor_id === r.vendor_id : p.payee.toLowerCase() === r.payee.toLowerCase()));
      if (hit) {
        out.push(flag({ ...base, code: CODES.PAID_STILL_PENDING, severity: 'error', message: `${r.payee}: the ledger has ${inr(hit.amount)} paid to ${hit.payee} on ${hit.paid_on}, but this line is still pending. Is it counted twice?`, details: { amount: r.amount, payment_id: hit.id } }));
      }
    }
  }

  // The planner's items marked "paid" must each have a ledger entry (linked, or the same amount to the same area).
  const used = new Set<string>();
  const paidOnes = (input.paidItems ?? []).filter((it) => it.amount_kind === 'paid' && it.amount && it.amount > 0);
  for (const it of paidOnes) {
    const exact = input.payments.find((p) => p.item_id === it.id);
    if (exact) used.add(exact.id);
  }
  for (const it of paidOnes) {
    if (input.payments.some((p) => p.item_id === it.id)) continue;
    const hit = input.payments.find((p) => !used.has(p.id) && !p.item_id && same(p.amount, it.amount as number));
    if (hit) used.add(hit.id);
    else out.push(flag({ table: 'planning_items', rowId: it.id, label: it.title, code: CODES.PAID_ITEM_NOT_IN_LEDGER, severity: 'error', message: `${it.title}: ${inr(it.amount as number)} is recorded as paid in the planner, but the payments ledger has no such entry.`, details: { amount: it.amount as number } }));
  }

  for (const [pid, lines] of linked) {
    if (lines.length > 1 && pays.has(pid)) {
      out.push(flag({ table: 'payments', rowId: pid, label: pays.get(pid)!.payee, code: CODES.DOUBLE_COUNT, severity: 'error', message: `One payment (${pays.get(pid)!.payee}, ${inr(pays.get(pid)!.amount)}) is used to close ${lines.length} schedule lines: ${lines.map((l) => l.payee).join('; ')}.`, details: { lines: lines.length } }));
    }
  }
  const seen = new Map<string, PaymentRow>();
  for (const p of input.payments) {
    const k = `${p.payee.toLowerCase()}|${p.paid_on}|${p.amount}`;
    const first = seen.get(k);
    // Two receipts with different references are two payments (two advances of 37,000 on one day), not a duplicate.
    const apart = first && first.reference?.trim() && p.reference?.trim() && first.reference.trim() !== p.reference.trim();
    if (first && apart) seen.set(k + '|' + p.id, p);
    else if (first) out.push(flag({ table: 'payments', rowId: p.id, label: p.payee, code: CODES.DOUBLE_COUNT, severity: 'error', message: `${p.payee}: two ledger entries of ${inr(p.amount)} on ${p.paid_on}. Is one a duplicate?`, details: { other_id: first.id } }));
    else seen.set(k, p);
  }
  return out;
}

function payment(p: PaymentRow, checkReceipts: boolean): Flag[] {
  const out: Flag[] = [];
  const base = { table: 'payments' as const, rowId: p.id, label: p.payee };
  if (p.paridhi_amount > p.amount + 0.005) {
    out.push(flag({ ...base, code: CODES.PAYMENT_PARIDHI_EXCEEDS, severity: 'error', message: `${p.payee} (${p.paid_on}): Paridhi's part (${inr(p.paridhi_amount)}) is more than the payment (${inr(p.amount)}).`, details: { amount: p.amount, paridhi_amount: p.paridhi_amount } }));
  }
  // A transfer figure typed into the note that is close to, but not, the amount: a typo in one of the two
  // (Paridhi's 29 Oct NEFT, 20 Nov 2026: 87,000 sent, 82,000 recorded).
  const text = `${p.purpose ?? ''} ${p.verification_note ?? ''}`;
  // A note that talks about a quote, an estimate or a pre-discount price is not stating what was transferred.
  const figs = /\b(quote|quoted|before discount|estimate|about|approx)/i.test(text) ? [] : figuresIn(text).filter((f) => f >= 1000);
  if (figs.length > 0 && !figs.some((f) => same(f, p.amount, 0.5))) {
    const near = figs.find((f) => Math.abs(f - p.amount) <= p.amount * 0.25);
    if (near !== undefined) {
      out.push(flag({ ...base, code: CODES.PAYMENT_NOTE_MISMATCH, severity: 'error', message: `${p.payee} (${p.paid_on}): recorded as ${inr(p.amount)}, but its note mentions ${inr(near)}. One of them is probably a typo.`, details: { amount: p.amount, note_figure: near } }));
    }
  }
  if (checkReceipts && p.verification !== 'receipt_checked') {
    out.push(flag({ ...base, code: CODES.PAYMENT_UNVERIFIED, severity: 'info', message: `${p.payee} (${p.paid_on}, ${inr(p.amount)}) is recorded from chat only; the receipt has not been checked.`, details: { amount: p.amount } }));
  }
  if (checkReceipts && !p.reference?.trim() && !/cash/i.test(p.method ?? '')) {
    out.push(flag({ ...base, code: CODES.PAYMENT_NO_REFERENCE, severity: 'info', message: `${p.payee} (${p.paid_on}, ${inr(p.amount)}) has no transaction reference.`, details: { amount: p.amount } }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// headers and totals

const GROUPS = ['gold', 'wedding', 'post_wedding', 'buffer'] as const;
const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = { gold: 'Gold', wedding: 'Wedding', post_wedding: 'Post-wedding', buffer: 'Contingency buffer' };

// What the page would show for each header: Pranjal's share of what is paid plus what is still to pay.
export function headerTotals(input: Pick<ReviewInput, 'schedule' | 'payments' | 'topics'>) {
  const groupOf = (topicId: string | null) => (input.topics.find((t) => t.id === topicId)?.budget_group ?? 'wedding') as (typeof GROUPS)[number];
  const out = Object.fromEntries(GROUPS.map((g) => [g, { paid: 0, pending: 0 }])) as Record<(typeof GROUPS)[number], { paid: number; pending: number }>;
  for (const p of input.payments) out[groupOf(p.topic_id)].paid += p.amount - Math.min(Math.max(p.paridhi_amount, 0), p.amount);
  for (const r of input.schedule) if (r.status === 'pending' && r.in_budget !== false) out[groupOf(r.topic_id)].pending += shareOf(r.amount, r.paridhi_amount, 'pranjal');
  return out;
}

function headers(input: ReviewInput): Flag[] {
  const s = input.settings;
  if (!s) return [];
  const totals = headerTotals(input);
  const budgets: Record<(typeof GROUPS)[number], number | null> = { gold: s.gold_budget ?? null, wedding: s.total_budget, post_wedding: s.post_wedding_budget ?? null, buffer: s.buffer_budget ?? null };
  const out: Flag[] = [];
  for (const g of GROUPS) {
    const b = budgets[g];
    if (b === null || b === undefined) continue;
    const used = totals[g].paid + totals[g].pending;
    if (used > b + 0.5) {
      out.push(flag({ table: 'budget_settings', rowId: null, label: GROUP_LABEL[g], code: CODES.HEADER_OVER_BUDGET, severity: 'error', message: `${GROUP_LABEL[g]} is over budget: ${inr(totals[g].paid)} paid plus ${inr(totals[g].pending)} still to pay is ${inr(used)}, against a budget of ${inr(b)} (over by ${inr(used - b)}).`, details: { header: g, used: round2(used), budget: b, over_by: round2(used - b) } }));
    }
  }
  return out;
}

function unassigned(input: ReviewInput): Flag[] {
  const known = new Set(input.topics.map((t) => t.id));
  const out: Flag[] = [];
  for (const r of input.schedule) {
    if (r.status !== 'cancelled' && r.in_budget !== false && (!r.topic_id || !known.has(r.topic_id))) {
      out.push(flag({ table: 'payment_schedule', rowId: r.id, label: r.payee, code: CODES.UNASSIGNED_AREA, severity: 'info', message: `${r.payee} (${inr(r.amount)}) has no area, so it lands under Wedding / Unassigned and counts against the wedding header.`, details: { amount: r.amount } }));
    }
  }
  return out;
}

// Recomputes the grand totals straight from the rows and compares them with what the page displays.
function ties(input: ReviewInput): Flag[] {
  const d = input.displayed;
  if (!d) return [];
  const lines = input.schedule.filter((r) => r.status === 'pending' && r.in_budget !== false);
  const expected = {
    pendingPranjal: sum(lines.map((r) => shareOf(r.amount, r.paridhi_amount, 'pranjal'))),
    paidPranjal: sum(input.payments.map((p) => p.amount - Math.min(Math.max(p.paridhi_amount, 0), p.amount))),
    pendingTogether: sum(lines.map((r) => r.amount)),
    paidTogether: sum(input.payments.map((p) => p.amount)),
  };
  const names: Record<keyof DisplayedTotals, string> = { pendingPranjal: "Pranjal's still to pay", paidPranjal: "Pranjal's paid", pendingTogether: 'Still to pay together', paidTogether: 'Paid together' };
  const out: Flag[] = [];
  for (const k of Object.keys(names) as (keyof DisplayedTotals)[]) {
    const shown = d[k];
    if (shown === undefined) continue;
    if (!same(shown, expected[k], 1)) {
      out.push(flag({ table: 'budget', rowId: null, label: names[k], code: CODES.TOTALS_DO_NOT_TIE, severity: 'error', message: `${names[k]}: the Budget page shows ${inr(shown)} but the rows in the database add up to ${inr(expected[k])} (a difference of ${inr(shown - expected[k])}).`, details: { total: k, shown: round2(shown), database: round2(expected[k]) } }));
    }
  }
  return out;
}

// The handover date, when nobody has said it outright: read it from a note such as
// "Possession postponed from 20 to 22 Nov". The newest note wins by taking the latest date found.
export function handoverFromNotes(schedule: Pick<ScheduleRow, 'payee' | 'note'>[], today: string): string | null {
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let best: string | null = null;
  for (const r of schedule) {
    if (!/^new home/i.test(r.payee) || !r.note) continue;
    for (const m of r.note.matchAll(/possession[^.\n]*?\bto (\d{1,2}) ([a-z]{3})/gi)) {
      const mi = MONTHS.indexOf(m[2].toLowerCase());
      if (mi < 0) continue;
      let year = Number(today.slice(0, 4));
      if (mi + 1 < Number(today.slice(5, 7)) - 6) year += 1;
      const iso = `${year}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      if (!best || iso > best) best = iso;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function reviewBudget(input: ReviewInput): Flag[] {
  const vendors = new Map(input.vendors.map((v) => [v.id, v]));
  const possession = input.possessionDate ?? handoverFromNotes(input.schedule, input.today);
  const nights = input.stayNights ?? [];
  const sites = input.staySites ?? [];
  const flags: Flag[] = [];
  for (const r of input.schedule) {
    flags.push(...arithmetic(r), ...paridhiShare(r), ...noteMatchesAmount(r), ...dueDates(r, input.today, possession), ...estimates(r), ...gst(r, vendors), ...stayQuantity(r, nights, sites, vendors));
  }
  for (const p of input.payments) flags.push(...payment(p, input.checkReceipts === true));
  flags.push(...ledger(input), ...headers(input), ...unassigned(input), ...ties(input));
  return flags.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.label.localeCompare(b.label) || a.code.localeCompare(b.code));
}

// A stable identity for a finding. The same problem on the same row with the same figures keeps its fingerprint
// from night to night, so a flag you have confirmed or dismissed stays quiet; change a figure and it comes back.
export function fingerprint(f: Flag): string {
  const detail = Object.keys(f.details).sort().map((k) => `${k}=${f.details[k]}`).join('&');
  return `${f.code}|${f.table}|${f.rowId ?? f.label}|${detail}`;
}

export const SEVERITY_LABEL: Record<Severity, string> = { error: 'Needs a look', warning: 'Worth checking', info: 'For your information' };
