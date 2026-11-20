// The Home timeline: every dated thing in the planner on one line, from today to the honeymoon.
// Planning is the work of deciding (tasks). Executing is the work of doing it (payments, the functions themselves,
// the honeymoon). Each entry links to the page where it is handled, so the timeline is a map of the whole planner.

export type TimelineSection = 'tasks' | 'budget' | 'functions' | 'honeymoon';
export type TimelinePhase = 'plan' | 'execute';
export type TimelineState = 'done' | 'overdue' | 'upcoming';

export type TimelineEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  detail?: string;
  section: TimelineSection;
  phase: TimelinePhase;
  state: TimelineState;
  to: string;
  milestone?: boolean; // the wedding days and the honeymoon, drawn larger
};

export type TimelineTask = { id: string; title: string; due_date: string | null; status: string };
export type TimelinePayment = { id: string; payee: string; amount: number | string | null; due_date: string | null; status: string };
export type TimelineFunction = { id: string; name: string; event_date: string | null };

export const SECTION_META: Record<TimelineSection, { label: string; icon: string; color: string }> = {
  tasks: { label: 'Tasks', icon: '✅', color: 'grape' },
  budget: { label: 'Budget', icon: '💰', color: 'teal' },
  functions: { label: 'Functions', icon: '🎉', color: 'rose' },
  honeymoon: { label: 'Honeymoon', icon: '🏝️', color: 'blue' },
};

const isTaskDone = (status: string) => status === 'done' || status === 'decided';

function stateFor(date: string, done: boolean, today: string): TimelineState {
  if (done) return 'done';
  return date < today ? 'overdue' : 'upcoming';
}

function rupees(n: number) {
  if (n >= 100000) return `₹${Math.round(n / 1000) / 100}L`; // lakhs to two places: 1,32,500 is ₹1.33L
  return `₹${n.toLocaleString('en-IN')}`;
}

// Payments due on the same day are one entry ("4 payments, ₹1.68L"), because the budget has many small lines on a
// few dates and listing each would bury everything else. Cancelled lines are left out.
export function buildTimeline(
  input: {
    tasks: TimelineTask[];
    payments: TimelinePayment[];
    functions: TimelineFunction[];
    honeymoon?: { start: string; end: string } | null;
  },
  today: string
): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  for (const t of input.tasks) {
    if (!t.due_date) continue;
    out.push({
      id: `task-${t.id}`,
      date: t.due_date,
      title: t.title,
      section: 'tasks',
      phase: 'plan',
      state: stateFor(t.due_date, isTaskDone(t.status), today),
      to: `/tasks/${t.id}`,
    });
  }

  const byDay = new Map<string, TimelinePayment[]>();
  for (const p of input.payments) {
    if (!p.due_date || p.status === 'cancelled') continue;
    const list = byDay.get(p.due_date) ?? [];
    list.push(p);
    byDay.set(p.due_date, list);
  }
  for (const [date, list] of byDay) {
    const total = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const allPaid = list.every((p) => p.status === 'paid');
    const names = list.map((p) => p.payee);
    out.push({
      id: `pay-${date}`,
      date,
      title: list.length === 1 ? `Pay: ${names[0]}` : `${list.length} payments due`,
      detail:
        list.length === 1
          ? total > 0 ? rupees(total) : undefined
          : `${total > 0 ? `${rupees(total)}: ` : ''}${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`,
      section: 'budget',
      phase: 'execute',
      state: stateFor(date, allPaid, today),
      to: '/budget',
    });
  }

  for (const f of input.functions) {
    if (!f.event_date) continue;
    out.push({
      id: `fn-${f.id}`,
      date: f.event_date,
      title: f.name,
      section: 'functions',
      phase: 'execute',
      state: f.event_date < today ? 'done' : 'upcoming',
      to: '/functions',
      milestone: true,
    });
  }

  if (input.honeymoon) {
    const { start, end } = input.honeymoon;
    out.push({
      id: 'honeymoon',
      date: start,
      title: 'Honeymoon starts',
      detail: end !== start ? `Until ${end}` : undefined,
      section: 'honeymoon',
      phase: 'execute',
      state: end < today ? 'done' : 'upcoming',
      to: '/honeymoon',
      milestone: true,
    });
  }

  // Same day: events first (they anchor the day), then payments, then tasks; ties keep a stable title order.
  const rank: Record<TimelineSection, number> = { functions: 0, honeymoon: 0, budget: 1, tasks: 2 };
  return out.sort((a, b) => a.date.localeCompare(b.date) || rank[a.section] - rank[b.section] || a.title.localeCompare(b.title));
}

// Group entries under month headings ("November 2026"), keeping their order.
export function groupByMonth(entries: TimelineEntry[]): { key: string; label: string; entries: TimelineEntry[] }[] {
  const groups: { key: string; label: string; entries: TimelineEntry[] }[] = [];
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      g = { key, label, entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

export type TimelineView = 'all' | 'plan' | 'execute';

// What the timeline shows: by default only what is still to do (overdue first, then upcoming) plus future events;
// "show done" adds everything already finished.
export function visibleEntries(entries: TimelineEntry[], view: TimelineView, showDone: boolean): TimelineEntry[] {
  return entries.filter((e) => (view === 'all' || e.phase === view) && (showDone || e.state !== 'done'));
}
