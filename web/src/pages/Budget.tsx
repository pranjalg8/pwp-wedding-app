import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Group, Stack, Table, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';

const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  in_progress: 'blue',
  decided: 'teal',
  done: 'gray',
};

type BudgetRow = Pick<PlanningItem, 'id' | 'title' | 'type' | 'status' | 'amount'> & {
  topic: Pick<Topic, 'key' | 'label'>;
};

function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

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

  const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Title order={2}>Budget</Title>
        <Text size="lg" fw={700}>
          {formatInr(total)}
        </Text>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Topic</Table.Th>
            <Table.Th>Item</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Text component={Link} to={`/topics/${r.topic.key}`} size="sm">
                  {r.topic.label}
                </Text>
              </Table.Td>
              <Table.Td>{r.title}</Table.Td>
              <Table.Td>{r.type}</Table.Td>
              <Table.Td>
                <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
              </Table.Td>
              <Table.Td>{formatInr(r.amount ?? 0)}</Table.Td>
            </Table.Tr>
          ))}
          {rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed">No budgeted items yet — add an amount to a planning item to see it here.</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
