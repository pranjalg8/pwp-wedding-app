import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Box, Container, Group, Loader, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { fetchGuestPageWithSession, redeemLink } from '../lib/core/api';
import type { GuestPage } from '../lib/core/guest';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/topicMeta';

type State =
  | { phase: 'loading' }
  | { phase: 'unavailable' }
  | { phase: 'ready'; page: GuestPage; linkExpiresAt: string };

// Opened from a share link: #/share/<token>. The token lives in the URL fragment so it is never sent to a
// server. Every redeem failure looks the same on purpose (the platform returns one generic 404).
export function ShareViewer() {
  const { token } = useParams();
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!token) throw new Error('no token');
        const session = await redeemLink(token);
        const page = await fetchGuestPageWithSession(session.sessionToken);
        if (active) setState({ phase: 'ready', page, linkExpiresAt: session.linkExpiresAt });
      } catch {
        if (active) setState({ phase: 'unavailable' });
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (state.phase === 'loading') {
    return (
      <Group justify="center" mt={120}>
        <Loader color="rose" />
      </Group>
    );
  }

  if (state.phase === 'unavailable') {
    return (
      <Container size="xs" mt={100}>
        <Paper withBorder p="xl" ta="center">
          <Title order={3}>This link isn't available</Title>
          <Text c="dimmed" mt="xs">
            It may have expired or been withdrawn. Please ask for a new one.
          </Text>
        </Paper>
      </Container>
    );
  }

  const { page, linkExpiresAt } = state;
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Box className="hero" c="white" p={{ base: 'lg', sm: 'xl' }} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
          <Title order={1} c="white" fz={{ base: 30, sm: 40 }}>
            {page.title}
          </Title>
          {page.intro && (
            <Text mt="xs" style={{ whiteSpace: 'pre-wrap', opacity: 0.95 }}>
              {page.intro}
            </Text>
          )}
        </Box>

        {page.dates.length > 0 && (
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
            {page.dates.map((d) => (
              <Paper key={d.label} withBorder p="md">
                <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
                  {d.label}
                </Text>
                <Text fw={700} fz="lg">
                  {d.text}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {page.sections.map((s) => (
          <Paper key={s.heading} withBorder p="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
              <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                {s.heading}
              </Text>
              <Badge color={STATUS_COLOR[s.status] ?? 'gray'} variant="light" style={{ flexShrink: 0 }}>
                {STATUS_LABEL[s.status] ?? s.status}
              </Badge>
            </Group>
            {s.chosen.length > 0 && (
              <Text size="sm" c="teal" fw={600} mt={4}>
                {s.chosen.join(', ')}
              </Text>
            )}
            {s.note && (
              <Text size="sm" mt={6} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {s.note}
              </Text>
            )}
          </Paper>
        ))}

        <Text size="xs" c="dimmed" ta="center">
          Shared by Pranjal &amp; Paridhi · last updated{' '}
          {page.publishedAt ? new Date(page.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          {' · '}this link works until{' '}
          {new Date(linkExpiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </Text>
      </Stack>
    </Container>
  );
}
