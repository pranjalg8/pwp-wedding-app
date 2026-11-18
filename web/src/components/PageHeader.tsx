import type { ReactNode } from 'react';
import { Box, Group, Text, Title, type MantineSpacing, type StyleProp } from '@mantine/core';

export type PageHeaderProps = {
  /** The page title, shown in Playfair. */
  title: ReactNode;
  /** One short dimmed line under the title. */
  subtitle?: ReactNode;
  /** Buttons or controls on the right (they wrap under the title on narrow screens). */
  action?: ReactNode;
  /** Something before the title, such as an emoji. */
  icon?: ReactNode;
  /** Space below the header. Defaults to 0 because pages already space their children with a Stack. */
  mb?: StyleProp<MantineSpacing>;
  /** Show the small rose-to-marigold rule under the title. On by default. */
  ornament?: boolean;
};

// The same title block at the top of every page.
export function PageHeader({ title, subtitle, action, icon, mb = 0, ornament = true }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" gap="sm" mb={mb} wrap="wrap">
      <Box style={{ minWidth: 0, flex: '1 1 260px' }}>
        <Group gap="xs" wrap="nowrap" align="center">
          {icon && (
            <Text fz={28} lh={1} aria-hidden>
              {icon}
            </Text>
          )}
          <Title order={2} style={{ overflowWrap: 'anywhere' }}>
            {title}
          </Title>
        </Group>
        {ornament && <div className="page-ornament" aria-hidden />}
        {subtitle && (
          <Text size="sm" c="dimmed" mt={6} maw={680}>
            {subtitle}
          </Text>
        )}
      </Box>
      {action && <Box style={{ flexShrink: 0 }}>{action}</Box>}
    </Group>
  );
}
