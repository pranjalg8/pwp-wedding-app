import { Box, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, type HouseholdStatus, type HouseholdView, type StatusCounts } from '../lib/guestStatus';

// Step 1: where we stand. One bar of households by status, and each status is a button that shows those
// households in the list below, so the summary and the list are one flow instead of two separate things.
export function GuestSummary({
  counts,
  households,
  people,
  view,
  onView,
}: {
  counts: StatusCounts;
  households: number;
  people: number;
  view: HouseholdView;
  onView: (v: HouseholdStatus) => void;
}) {
  const shade = (s: HouseholdStatus) => `var(--mantine-color-${STATUS_COLOR[s]}-${s === 'not_invited' ? 3 : 6})`;
  const todo = counts.not_invited.households + counts.waiting.households;

  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="baseline" gap="xs">
          <Group gap="xs" align="baseline">
            <Text fz={34} fw={700} lh={1}>
              {people}
            </Text>
            <Text c="dimmed">people in {households} households</Text>
          </Group>
          <Text size="sm" c={todo > 0 ? undefined : 'teal'} fw={500}>
            {todo === 0
              ? 'Everyone has been invited and has replied.'
              : `${counts.not_invited.households > 0 ? `${counts.not_invited.households} not invited yet` : ''}${
                  counts.not_invited.households > 0 && counts.waiting.households > 0 ? ' · ' : ''
                }${counts.waiting.households > 0 ? `${counts.waiting.households} waiting for a reply` : ''}`}
          </Text>
        </Group>

        <Group gap={2} wrap="nowrap" role="img" aria-label={STATUS_ORDER.map((s) => `${counts[s].households} ${STATUS_LABEL[s].toLowerCase()}`).join(', ')}>
          {STATUS_ORDER.filter((s) => counts[s].households > 0).map((s) => (
            <Box key={s} h={12} style={{ flex: counts[s].households, borderRadius: 4, background: shade(s), opacity: s === 'not_invited' ? 0.6 : 1 }} />
          ))}
        </Group>

        <Group gap="xs">
          {STATUS_ORDER.map((s) => {
            const on = view === s;
            return (
              <UnstyledButton
                key={s}
                onClick={() => onView(s)}
                disabled={counts[s].households === 0}
                aria-pressed={on}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${on ? shade(s) : 'var(--mantine-color-default-border)'}`,
                  background: on ? `var(--mantine-color-${STATUS_COLOR[s]}-light)` : undefined,
                  opacity: counts[s].households === 0 ? 0.45 : 1,
                }}
              >
                <Box w={10} h={10} style={{ borderRadius: '50%', background: shade(s) }} />
                <Text size="sm" fw={500}>
                  {STATUS_LABEL[s]}
                </Text>
                <Text size="sm" c="dimmed" title={`${counts[s].people} people`}>
                  {counts[s].households}
                </Text>
              </UnstyledButton>
            );
          })}
        </Group>
      </Stack>
    </Paper>
  );
}
