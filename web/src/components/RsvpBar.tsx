import { Box, Group, Text } from '@mantine/core';
import { INVITE_COLOR, INVITE_LABEL, INVITE_ORDER, invitedPeople, type RsvpTotals } from '../lib/rsvp';

// One stacked bar of people by answer, with the numbers written out underneath (colour is never the only cue).
export function RsvpBar({ totals, compact = false }: { totals: RsvpTotals | undefined; compact?: boolean }) {
  const total = totals ? invitedPeople(totals) : 0;
  if (!totals || total === 0) {
    return (
      <Text size="xs" c="dimmed">
        No one invited yet
      </Text>
    );
  }
  return (
    <Box>
      <Group gap={2} wrap="nowrap" role="img" aria-label={INVITE_ORDER.map((s) => `${totals[s]} ${INVITE_LABEL[s]}`).join(', ')}>
        {INVITE_ORDER.filter((s) => totals[s] > 0).map((s) => (
          <Box
            key={s}
            h={compact ? 6 : 8}
            style={{
              flex: totals[s],
              borderRadius: 3,
              background: `var(--mantine-color-${INVITE_COLOR[s]}-${s === 'invited' ? 4 : 6})`,
              opacity: s === 'invited' ? 0.55 : 1,
            }}
          />
        ))}
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {INVITE_ORDER.filter((s) => totals[s] > 0)
          .map((s) => `${totals[s]} ${INVITE_LABEL[s].toLowerCase()}`)
          .join(' · ')}
        {` · ${total} invited`}
      </Text>
    </Box>
  );
}
