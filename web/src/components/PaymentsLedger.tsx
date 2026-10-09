import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { formatInr } from '../lib/topicMeta';
import { useEditMode } from '../hooks/useEditMode';
import { PaymentEditor, type Payment } from './PaymentEditor';

// Amounts come back from Postgres numeric as strings; add in paise so the total is exact.
const paise = (n: number | string) => Math.round(Number(n) * 100);

export function PaymentsLedger({ plannerPaid }: { plannerPaid: number }) {
  const { isUnlocked } = useEditMode();
  const [rows, setRows] = useState<Payment[]>([]);
  const [editing, setEditing] = useState<Payment | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function remove(p: Payment) {
    if (!window.confirm(`Delete the ${formatInr(Number(p.amount))} payment to ${p.payee}? This is recorded in the activity log.`)) return;
    setError(null);
    const { error: err } = await supabase.from('payments').delete().eq('id', p.id);
    if (err) setError(err.message);
    else load();
  }

  const total = rows.reduce((s, r) => s + paise(r.amount), 0) / 100;
  const checked = rows.filter((r) => r.verification === 'receipt_checked').reduce((s, r) => s + paise(r.amount), 0) / 100;
  const unchecked = total - checked;
  const mismatch = paise(total) !== paise(plannerPaid);
  const columns = isUnlocked ? 5 : 4;

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text fw={700} fz="lg">Payments made</Text>
        <Group gap="sm">
          <Text fw={700}>{formatInr(total)}</Text>
          {isUnlocked && (
            <Button size="xs" variant="light" onClick={() => setEditing('new')}>
              Add payment
            </Button>
          )}
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        {formatInr(checked)} checked against a receipt{unchecked > 0 ? `, ${formatInr(unchecked)} from chat only` : ''}.
      </Text>
      {mismatch && (
        <Alert color="orange" title="Totals do not match">
          The ledger adds up to {formatInr(total)} but the planner items marked paid add up to {formatInr(plannerPaid)}. One of them is missing or wrong.
        </Alert>
      )}
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Paid to</Table.Th>
                <Table.Th>Proof</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                {isUnlocked && <Table.Th />}
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
                  {isUnlocked && (
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      <Button size="compact-xs" variant="subtle" onClick={() => setEditing(r)}>Edit</Button>
                      <Button size="compact-xs" variant="subtle" color="red" onClick={() => remove(r)}>Delete</Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr><Table.Td colSpan={columns}><Text c="dimmed">No payments recorded yet.</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {isUnlocked && editing && (
        <PaymentEditor
          key={editing === 'new' ? 'new' : editing.id}
          payment={editing === 'new' ? null : editing}
          opened
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </Stack>
  );
}
