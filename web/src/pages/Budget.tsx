import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { PaymentsLedger } from '../components/PaymentsLedger';
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, formatAsOf, formatInr, formatInrCompact, summarizeMoney } from '../lib/topicMeta';

type BudgetRow = Pick<PlanningItem, 'id' | 'title' | 'type' | 'status' | 'amount' | 'amount_kind' | 'amount_note' | 'as_of'> & {
  topic: Pick<Topic, 'key' | 'label'>;
};

const isSettled = (s: string) => s === 'decided' || s === 'done';

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Paper withBorder p="md">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text fz={28} fw={700}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    </Paper>
  );
}

export function Budget() {
  const [rows, setRows] = useState<BudgetRow[]>([]);

  async function load() {
    const { data } = await supabase
      .from('planning_items')
      .select('id, title, type, status, amount, amount_kind, amount_note, as_of, topic:topics(key, label)')
      .not('amount', 'is', null)
      .order('amount', { ascending: false });
    setRows((data ?? []) as unknown as BudgetRow[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('planning_items_budget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const money = summarizeMoney(rows);

  return (
    <Stack>
      <Title order={2}>Budget</Title>

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        <Tile label="Paid so far" value={formatInr(money.paid)} hint="Money already spent" />
        <Tile label="Planned & chosen" value={formatInr(money.planned)} hint="Budgets and quotes you picked" />
        <Tile
          label="Open quotes"
          value={
            money.openCount === 0
              ? '—'
              : money.openLow === money.openHigh
                ? formatInrCompact(money.openLow)
                : `${formatInrCompact(money.openLow)}–${formatInrCompact(money.openHigh)}`
          }
          hint={money.openCount === 0 ? 'None being compared' : `${money.openCount} alternatives, not added up`}
        />
      </SimpleGrid>

      <PaymentsLedger plannerPaid={money.paid} />

      <Text fw={700} fz="lg">Everything with an amount</Text>
      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={640}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Topic</Table.Th>
                <Table.Th>Kind</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.id} style={{ opacity: isSettled(r.status) || r.amount_kind === 'paid' ? 1 : 0.75 }}>
                  <Table.Td>
                    <Text fw={500}>{r.title}</Text>
                    {r.amount_note && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {r.amount_note}
                        {r.as_of ? ` (as of ${formatAsOf(r.as_of)})` : ''}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text component={Link} to={`/topics/${r.topic.key}`} size="sm" c="rose.6">
                      {r.topic.label}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={r.amount_kind === 'paid' ? 'teal' : r.amount_kind === 'planned' ? 'blue' : 'gray'} variant="light">
                      {KIND_LABEL[r.amount_kind ?? 'quote']}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOR[r.status]} variant="light">
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatInr(r.amount ?? 0)}
                  </Table.Td>
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed">No budgeted items yet. Add an amount to an item to see it here.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
