import type { ReactNode } from 'react';
import { Box, Paper, Stack, Text } from '@mantine/core';

export type EmptyStateProps = {
  /** A single emoji shown large above the title. */
  emoji?: string;
  /** A short line, e.g. "No tasks yet". */
  title: ReactNode;
  /** One sentence on what to do next. */
  hint?: ReactNode;
  /** Optional button (or any node) under the hint. */
  action?: ReactNode;
  /** Less padding, for use inside cards. */
  compact?: boolean;
};

// What a list or section shows when there is nothing in it yet.
export function EmptyState({ emoji = '🌸', title, hint, action, compact }: EmptyStateProps) {
  return (
    <Paper className="empty-state" shadow="none" p={compact ? 'md' : 'xl'} ta="center">
      <Stack gap={6} align="center">
        <Text fz={compact ? 28 : 40} lh={1} aria-hidden>
          {emoji}
        </Text>
        <Text fw={600}>{title}</Text>
        {hint && (
          <Text size="sm" c="dimmed" maw={420}>
            {hint}
          </Text>
        )}
        {action && <Box mt="xs">{action}</Box>}
      </Stack>
    </Paper>
  );
}
