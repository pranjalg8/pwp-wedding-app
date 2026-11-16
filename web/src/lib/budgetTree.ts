import { shareOf, sum, type PaidRow, type Scheduled, type Side, type TopicRef } from './budgetPlan';

// The budget as a tree: header (gold, wedding, post-wedding, buffer) > area > payments. Every level rolls up what is
// paid, what is still to pay and, for headers, the budget. The contingency buffer is kept outside the budget, so
// the grand total leaves it out.
export type TreeGroupKey = 'gold' | 'wedding' | 'post_wedding' | 'buffer';

export type TreeLine = { id: string; label: string; date: string; kind: 'paid' | 'pending'; amount: number; estimate: boolean };
export type TreeNode = {
  key: string;
  label: string;
  paid: number;
  pending: number;
  budget: number | null;
  estimate: boolean; // some of what is still to pay is an estimate
  children: TreeNode[];
  lines: TreeLine[];
};
export type Tree = { groups: TreeNode[]; total: TreeNode; outside: TreeNode | null };

export const GROUP_LABEL: Record<TreeGroupKey, string> = { gold: 'Gold', wedding: 'Wedding', post_wedding: 'Post-wedding', buffer: 'Contingency buffer' };
const ORDER: TreeGroupKey[] = ['gold', 'wedding', 'post_wedding', 'buffer'];
const NONE = '__none';

const roll = (key: string, label: string, kids: TreeNode[], lines: TreeLine[], budget: number | null): TreeNode => ({
  key,
  label,
  paid: sum(kids.map((k) => k.paid)) + sum(lines.filter((l) => l.kind === 'paid').map((l) => l.amount)),
  pending: sum(kids.map((k) => k.pending)) + sum(lines.filter((l) => l.kind === 'pending').map((l) => l.amount)),
  budget,
  estimate: kids.some((k) => k.estimate) || lines.some((l) => l.kind === 'pending' && l.estimate),
  children: kids,
  lines,
});

export function buildTree(opts: {
  topics: TopicRef[];
  paid: (PaidRow & { payee?: string | null })[];
  pending: Scheduled[];
  side: Side;
  budgets?: Partial<Record<TreeGroupKey, number | null>>; // Pranjal's budget for each header
}): Tree {
  const { side } = opts;
  // Payments with no area still count; they sit under the wedding in an "Unassigned" area.
  const areas: (TopicRef | { id: typeof NONE; key: string; label: string; budget_group: TreeGroupKey })[] = [
    ...opts.topics,
    { id: NONE, key: NONE, label: 'Unassigned', budget_group: 'wedding' },
  ];

  const nodeFor = (area: (typeof areas)[number]): TreeNode | null => {
    const match = (topicId: string | null) => (area.id === NONE ? topicId === null || !opts.topics.some((t) => t.id === topicId) : topicId === area.id);
    const lines: TreeLine[] = [
      ...opts.paid
        .filter((p) => match(p.topic_id))
        .map((p) => ({ id: p.id, label: p.payee ?? 'Payment', date: p.paid_on, kind: 'paid' as const, amount: shareOf(p.amount, p.paridhi_amount, side), estimate: false })),
      ...opts.pending
        .filter((p) => p.status === 'pending' && match(p.topic_id))
        .map((p) => ({ id: p.id, label: p.payee, date: p.due_date, kind: 'pending' as const, amount: shareOf(p.amount, p.paridhi_amount, side), estimate: p.is_estimate })),
    ]
      .filter((l) => l.amount > 0.005)
      .sort((a, b) => (a.kind === b.kind ? a.date.localeCompare(b.date) : a.kind === 'paid' ? -1 : 1));
    return lines.length ? roll(area.key, area.label, [], lines, null) : null;
  };

  const groups = ORDER.map((g) => {
    const kids = areas.filter((a) => (a.id === NONE ? 'wedding' : (a.budget_group ?? 'wedding')) === g).map(nodeFor).filter((n): n is TreeNode => n !== null);
    const budget = side === 'pranjal' ? (opts.budgets?.[g] ?? null) : null;
    return roll(g, GROUP_LABEL[g], kids, [], budget);
  }).filter((g) => g.children.length > 0 || g.budget !== null);

  const inBudget = groups.filter((g) => g.key !== 'buffer');
  const set = inBudget.map((g) => g.budget).filter((b): b is number => b !== null);
  const total = roll('total', 'All headers', inBudget, [], set.length ? sum(set) : null);
  const outside = groups.find((g) => g.key === 'buffer') ?? null;
  return { groups, total, outside };
}
