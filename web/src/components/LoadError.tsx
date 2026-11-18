import { Alert, Button, Group, Text } from '@mantine/core';

// Says plainly that data could not be loaded, so an empty or old page is not mistaken for the real picture.
export function LoadError({ error, what, onRetry }: { error: string | null | undefined; what: string; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <Alert color="red" variant="light" title={`${what} could not be loaded`}>
      <Group justify="space-between" gap="sm">
        <Text size="sm">What you see may be out of date or incomplete. Check your connection and try again.</Text>
        {onRetry && (
          <Button size="compact-sm" variant="light" color="red" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Group>
    </Alert>
  );
}
