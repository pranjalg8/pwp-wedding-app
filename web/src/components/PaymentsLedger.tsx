import { useEffect, useState } from 'react';
import { Alert, Badge, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { formatInr } from '../lib/topicMeta';

type Payment = {
  id: string;
  paid_on: string;
  payee: string;
  amount: number;
  method: string | null;
  reference: string | null;
  purpose: string | null;
  verification: 'receipt_checked' | 'chat_only';
  verification_note: string | null;
};

// Amounts come back from Postgres numeric as strings; add in paise so the total is exact.
const paise = (n: number | string) => Math.round(Number(n) * 100);

export function PaymentsLedger({ plannerPaid }: { plannerPaid: number }) {
  const [rows, setRows] = useState<Payment[]>([]);

  async function load() {
    const { data } = await supabase
      .from('payments')
      .select('id, paid_on, payee, amount, method, reference, purpose, verification, verification_note')
      .order('paid_on', { ascending: false });
    setRows((data ?? []) as Payment[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('payments_ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const total = rows.reduce((s, r) => s + paise(r.amount), 0) / 100;
  const checked = rows.filter((r) => r.verification === 'receipt_checked').reduce((s, r) => s + paise(r.amount), 0) / 100;
  const unchecked = total - checked;
  const mismatch = paise(total) !== paise(plannerPaid);

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="baseline">
        <Text fw={700} fz="lg">Payments made</Text>
        <Text fw={700}>{formatInr(total)}</Text>
      </Group>
      <Text size="sm" c="dimmed">
        {formatInr(checked)} checked against a receipt{unchecked > 0 ? `, ${formatInr(unchecked)} from chat only` : ''}.
      </Text>
      {mismatch && (
        <Alert color="orange" title="Totals do not match">
          The ledger adds up to {formatInr(total)} but the planner items marked paid add up to {formatInr(plannerPaid)}. One of them is missing or wrong.
        </Alert>
      )}
      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Paid to</Table.Th>
                <Table.Th>Proof</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(r.paid_on + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>{r.payee}</Text>
                    {r.purpose && <Text size="xs" c="dimmed">{r.purpose}</Text>}
                    {r.reference && <Text size="xs" c="dimmed">{r.reference}{r.method ? ` · ${r.method}` : ''}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={r.verification === 'receipt_checked' ? 'teal' : 'orange'} variant="light">
                      {r.verification === 'receipt_checked' ? 'Receipt checked' : 'Not verified'}
                    </Badge>
                    {r.verification_note && <Text size="xs" c="dimmed" mt={4}>{r.verification_note}</Text>}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>{formatInr(Number(r.amount))}</Table.Td>
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr><Table.Td colSpan={4}><Text c="dimmed">No payments recorded yet.</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
