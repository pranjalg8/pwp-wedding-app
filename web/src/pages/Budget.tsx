import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { STATUS_COLOR, STATUS_LABEL, formatInr } from '../lib/topicMeta';

type BudgetRow = Pick<PlanningItem, 'id' | 'title' | 'type' | 'status' | 'amount'> & {
  topic: Pick<Topic, 'key' | 'label'>;
};

const isSettled = (s: string) => s === 'decided' || s === 'done';

export function Budget() {
  const [rows, setRows] = useState<BudgetRow[]>([]);

  async function load() {
    const { data } = await supabase
      .from('planning_items')
      .select('id, title, type, status, amount, topic:topics(key, label)')
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

  const committed = rows.filter((r) => isSettled(r.status)).reduce((s, r) => s + (r.amount ?? 0), 0);
  const considering = rows.filter((r) => !isSettled(r.status)).reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <Stack>
      <Title order={2}>Budget</Title>

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
            Committed
          </Text>
          <Text fz={28} fw={700}>
            {formatInr(committed)}
          </Text>
          <Text size="xs" c="dimmed">
            Decided or done
          </Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
            Still comparing
          </Text>
          <Text fz={28} fw={700}>
            {formatInr(considering)}
          </Text>
          <Text size="xs" c="dimmed">
            Open quotes, not all of this will be spent
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={560}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Topic</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.id} style={{ opacity: isSettled(r.status) ? 1 : 0.7 }}>
                  <Table.Td>
                    <Text fw={500}>{r.title}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text component={Link} to={`/topics/${r.topic.key}`} size="sm" c="rose.6">
                      {r.topic.label}
                    </Text>
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
                  <Table.Td colSpan={4}>
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
