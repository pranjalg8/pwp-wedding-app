import { useMemo, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { buildTree, type TreeNode } from '../lib/budgetTree';
import { shortDate, type PaidRow, type Scheduled, type Side, type TopicRef } from '../lib/budgetPlan';
import { formatInr } from '../lib/topicMeta';

type Props = {
  topics: TopicRef[];
  paid: PaidRow[];
  schedule: Scheduled[];
  side: Side;
  budgets: { gold: number | null; wedding: number | null; post_wedding: number | null };
};

const money = (n: number) => (Math.abs(n) < 0.005 ? <Text component="span" size="sm" c="dimmed">—</Text> : formatInr(Math.round(n)));

// The budget as a tree: headers, then areas, then the payments. Each row rolls up what is below it, so a header's
// figures are the sum of its areas and an area's are the sum of its payments.
export function BudgetTree({ topics, paid, schedule, side, budgets }: Props) {
  const tree = useMemo(() => buildTree({ topics, paid, pending: schedule, side, budgets }), [topics, paid, schedule, side, budgets]);
  // Headers start open and areas closed, so the first view is the roll-up of each header.
  const [open, setOpen] = useState<Set<string>>(() => new Set(['total', 'gold', 'wedding', 'post_wedding', 'buffer']));
  const toggle = (key: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allKeys = useMemo(() => {
    const keys = ['total'];
    for (const g of [...tree.groups]) {
      keys.push(g.key);
      for (const a of g.children) keys.push(`${g.key}/${a.key}`);
    }
    return keys;
  }, [tree]);

  const row = (node: TreeNode, key: string, depth: 0 | 1 | 2, hasKids: boolean) => {
    const used = node.paid + node.pending;
    const left = node.budget === null ? null : node.budget - used;
    const isOpen = open.has(key);
    return (
      <Table.Tr key={key} bg={depth === 0 ? 'var(--mantine-color-default-hover)' : undefined}>
        <Table.Td style={{ paddingLeft: 8 + depth * 18 }}>
          <UnstyledButton onClick={() => hasKids && toggle(key)} aria-expanded={hasKids ? isOpen : undefined} aria-label={hasKids ? `${isOpen ? 'Collapse' : 'Expand'} ${node.label}` : undefined} style={{ cursor: hasKids ? 'pointer' : 'default' }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" c="dimmed" w={12} aria-hidden>
                {hasKids ? (isOpen ? '▾' : '▸') : ''}
              </Text>
              <Text size="sm" fw={depth === 0 ? 700 : 600}>
                {node.label}
              </Text>
              {node.estimate && depth > 0 && (
                <Badge size="xs" color="orange" variant="light">
                  estimate
                </Badge>
              )}
            </Group>
          </UnstyledButton>
        </Table.Td>
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          {node.budget === null ? money(0) : formatInr(node.budget)}
        </Table.Td>
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          {money(node.paid)}
        </Table.Td>
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          {money(node.pending)}
        </Table.Td>
        <Table.Td ta="right" fw={600} style={{ whiteSpace: 'nowrap' }}>
          {money(used)}
        </Table.Td>
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          {left === null ? (
            money(0)
          ) : (
            <Text component="span" size="sm" fw={600} c={left < 0 ? 'red' : 'teal'}>
              {left < 0 ? `−${formatInr(Math.round(-left))}` : formatInr(Math.round(left))}
            </Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  };

  const lineRows = (node: TreeNode, parent: string) =>
    node.lines.map((l) => (
      <Table.Tr key={`${parent}/${l.id}`}>
        <Table.Td style={{ paddingLeft: 8 + 2 * 18 + 18 }}>
          <Text size="xs">{l.label}</Text>
          <Text size="xs" c="dimmed">
            {l.kind === 'paid' ? 'Paid' : 'Due'} {shortDate(l.date)}
            {l.kind === 'pending' && l.estimate ? ' · estimate' : ''}
          </Text>
        </Table.Td>
        <Table.Td />
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          <Text size="xs">{l.kind === 'paid' ? formatInr(Math.round(l.amount)) : ''}</Text>
        </Table.Td>
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          <Text size="xs">{l.kind === 'pending' ? formatInr(Math.round(l.amount)) : ''}</Text>
        </Table.Td>
        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
          <Text size="xs">{formatInr(Math.round(l.amount))}</Text>
        </Table.Td>
        <Table.Td />
      </Table.Tr>
    ));

  const groupRows = (g: TreeNode) => {
    const out = [row(g, g.key, 1, g.children.length > 0)];
    if (open.has(g.key)) {
      for (const a of g.children) {
        const k = `${g.key}/${a.key}`;
        out.push(row(a, k, 2, a.lines.length > 0));
        if (open.has(k)) out.push(...lineRows(a, k));
      }
    }
    return out;
  };

  return (
    <Paper withBorder p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Text size="xs" c="dimmed" maw={460}>
            Each row adds up what is below it. {side === 'pranjal' ? 'Budgets are Pranjal’s, one per header.' : 'Budgets show only in Pranjal’s view.'} The contingency buffer is kept outside the budget, so the total leaves it out.
          </Text>
          <Group gap="xs">
            <Button size="compact-sm" variant="light" onClick={() => setOpen(new Set(allKeys))}>
              Expand all
            </Button>
            <Button size="compact-sm" variant="default" onClick={() => setOpen(new Set())}>
              Collapse all
            </Button>
          </Group>
        </Group>
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Budget</Table.Th>
                <Table.Th ta="right">Budget</Table.Th>
                <Table.Th ta="right">Paid</Table.Th>
                <Table.Th ta="right">Still to pay</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th ta="right">Left</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {row(tree.total, 'total', 0, tree.total.children.length > 0)}
              {open.has('total') && tree.groups.filter((g) => g.key !== 'buffer').flatMap(groupRows)}
              {tree.outside && (
                <>
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text size="xs" c="dimmed" pt="xs">
                        Kept outside the budget
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  {groupRows(tree.outside)}
                </>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Paper>
  );
}
