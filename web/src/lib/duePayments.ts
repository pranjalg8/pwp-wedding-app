// Pending payments that need attention soon: overdue, or due within `windowDays`. Pure, so it can be tested.
export type DuePayment = { id: string; payee: string; amount: number | string; due_date: string | null; status: string };

const dayNumber = (iso: string) => Math.round(new Date(iso + 'T00:00:00Z').getTime() / 86_400_000);

export function dueSoon<T extends DuePayment>(payments: T[], today: string, windowDays = 14): (T & { days: number })[] {
  const t = dayNumber(today);
  return payments
    .filter((p) => p.status === 'pending' && p.due_date && /^\d{4}-\d{2}-\d{2}$/.test(p.due_date))
    .map((p) => ({ ...p, days: dayNumber(p.due_date!) - t }))
    .filter((p) => p.days <= windowDays)
    .sort((a, b) => a.days - b.days || a.payee.localeCompare(b.payee));
}

export function dueLabel(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  return `due in ${days} day${days === 1 ? '' : 's'}`;
}
