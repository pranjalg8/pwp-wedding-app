import { useEffect, useRef } from 'react';
import { Badge, Card, Stack, Text, Title } from '@mantine/core';
import { RELEASES, markUpdatesSeen, useUnseenUpdates, type ReleaseKind } from '../hooks/useUpdates';

const KIND: Record<ReleaseKind, { label: string; color: string }> = {
  new: { label: 'New', color: 'teal' },
  improved: { label: 'Improved', color: 'blue' },
  fix: { label: 'Fixed', color: 'orange' },
};

export function Updates() {
  const unseen = useUnseenUpdates();
  // Remember which versions were new when the page opened, then mark them seen.
  const newOnOpen = useRef(unseen);
  useEffect(() => {
    markUpdatesSeen();
  }, []);

  return (
    <Stack gap="md" maw={760} mx="auto">
      <Title order={2}>What's new</Title>
      <Text size="sm" c="dimmed">
        Every version of the planner, newest first. The same list is in the CHANGELOG on GitHub.
      </Text>
      {RELEASES.map((r, i) => (
        <Card key={r.version} withBorder p="lg">
          <Stack gap="xs">
            <div>
              <Text fw={700} fz="lg">
                {r.title}{' '}
                {i < newOnOpen.current && <Badge color="rose" size="sm" ml={4}>New</Badge>}
              </Text>
              <Text size="xs" c="dimmed">
                Version {r.version} · {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </div>
            <Stack gap={6}>
              {r.items.map((item, j) => (
                <Text key={j} size="sm">
                  <Badge color={KIND[item.kind].color} variant="light" size="xs" mr={8}>
                    {KIND[item.kind].label}
                  </Badge>
                  {item.text}
                </Text>
              ))}
            </Stack>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
