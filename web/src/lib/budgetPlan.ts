import { summarizeMoney } from './topicMeta';

export type Scheduled = {
  id: string;
  payee: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  topic_id: string | null;
  note: string | null;
  is_estimate: boolean;
  status: 'pending' | 'paid' | 'cancelled';
  paid_payment_id: string | null;
};

export type BudgetSettings = {
  total_budget: number | null;
  funds_available: number | null;
  funds_as_of: string | null; // the date the funds figure was true
  monthly_addition: number;
};

export type AreaBudget = { id: string; topic_id: string; allocation: number };
export type PaidRow = { id: string; paid_on: string; amount: number; topic_id: string | null };
export type ItemMoney = { topic_id: string; status: string; amount: number | null; amount_kind: string | null; slug: string | null };
export type TopicRef = { id: string; key: string; label: string };

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) => new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + (Number(key.slice(5, 7)) - 1);
const monthsBetween = (from: string, to: string) => monthIndex(to) - monthIndex(from);
function addMonths(key: string, n: number) {
  const i = monthIndex(key) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((new Date(toIso + 'T00:00:00').getTime() - new Date(fromIso + 'T00:00:00').getTime()) / 86_400_000);

export type MonthRow = {
  key: string;
  label: string;
  isCurrent: boolean;
  items: Scheduled[];
  due: number; // pending payments due this month
  paid: number; // payments made this month (from the ledger)
  paidCount: number;
  cumulativeDue: number; // everything still to pay up to and including this month, overdue included
  balance: number | null; // funds on hand after paying everything up to this month; null when funds are not set
};

export type Plan = {
  overdue: Scheduled[];
  overdueTotal: number;
  months: MonthRow[];
  pendingTotal: number;
  pendingCount: number;
  estimateTotal: number;
  paidTotal: number;
  fundsNow: number | null; // the funds figure less anything paid since it was set
  leftAfterAll: number | null;
  firstShort: MonthRow | null;
  next: Scheduled | null;
};

// The month-by-month picture. Funds are a figure as of a date; payments made after that date are taken off it,
// and the optional monthly addition is added at the start of each month after the as-of month.
export function buildPlan(opts: { pending: Scheduled[]; paid: PaidRow[]; settings: BudgetSettings | null; today: string; throughMonth: string }): Plan {
  const { paid, settings, today, throughMonth } = opts;
  const pending = opts.pending.filter((p) => p.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date) || a.payee.localeCompare(b.payee));
  const curKey = monthKey(today);
  const overdue = pending.filter((p) => p.due_date < today);
  const upcoming = pending.filter((p) => p.due_date >= today);
  const overdueTotal = sum(overdue.map((p) => p.amount));

  const lastDue = upcoming.length ? monthKey(upcoming[upcoming.length - 1].due_date) : curKey;
  const endKey = [throughMonth, lastDue, curKey].sort().pop() as string;

  const fundsSet = settings?.funds_available ?? null;
  const asOf = settings?.funds_as_of ?? today;
  const fundsNow = fundsSet === null ? null : fundsSet - sum(paid.filter((p) => p.paid_on > asOf).map((p) => p.amount));

  const months: MonthRow[] = [];
  let cumulative = overdueTotal;
  for (let key = curKey; key <= endKey; key = addMonths(key, 1)) {
    const items = upcoming.filter((p) => monthKey(p.due_date) === key);
    const due = sum(items.map((p) => p.amount));
    cumulative += due;
    const madeThisMonth = paid.filter((p) => monthKey(p.paid_on) === key);
    const additions = fundsNow === null ? 0 : (settings?.monthly_addition ?? 0) * Math.max(0, monthsBetween(monthKey(asOf), key));
    months.push({
      key,
      label: monthLabel(key),
      isCurrent: key === curKey,
      items,
      due,
      paid: sum(madeThisMonth.map((p) => p.amount)),
      paidCount: madeThisMonth.length,
      cumulativeDue: cumulative,
      balance: fundsNow === null ? null : fundsNow + additions - cumulative,
    });
  }

  const pendingTotal = overdueTotal + sum(upcoming.map((p) => p.amount));
  return {
    overdue,
    overdueTotal,
    months,
    pendingTotal,
    pendingCount: pending.length,
    estimateTotal: sum(pending.filter((p) => p.is_estimate).map((p) => p.amount)),
    paidTotal: sum(paid.map((p) => p.amount)),
    fundsNow,
    // The balance after the last month, so it agrees with the month-by-month rows (monthly additions included).
    leftAfterAll: fundsNow === null ? null : (months.length > 0 ? months[months.length - 1].balance : fundsNow - pendingTotal),
    firstShort: months.find((m) => m.balance !== null && m.balance < 0) ?? null,
    next: pending[0] ?? null,
  };
}

export type AreaRow = {
  topic: TopicRef;
  allocation: number | null;
  paid: number;
  pending: number;
  estimate: boolean; // some of what is still to pay is an estimate
  notScheduled: number; // chosen quotes that have no scheduled payment yet
  openLow: number;
  openHigh: number;
  openCount: number;
  left: number | null; // allocation less paid and still to pay
};

// Money by area. Paid comes from the ledger, still-to-pay from the schedule. Chosen quotes with nothing scheduled
// against them are shown separately as a nudge to schedule them, and open quotes are only a range, never added up.
// Shared planner facts (the honeymoon cap and the like) are not money to spend, so they are left out.
export function buildAreas(opts: { topics: TopicRef[]; items: ItemMoney[]; paid: PaidRow[]; pending: Scheduled[]; areas: AreaBudget[] }): AreaRow[] {
  return opts.topics.map((topic) => {
    const mine = opts.items.filter((i) => i.topic_id === topic.id && !i.slug);
    const money = summarizeMoney(mine.filter((i) => i.amount_kind !== 'paid'));
    const paid = sum(opts.paid.filter((p) => p.topic_id === topic.id).map((p) => p.amount));
    const pendingRows = opts.pending.filter((p) => p.status === 'pending' && p.topic_id === topic.id);
    const pending = sum(pendingRows.map((p) => p.amount));
    const allocation = opts.areas.find((a) => a.topic_id === topic.id)?.allocation ?? null;
    return {
      topic,
      allocation,
      paid,
      pending,
      estimate: pendingRows.some((p) => p.is_estimate),
      notScheduled: Math.max(0, money.planned - pending),
      openLow: money.openLow,
      openHigh: money.openHigh,
      openCount: money.openCount,
      left: allocation === null ? null : allocation - paid - pending,
    };
  });
}

export const hasMoney = (a: AreaRow) => a.allocation !== null || a.paid > 0 || a.pending > 0 || a.notScheduled > 0 || a.openCount > 0;
