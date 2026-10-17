import { useState } from 'react';
import { Anchor, Button, Group, Paper, Progress, Stack, Table, Text } from '@mantine/core';
import { hasMoney, sum, type AreaRow } from '../lib/budgetPlan';
import { formatInr, formatInrCompact } from '../lib/topicMeta';

// Step 3: by area. Each area's budget against what is paid and still to pay, so it is clear where the money
// goes and where there is room. Chosen quotes with nothing scheduled are called out, because they are money that
// will need paying but is not yet in the month-by-month view.
export function AreaBudget({ rows, isUnlocked, onEditBudgets }: { rows: AreaRow[]; isUnlocked: boolean; onEditBudgets: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const active = rows.filter(hasMoney);
  const quiet = rows.filter((r) => !hasMoney(r));
  const shown = showAll ? rows : active;

  const budgetTotal = sum(active.map((r) => r.allocation ?? 0));
  const paidTotal = sum(rows.map((r) => r.paid));
  const pendingTotal = sum(rows.map((r) => r.pending));

  return (
    <Paper withBorder p="lg">
      <Stack gap="sm">
        {isUnlocked && (
          <Group justify="flex-end">
            <Button size="compact-md" variant="light" onClick={onEditBudgets}>
              Set area budgets
            </Button>
          </Group>
        )}

        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing="sm" horizontalSpacing="xs" withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Area</Table.Th>
                <Table.Th ta="right">Budget</Table.Th>
                <Table.Th ta="right">Paid</Table.Th>
                <Table.Th ta="right">Still to pay</Table.Th>
                <Table.Th ta="right">Left</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((r) => {
                const used = r.paid + r.pending;
                const over = r.allocation !== null && used > r.allocation;
                return (
                  <Table.Tr key={r.topic.id}>
                    <Table.Td style={{ minWidth: 170 }}>
                      <Text size="sm" fw={600}>
                        {r.topic.label}
                      </Text>
                      {r.allocation !== null && r.allocation > 0 && (
                        <Progress.Root size={5} mt={4} style={{ maxWidth: 200 }} aria-label={`${r.topic.label}: ${formatInr(used)} of ${formatInr(r.allocation)}`}>
                          <Progress.Section value={Math.min(100, (r.paid / r.allocation) * 100)} color="teal" />
                          <Progress.Section value={Math.min(100 - Math.min(100, (r.paid / r.allocation) * 100), (r.pending / r.allocation) * 100)} color={over ? 'red' : 'rose'} />
                        </Progress.Root>
                      )}
                      {r.notScheduled > 0 && (
                        <Text size="xs" c="orange" mt={2}>
                          {formatInr(r.notScheduled)} of chosen quotes not scheduled yet
                        </Text>
                      )}
                      {r.openCount > 0 && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {r.openCount} open quote{r.openCount === 1 ? '' : 's'}: {r.openLow === r.openHigh ? formatInrCompact(r.openLow) : `${formatInrCompact(r.openLow)} to ${formatInrCompact(r.openHigh)}`}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {r.allocation === null ? (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      ) : (
                        formatInr(r.allocation)
                      )}
                    </Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {r.paid > 0 ? formatInr(r.paid) : <Text size="sm" c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {r.pending > 0 ? (
                        <>
                          {formatInr(r.pending)}
                          {r.estimate && (
                            <Text size="xs" c="orange">
                              estimate
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {r.left === null ? (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      ) : (
                        <Text size="sm" fw={600} c={r.left < 0 ? 'red' : undefined}>
                          {r.left < 0 ? `${formatInr(Math.abs(r.left))} over` : formatInr(r.left)}
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              <Table.Tr>
                <Table.Td>
                  <Text size="sm" fw={700}>
                    All areas
                  </Text>
                </Table.Td>
                <Table.Td ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                  {budgetTotal > 0 ? formatInr(budgetTotal) : '—'}
                </Table.Td>
                <Table.Td ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                  {formatInr(paidTotal)}
                </Table.Td>
                <Table.Td ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                  {formatInr(pendingTotal)}
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {quiet.length > 0 && (
          <Anchor component="button" type="button" size="xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Hide the areas with no money recorded' : `${quiet.length} more area${quiet.length === 1 ? '' : 's'} with no money recorded yet`}
          </Anchor>
        )}
      </Stack>
    </Paper>
  );
}
