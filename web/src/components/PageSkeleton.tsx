import { Alert, Button, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';

// Placeholder while a page's first load is in flight, so it never flashes "nothing here" before the data lands.
export function PageSkeleton({ cards = 6, title = false }: { cards?: number; title?: boolean }) {
  return (
    <Stack gap="lg" aria-busy="true" aria-label="Loading">
      {title && <Skeleton h={32} w="40%" radius="md" />}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} h={110} radius="lg" />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// A failed load must not look like an empty page: say so and offer to try again.
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert color="red" variant="light" title="Could not load">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
          {message}
        </Text>
        {onRetry && (
          <Button size="xs" variant="light" color="red" onClick={onRetry} style={{ flexShrink: 0 }}>
            Retry
          </Button>
        )}
      </Group>
    </Alert>
  );
}
