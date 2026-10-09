export const TOPIC_EMOJI: Record<string, string> = {
  dates_logistics: '🗓️',
  jewellery: '💍',
  outfits: '👗',
  decor: '🌼',
  photography: '📸',
  mehndi: '🌿',
  dance: '💃',
  events: '🎉',
  accommodations: '🏨',
  gifts: '🎁',
  shopping: '🛍️',
  reception: '🥂',
  honeymoon: '🏝️',
  post_wedding: '🏡',
};

export const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  in_progress: 'blue',
  decided: 'teal',
  done: 'gray',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  decided: 'Decided',
  done: 'Done',
};

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatInrCompact(amount: number) {
  if (amount >= 100_000) {
    const lakhs = amount / 100_000;
    return `₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(2).replace(/0$/, '')}L`;
  }
  if (amount >= 1_000) return `₹${Math.round(amount / 1_000)}K`;
  return `₹${amount}`;
}

export const KIND_LABEL: Record<string, string> = {
  paid: 'Paid',
  planned: 'Planned budget',
  quote: 'Quote',
};

type MoneyItem = { amount: number | null; status: string; amount_kind: string | null };

// paid = money already spent; planned = a budget cap or a quote you have chosen;
// open quotes are alternatives still being compared and are never summed.
export function summarizeMoney(items: MoneyItem[]) {
  let paid = 0;
  let planned = 0;
  const open: number[] = [];
  for (const i of items) {
    if (!i.amount) continue;
    const settled = i.status === 'decided' || i.status === 'done';
    const kind = i.amount_kind ?? 'quote';
    if (kind === 'paid') paid += i.amount;
    else if (kind === 'planned' || settled) planned += i.amount;
    else open.push(i.amount);
  }
  return {
    paid,
    planned,
    openCount: open.length,
    openLow: open.length ? Math.min(...open) : 0,
    openHigh: open.length ? Math.max(...open) : 0,
  };
}

export function formatAsOf(date: string | null) {
  if (!date) return null;
  return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const OPTION_STATUS_LABEL: Record<string, string> = {
  chosen: 'Chosen',
  shortlisted: 'Shortlisted',
  considering: 'Considering',
  on_hold: 'On hold',
  rejected: 'Rejected',
};

export const OPTION_STATUS_COLOR: Record<string, string> = {
  chosen: 'teal',
  shortlisted: 'blue',
  considering: 'gray',
  on_hold: 'yellow',
  rejected: 'red',
};

export const OPTION_STATUS_ORDER = ['chosen', 'shortlisted', 'considering', 'on_hold', 'rejected'];

export const OWNER_LABEL: Record<string, string> = { both: 'Both of us', pranjal: 'Pranjal', paridhi: 'Paridhi' };

// Whole days from today (local date) to a YYYY-MM-DD due date; negative when overdue.
export function daysToDue(due: string) {
  const today = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00');
  return Math.round((new Date(due + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
}

export function dueBadge(due: string | null, done: boolean) {
  if (!due) return null;
  const d = daysToDue(due);
  const date = new Date(due + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (done) return { label: `Due ${date}`, color: 'gray' };
  if (d < 0) return { label: `${Math.abs(d)} d overdue (${date})`, color: 'red' };
  if (d === 0) return { label: `Due today`, color: 'orange' };
  if (d <= 14) return { label: `Due in ${d} d (${date})`, color: 'orange' };
  return { label: `Due ${date} (${d} d)`, color: 'gray' };
}
