// Pure rules for sheet-snapshot: the token check and the shaping of the wedding-budget numbers.
// No Deno or Supabase imports here, so the web tests can run it directly.
//
// Scope: the WEDDING group only. Gold (jewellery), post-wedding (honeymoon, new home) and the contingency buffer are
// left out on purpose; the sheet is the parents' discussion document for the wedding itself. A payment whose area is
// unknown (no topic) counts as wedding, the same way the Budget page treats it.
//
// Money: every figure is Pranjal's share = amount - min(paridhi_amount, amount), rounded to paise.

export const WEDDING_GROUP = 'wedding';
export const SHRI_KANTH = 'Shri Kanth Hotel';
export const HOTEL_SAI = 'Hotel Sai, Bawal';

export type TopicRow = { id: string; budget_group: string | null };
export type PaymentRow = { amount: number | string; paridhi_amount: number | string; topic_id: string | null };
export type ScheduleRow = {
  payee: string;
  amount: number | string;
  paridhi_amount: number | string;
  due_date: string;
  topic_id: string | null;
  note: string | null;
  is_estimate: boolean;
  status: 'pending' | 'paid' | 'cancelled';
  paid_payment_id: string | null;
  vendor_id: string | null;
  quantity: number | string | null;
  unit: string | null;
  rate: number | string | null;
  adjustment: number | string | null;
  in_budget: boolean | null;
};
export type VendorRow = { id: string; name: string };
export type StayNightRow = { night: string; rooms: number; stay_sites: { name: string } | { name: string }[] | null };
export type SettingsRow = {
  total_budget: number | string | null;
  funds_available: number | string | null;
  funds_as_of: string | null;
  monthly_addition: number | string | null;
};

export type SnapshotInput = {
  topics: TopicRow[];
  payments: PaymentRow[];
  schedule: ScheduleRow[];
  vendors: VendorRow[];
  stayNights: StayNightRow[];
  settings: SettingsRow | null;
};

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;
const orNull = (v: unknown) => (v === null || v === undefined ? null : num(v));

// Pranjal's part of a payment.
export const pranjalShare = (amount: unknown, paridhi: unknown) => {
  const a = num(amount);
  return a - Math.min(num(paridhi), a);
};

// ---- Token check -------------------------------------------------------------------------------------------------

const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

// Constant-time comparison of the supplied token with the secret. Both are hashed first so the comparison always runs
// over 32 bytes whatever the lengths are. A missing or empty secret never matches (fail closed).
export async function tokenMatches(supplied: string | null | undefined, expected: string | null | undefined): Promise<boolean> {
  if (!expected || !supplied) return false;
  const [a, b] = await Promise.all([sha256(supplied), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---- Shaping -----------------------------------------------------------------------------------------------------

export type VendorLine = {
  item: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  adjustment: number;
  amount: number; // the whole amount owed to the vendor on this line
  paridhi_amount: number;
  pranjal_amount: number; // amount - min(paridhi_amount, amount)
  due_date: string;
  status: 'pending' | 'paid';
  is_estimate: boolean;
  note: string | null;
};

export type Snapshot = {
  generated_at: string;
  scope: 'wedding';
  share: 'pranjal';
  wedding: { total: number; paid: number; pending: number; paid_count: number; pending_count: number };
  vendors: { shri_kanth: VendorLine[]; hotel_sai: VendorLine[] };
  stay_nights: { shri_kanth: { night: string; rooms: number }[]; hotel_sai: { night: string; rooms: number }[] };
  budget_settings: { total_budget: number | null; funds_available: number | null; funds_as_of: string | null; monthly_addition: number };
};

export function shapeSnapshot(input: SnapshotInput, now: Date): Snapshot {
  const groupOf = new Map(input.topics.map((t) => [t.id, t.budget_group ?? WEDDING_GROUP]));
  const inWedding = (topicId: string | null) => (topicId ? groupOf.get(topicId) ?? WEDDING_GROUP : WEDDING_GROUP) === WEDDING_GROUP;

  // Paid: every ledger payment, once. A schedule line marked paid with no ledger entry (settled outside the ledger)
  // also counts as paid; one linked to a ledger entry is skipped because the ledger already has it.
  const ledger = input.payments.filter((p) => inWedding(p.topic_id));
  const settledOutside = input.schedule.filter(
    (s) => s.status === 'paid' && !s.paid_payment_id && s.in_budget !== false && inWedding(s.topic_id),
  );
  const paidParts = [
    ...ledger.map((p) => pranjalShare(p.amount, p.paridhi_amount)),
    ...settledOutside.map((s) => pranjalShare(s.amount, s.paridhi_amount)),
  ];
  const pending = input.schedule.filter((s) => s.status === 'pending' && s.in_budget !== false && inWedding(s.topic_id));
  const pendingParts = pending.map((s) => pranjalShare(s.amount, s.paridhi_amount));
  const paid = round2(paidParts.reduce((a, b) => a + b, 0));
  const pend = round2(pendingParts.reduce((a, b) => a + b, 0));

  const vendorId = (name: string) => input.vendors.find((v) => v.name === name)?.id ?? null;
  const linesFor = (name: string): VendorLine[] => {
    const id = vendorId(name);
    if (!id) return [];
    return input.schedule
      .filter((s) => s.vendor_id === id && s.status !== 'cancelled' && s.in_budget !== false && inWedding(s.topic_id))
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.payee.localeCompare(b.payee))
      .map((s) => ({
        item: s.payee,
        quantity: orNull(s.quantity),
        unit: s.unit,
        rate: orNull(s.rate),
        adjustment: num(s.adjustment),
        amount: round2(num(s.amount)),
        paridhi_amount: round2(num(s.paridhi_amount)),
        pranjal_amount: round2(pranjalShare(s.amount, s.paridhi_amount)),
        due_date: s.due_date,
        status: s.status as 'pending' | 'paid',
        is_estimate: s.is_estimate,
        note: s.note,
      }));
  };

  const nightsFor = (name: string) =>
    input.stayNights
      .filter((n) => {
        const site = Array.isArray(n.stay_sites) ? n.stay_sites[0] : n.stay_sites;
        return site?.name === name;
      })
      .map((n) => ({ night: n.night, rooms: num(n.rooms) }))
      .sort((a, b) => a.night.localeCompare(b.night));

  const st = input.settings;
  return {
    generated_at: now.toISOString(),
    scope: 'wedding',
    share: 'pranjal',
    wedding: {
      total: round2(paid + pend),
      paid,
      pending: pend,
      paid_count: paidParts.length,
      pending_count: pendingParts.length,
    },
    vendors: { shri_kanth: linesFor(SHRI_KANTH), hotel_sai: linesFor(HOTEL_SAI) },
    stay_nights: { shri_kanth: nightsFor(SHRI_KANTH), hotel_sai: nightsFor(HOTEL_SAI) },
    // Only the wedding's own budget figure and Pranjal's funds; the gold and post-wedding budgets are not shared.
    budget_settings: {
      total_budget: orNull(st?.total_budget),
      funds_available: orNull(st?.funds_available),
      funds_as_of: st?.funds_as_of ?? null,
      monthly_addition: num(st?.monthly_addition),
    },
  };
}
