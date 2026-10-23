import { Badge, Button, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { daysBetween, shortDate, type MonthRow, type Plan, type Scheduled, type Side, type TopicRef } from '../lib/budgetPlan';
import { formatInr } from '../lib/topicMeta';

function PaymentLine({
  p,
  topics,
  late,
  whole,
  isUnlocked,
  onPaid,
  onEdit,
}: {
  p: Scheduled;
  whole?: number; // the full payment, shown when only one side's share is on screen
  topics: TopicRef[];
  late?: number;
  isUnlocked: boolean;
  onPaid: (p: Scheduled) => void;
  onEdit: (p: Scheduled) => void;
}) {
  const area = topics.find((t) => t.id === p.topic_id)?.label;
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
      <Group gap="sm" align="flex-start" wrap="nowrap" style={{ minWidth: 0, flex: '1 1 240px' }}>
        <Text size="sm" fw={600} w={52} c={late ? 'red' : undefined} style={{ flexShrink: 0 }}>
          {shortDate(p.due_date)}
        </Text>
        <div style={{ minWidth: 0 }}>
          <Group gap={6}>
            <Text size="sm" fw={500} style={{ overflowWrap: 'anywhere' }}>
              {p.payee}
            </Text>
            {p.is_estimate && (
              <Badge size="xs" variant="light" color="orange" tt="none">
                Estimate
              </Badge>
            )}
            {late ? (
              <Badge size="xs" variant="light" color="red" tt="none">
                {late} day{late === 1 ? '' : 's'} overdue
              </Badge>
            ) : null}
          </Group>
          {area && (
            <Text size="xs" c="rose.6">
              {area}
            </Text>
          )}
          {p.note && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {p.note}
            </Text>
          )}
        </div>
      </Group>
      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0, paddingLeft: 60 }} align="center">
        <div style={{ textAlign: 'right' }}>
          <Text size="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
            {formatInr(p.amount)}
          </Text>
          {whole !== undefined && whole - p.amount > 0.005 && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              of {formatInr(whole)}
            </Text>
          )}
        </div>
        {isUnlocked && (
          <>
            <Button size="compact-xs" variant="light" onClick={() => onPaid(p)}>
              Mark paid
            </Button>
            <Button size="compact-xs" variant="subtle" onClick={() => onEdit(p)}>
              Edit
            </Button>
          </>
        )}
      </Group>
    </Group>
  );
}

function Verdict({ m }: { m: MonthRow }) {
  if (m.balance === null) return null;
  return m.balance >= 0 ? (
    <Badge variant="light" color="teal" tt="none">
      Covered · {formatInr(m.balance)} left
    </Badge>
  ) : (
    <Badge variant="light" color="red" tt="none">
      Short by {formatInr(Math.abs(m.balance))}
    </Badge>
  );
}

// Step 2: month by month. For each month, what falls due, what was paid, and the funds left after paying everything up
// to then, with the payments listed underneath so the number can be traced to the payments behind it.
export function MonthPlan({
  plan,
  side,
  schedule,
  topics,
  today,
  isUnlocked,
  onAdd,
  onPaid,
  onEdit,
}: {
  plan: Plan;
  side: Side;
  schedule: Scheduled[];
  topics: TopicRef[];
  today: string;
  isUnlocked: boolean;
  onAdd: () => void;
  onPaid: (p: Scheduled) => void;
  onEdit: (p: Scheduled) => void;
}) {
  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        {isUnlocked && (
          <Group justify="flex-end">
            <Button size="compact-md" onClick={onAdd}>
              Add a payment due
            </Button>
          </Group>
        )}

        {plan.overdue.length > 0 && (
          <>
            <Stack gap="xs">
              <Group justify="space-between" gap="sm">
                <Text fw={700} c="red">
                  Overdue
                </Text>
                <Text fw={700} c="red">
                  {formatInr(plan.overdueTotal)}
                </Text>
              </Group>
              {plan.overdue.map((p) => (
                <PaymentLine key={p.id} p={p} whole={side === 'both' ? undefined : schedule.find((x) => x.id === p.id)?.amount} topics={topics} late={daysBetween(p.due_date, today)} isUnlocked={isUnlocked} onPaid={onPaid} onEdit={onEdit} />
              ))}
            </Stack>
            <Divider />
          </>
        )}

        {plan.months.map((m, i) => (
          <div key={m.key}>
            {i > 0 && <Divider mb="md" />}
            <Group justify="space-between" align="center" gap="sm" mb={m.items.length > 0 ? 'xs' : 0}>
              <Group gap="xs">
                <Text fw={700}>{m.label}</Text>
                {m.isCurrent && (
                  <Badge size="xs" variant="light" color="rose">
                    This month
                  </Badge>
                )}
              </Group>
              <Group gap="sm">
                <Text size="sm" c={m.due > 0 ? undefined : 'dimmed'}>
                  {m.due > 0 ? (
                    <>
                      <b>{formatInr(m.due)}</b> due
                    </>
                  ) : (
                    'Nothing due'
                  )}
                  {m.paid > 0 && (
                    <Text span size="sm" c="dimmed">
                      {' '}
                      · {formatInr(m.paid)} paid
                    </Text>
                  )}
                </Text>
                <Verdict m={m} />
              </Group>
            </Group>
            {m.items.length > 0 && (
              <Stack gap="xs">
                {m.items.map((p) => (
                  <PaymentLine key={p.id} p={p} whole={side === 'both' ? undefined : schedule.find((x) => x.id === p.id)?.amount} topics={topics} isUnlocked={isUnlocked} onPaid={onPaid} onEdit={onEdit} />
                ))}
              </Stack>
            )}
          </div>
        ))}
      </Stack>
    </Paper>
  );
}
