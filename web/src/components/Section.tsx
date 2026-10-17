import { Badge, Group, Stack, Text, Title } from '@mantine/core';

// One step of a page: a number, a title and a line saying what it is for, so the page reads top to bottom.
export function Section({ step, title, hint, children }: { step: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap" align="center">
        <Badge circle size="xl" variant="filled" color="rose">
          {step}
        </Badge>
        <div>
          <Title order={3} lh={1.2}>
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        </div>
      </Group>
      {children}
    </Stack>
  );
}
