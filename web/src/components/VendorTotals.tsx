import { useMemo } from 'react';
import { Badge, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { useBudgetPlan } from '../hooks/useBudgetPlan';
import { vendorTotals } from '../lib/budgetPlan';
import { formatInr } from '../lib/topicMeta';

const KIND: Record<string, string> = { venue: 'Venue', hotel: 'Hotel', caterer: 'Caterer', jeweller: 'Jeweller', photographer: 'Photographer', decor: 'Decor', travel: 'Travel', other: 'Other' };

// Who the money goes to: each vendor's payment lines from the Budget page, paid and still to pay. Lines are linked
// to a vendor in the Budget page's payment form.
export function VendorTotals() {
  const { schedule, outside, vendors, paid, loaded } = useBudgetPlan();
  const rows = useMemo(() => vendorTotals(vendors, [...schedule, ...outside], paid), [vendors, schedule, outside, paid]);
  if (!loaded || vendors.length === 0) return null;
  return (
    <Stack gap="sm">
      <Title order={4}>Who we pay</Title>
      <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={420}>
          <Table verticalSpacing={6} striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Vendor</Table.Th>
                <Table.Th ta="right">Paid</Table.Th>
                <Table.Th ta="right">Still to pay</Table.Th>
                <Table.Th ta="right">Lines</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.vendor.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {r.vendor.name}{' '}
                      <Badge size="xs" variant="light" color="gray" tt="none">
                        {KIND[r.vendor.kind] ?? r.vendor.kind}
                      </Badge>
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{formatInr(r.paid)}</Table.Td>
                  <Table.Td ta="right">{formatInr(r.pending)}</Table.Td>
                  <Table.Td ta="right">{r.lines}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
      <Text size="xs" c="dimmed">
        Paid comes from the payments recorded on the Budget page. Pick a vendor in a payment's form to add it here.
      </Text>
    </Stack>
  );
}
