import { Paper, Table, Text } from '@mantine/core';
import { SIDE_LABEL, type Plan, type Side } from '../lib/budgetPlan';
import { formatInr } from '../lib/topicMeta';

const signed = (v: number) => (v < 0 ? `−${formatInr(-v)}` : formatInr(v));
const SIDES: Side[] = ['pranjal', 'paridhi', 'both'];

// The three views of the money on one table, so each person's share is visible without switching.
export function SideBySide({ plans, side, onPick }: { plans: Record<Side, Plan>; side: Side; onPick: (s: Side) => void }) {
  const rows: { label: string; cell: (p: Plan) => { text: string; red?: boolean } }[] = [
    { label: 'Paid so far', cell: (p) => ({ text: formatInr(p.paidTotal) }) },
    { label: 'Still to pay', cell: (p) => ({ text: formatInr(p.pendingTotal) }) },
    { label: 'Funds available', cell: (p) => ({ text: p.fundsNow === null ? 'Not set' : formatInr(p.fundsNow) }) },
    { label: 'Left after paying all', cell: (p) => (p.leftAfterAll === null ? { text: '—' } : { text: signed(p.leftAfterAll), red: p.leftAfterAll < 0 }) },
    { label: 'First short month', cell: (p) => (p.fundsNow === null ? { text: '—' } : p.firstShort ? { text: p.firstShort.label, red: true } : { text: 'None' }) },
  ];
  return (
    <Paper withBorder p="sm">
      <Table.ScrollContainer minWidth={380}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              {SIDES.map((s) => (
                <Table.Th key={s} ta="right" style={{ fontWeight: side === s ? 700 : 500 }}>
                  {SIDE_LABEL[s]}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.label}>
                <Table.Td>
                  <Text size="sm">{r.label}</Text>
                </Table.Td>
                {SIDES.map((s) => {
                  const c = r.cell(plans[s]);
                  return (
                    <Table.Td key={s} ta="right" style={{ whiteSpace: 'nowrap', cursor: 'pointer', background: side === s ? 'var(--mantine-color-default-hover)' : undefined }} onClick={() => onPick(s)}>
                      <Text size="sm" fw={side === s ? 700 : 500} c={c.red ? 'red' : c.text === 'Not set' || c.text === '—' ? 'dimmed' : undefined}>
                        {c.text}
                      </Text>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
