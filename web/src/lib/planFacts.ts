// Shared plan values that every page reads. They live in the database as named planner items
// (planning_items.slug), so both of you, every page and Claude see the same thing. The defaults below are
// only a fallback so a page never goes blank if a row is missing or still loading.

export type DateRange = { start: Date; end: Date };

export type PlanFacts = {
  dates: Record<'wedding' | 'haldi' | 'mehndi' | 'reception' | 'honeymoon', DateRange>;
  budgetCap: number;
  routeId: string;
};

const day = (iso: string) => new Date(`${iso}T00:00:00+05:30`);

export const DEFAULT_FACTS: PlanFacts = {
  dates: {
    wedding: { start: day('2027-02-14'), end: day('2027-02-15') },
    haldi: { start: day('2027-02-12'), end: day('2027-02-13') },
    mehndi: { start: day('2027-02-14'), end: day('2027-02-14') },
    reception: { start: day('2027-02-26'), end: day('2027-02-26') },
    honeymoon: { start: day('2027-02-20'), end: day('2027-02-25') },
  },
  budgetCap: 400000,
  routeId: 'bkk-night',
};

type FactRow = { slug: string | null; amount: number | string | null; metadata: Record<string, unknown> | null };

function parseRange(meta: Record<string, unknown> | null | undefined, fallback: DateRange): DateRange {
  const s = typeof meta?.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.start) ? day(meta.start) : null;
  const e = typeof meta?.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.end) ? day(meta.end) : null;
  if (!s) return fallback;
  return { start: s, end: e && e >= s ? e : s };
}

export function factsFromRows(rows: FactRow[]): PlanFacts {
  const by = new Map(rows.filter((r) => r.slug).map((r) => [r.slug as string, r]));
  const dates = { ...DEFAULT_FACTS.dates };
  for (const k of Object.keys(dates) as (keyof PlanFacts['dates'])[]) {
    dates[k] = parseRange(by.get(`dates.${k}`)?.metadata, DEFAULT_FACTS.dates[k]);
  }
  const cap = Number(by.get('honeymoon.budget')?.amount);
  const route = by.get('honeymoon.route')?.metadata?.value;
  return {
    dates,
    budgetCap: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_FACTS.budgetCap,
    routeId: typeof route === 'string' && route ? route : DEFAULT_FACTS.routeId,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// All date maths is done in IST calendar days so it does not shift with the viewer's timezone.
const parts = (d: Date) => {
  const [y, m, dd] = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).split('-').map(Number);
  return { y, m: m - 1, d: dd };
};

export function formatRange(r: DateRange, opts: { full?: boolean; upper?: boolean } = {}) {
  const a = parts(r.start);
  const b = parts(r.end);
  const name = (m: number) => (opts.full ? FULL_MONTHS[m] : MONTHS[m]);
  let out: string;
  if (a.y === b.y && a.m === b.m && a.d === b.d) out = `${a.d} ${name(a.m)} ${a.y}`;
  else if (a.y === b.y && a.m === b.m) out = `${a.d}–${b.d} ${name(a.m)} ${a.y}`;
  else if (a.y === b.y) out = `${a.d} ${name(a.m)}–${b.d} ${name(b.m)} ${a.y}`;
  else out = `${a.d} ${name(a.m)} ${a.y}–${b.d} ${name(b.m)} ${b.y}`;
  return opts.upper ? out.toUpperCase() : out;
}

export function nightsBetween(r: DateRange) {
  return Math.max(0, Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000));
}

export function daysUntil(d: Date, now: number = Date.now()) {
  return Math.max(0, Math.ceil((d.getTime() - now) / 86_400_000));
}
