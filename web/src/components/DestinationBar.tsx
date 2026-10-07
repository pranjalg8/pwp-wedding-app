import { Badge, Button, Group, Text } from '@mantine/core';
import { useDestination } from '../hooks/useDestination';

// Shown only to people who have access to alternative destinations. Tells you which destination the
// tabs below are showing and lets you flip it.
export function DestinationBar() {
  const { hasAlternatives, ready, currentLabel, nextLabel, flip } = useDestination();
  if (!hasAlternatives || !ready) return null;
  return (
    <Group gap="xs" wrap="wrap">
      <Text size="sm" c="dimmed">
        Showing
      </Text>
      <Badge size="lg" color="rose" variant="light">
        {currentLabel}
      </Badge>
      <Button variant="subtle" color="gray" size="xs" onClick={flip}>
        🔄 Flip to {nextLabel}
      </Button>
    </Group>
  );
}
