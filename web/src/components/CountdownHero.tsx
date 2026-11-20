import type { ReactNode } from 'react';
import { Box, Group, Text, Title } from '@mantine/core';

export type CountdownHeroProps = {
  /** Small uppercase line above the number, usually the wedding dates. */
  eyebrow: ReactNode;
  /** Days left; negative values show as 0. */
  days: number;
  /** One line under the number. */
  note?: ReactNode;
  /** Tighter padding and a fixed number size (used on shared links). */
  compact?: boolean;
};

// The rose-to-marigold "N days to go" banner.
export function CountdownHero({ eyebrow, days, note, compact }: CountdownHeroProps) {
  return (
    <Box className="hero" c="white" p={compact ? 'lg' : { base: 'lg', sm: 'xl' }} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
      <Text size="sm" fw={600} tt="uppercase" style={{ letterSpacing: 1, opacity: 0.9 }}>
        {eyebrow}
      </Text>
      <Group align="baseline" gap="sm" mt={4}>
        <Title order={1} c="white" fz={compact ? 56 : { base: 48, sm: 64 }} lh={1}>
          {Math.max(0, days)}
        </Title>
        <Text fz={compact ? 'xl' : { base: 'lg', sm: 'xl' }} fw={500}>
          days to go
        </Text>
      </Group>
      {note && (
        <Text mt="sm" style={{ opacity: 0.95 }}>
          {note}
        </Text>
      )}
    </Box>
  );
}
