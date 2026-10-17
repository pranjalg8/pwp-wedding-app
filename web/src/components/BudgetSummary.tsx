import { Box, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { daysBetween, monthLabel, shortDate, type BudgetSettings, type Plan } from '../lib/budgetPlan';
import { formatInr } from '../lib/topicMeta';

const signed = (v: number) => (v < 0 ? `−${formatInr(-v)}` : formatInr(v));

function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div>
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text fz={26} fw={700} lh={1.2} c={color}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </div>
  );
}

// Step 1: where the money stands. Paid, still to pay, the funds on hand and what is left if everything is paid,
// on one bar, followed by a plain verdict so the answer to "can we manage" is the first thing read.
export function BudgetSummary({
  plan,
  settings,
  notScheduled,
  today,
  isUnlocked,
  onEditSettings,
}: {
  plan: Plan;
  settings: BudgetSettings | null;
  notScheduled: number;
  today: string;
  isUnlocked: boolean;
  onEditSettings: () => void;
}) {
  const total = settings?.total_budget ?? null;
  const committed = plan.paidTotal + plan.pendingTotal + notScheduled;
  const scale = Math.max(total ?? 0, committed, 1);
  const free = total === null ? 0 : Math.max(0, total - committed);
  const over = total !== null && committed > total;

  const segments = [
    { key: 'paid', label: 'Paid', value: plan.paidTotal, color: 'var(--mantine-color-teal-6)' },
    { key: 'pending', label: 'Still to pay', value: plan.pendingTotal, color: 'var(--mantine-color-rose-6)' },
    { key: 'unscheduled', label: 'Chosen, not scheduled yet', value: notScheduled, color: 'var(--mantine-color-orange-5)' },
    { key: 'free', label: 'Left in the budget', value: free, color: 'var(--mantine-color-gray-4)' },
  ].filter((s) => s.value > 0);

  const lastMonth = plan.months[plan.months.length - 1];
  const next = plan.next;

  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
          <Stat label="Paid so far" value={formatInr(plan.paidTotal)} hint="From the payments ledger" />
          <Stat
            label="Still to pay"
            value={formatInr(plan.pendingTotal)}
            hint={
              plan.pendingCount === 0
                ? 'Nothing scheduled yet'
                : `${plan.pendingCount} payment${plan.pendingCount === 1 ? '' : 's'}${plan.estimateTotal > 0 ? ` · ${formatInr(plan.estimateTotal)} estimated` : ''}`
            }
          />
          <Stat
            label="Funds available"
            value={plan.fundsNow === null ? 'Not set' : formatInr(plan.fundsNow)}
            hint={plan.fundsNow === null ? 'Add your funds to check each month' : `as of ${shortDate(settings?.funds_as_of ?? today)}, less payments since`}
          />
          <Stat
            label="Left after paying all"
            value={plan.leftAfterAll === null ? '—' : signed(plan.leftAfterAll)}
            color={plan.leftAfterAll !== null && plan.leftAfterAll < 0 ? 'red' : undefined}
            hint={
              plan.leftAfterAll === null
                ? 'Needs your funds'
                : (settings?.monthly_addition ?? 0) > 0
                  ? `Funds plus ${formatInr(settings?.monthly_addition ?? 0)} a month, less all still to pay`
                  : 'Funds less everything still to pay'
            }
          />
        </SimpleGrid>

        <Stack gap={6}>
          <Group gap={2} wrap="nowrap" role="img" aria-label={segments.map((s) => `${s.label} ${formatInr(s.value)}`).join(', ')}>
            {segments.length === 0 ? (
              <Box h={12} style={{ flex: 1, borderRadius: 4, background: 'var(--mantine-color-gray-3)', opacity: 0.5 }} />
            ) : (
              segments.map((s) => <Box key={s.key} h={12} style={{ flex: s.value / scale, borderRadius: 4, background: s.color }} />)
            )}
          </Group>
          <Group gap="md">
            {segments.map((s) => (
              <Group key={s.key} gap={6} wrap="nowrap">
                <Box w={10} h={10} style={{ borderRadius: '50%', background: s.color }} />
                <Text size="xs">
                  {s.label} <b>{formatInr(s.value)}</b>
                </Text>
              </Group>
            ))}
            {total !== null && (
              <Text size="xs" c={over ? 'red' : 'dimmed'}>
                {over ? `Over the ${formatInr(total)} budget` : `of a ${formatInr(total)} budget`}
              </Text>
            )}
          </Group>
        </Stack>

        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={2}>
            {plan.fundsNow === null ? (
              <Text size="sm" c="dimmed">
                Add the money you have ready to see whether every month is covered.
              </Text>
            ) : plan.firstShort ? (
              <Text size="sm" c="red" fw={600}>
                Funds run short from {plan.firstShort.label}: {formatInr(Math.abs(plan.firstShort.balance ?? 0))} short once everything due by then is paid.
              </Text>
            ) : (
              <Text size="sm" c="teal" fw={600}>
                Funds cover everything due through {lastMonth ? lastMonth.label : monthLabel(today.slice(0, 7))}.
              </Text>
            )}
            {next && (
              <Text size="sm" c="dimmed">
                Next: {formatInr(next.amount)} to {next.payee}, due {shortDate(next.due_date)}
                {next.due_date < today ? ` (${daysBetween(next.due_date, today)} days overdue)` : ` (in ${daysBetween(today, next.due_date)} days)`}.
              </Text>
            )}
          </Stack>
          {isUnlocked && (
            <Button variant="light" size="compact-md" onClick={onEditSettings}>
              Budget and funds
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
