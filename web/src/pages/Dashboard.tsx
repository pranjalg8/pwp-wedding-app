import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Box, Card, Group, Paper, RingProgress, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { TOPIC_EMOJI, daysUntilWedding, formatInr } from '../lib/topicMeta';

type Counts = {
  open: number;
  settled: number;
  total: number;
  committed: number;
  considering: number;
};
type TopicWithCounts = Topic & Counts;

const EMPTY_COUNTS: Counts = { open: 0, settled: 0, total: 0, committed: 0, considering: 0 };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper withBorder p="md">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text fz={26} fw={700} mt={2}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

export function Dashboard() {
  const [topics, setTopics] = useState<TopicWithCounts[]>([]);

  async function load() {
    const [{ data: topicsData }, { data: itemsData }] = await Promise.all([
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('planning_items').select('topic_id, status, amount'),
    ]);

    const counts = new Map<string, Counts>();
    for (const item of (itemsData ?? []) as Pick<PlanningItem, 'topic_id' | 'status' | 'amount'>[]) {
      const c = counts.get(item.topic_id) ?? { ...EMPTY_COUNTS };
      const settled = item.status === 'decided' || item.status === 'done';
      c.total += 1;
      if (settled) c.settled += 1;
      else c.open += 1;
      if (item.amount) {
        if (settled) c.committed += item.amount;
        else c.considering += item.amount;
      }
      counts.set(item.topic_id, c);
    }

    setTopics(
      ((topicsData ?? []) as Topic[]).map((t) => ({
        ...t,
        ...(counts.get(t.id) ?? EMPTY_COUNTS),
      }))
    );
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('planning_items_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const total = topics.reduce((s, t) => s + t.total, 0);
  const settled = topics.reduce((s, t) => s + t.settled, 0);
  const open = topics.reduce((s, t) => s + t.open, 0);
  const committed = topics.reduce((s, t) => s + t.committed, 0);
  const considering = topics.reduce((s, t) => s + t.considering, 0);
  const days = daysUntilWedding();

  return (
    <Stack gap="lg">
      <Box className="hero" c="white" p={{ base: 'lg', sm: 'xl' }} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
        <Text size="sm" fw={600} style={{ letterSpacing: 1, opacity: 0.9 }} tt="uppercase">
          14–15 February 2027
        </Text>
        <Group align="baseline" gap="sm" mt={4}>
          <Title order={1} c="white" fz={{ base: 48, sm: 64 }} lh={1}>
            {days}
          </Title>
          <Text fz={{ base: 'lg', sm: 'xl' }} fw={500}>
            days to go
          </Text>
        </Group>
        <Text mt="sm" style={{ opacity: 0.95 }}>
          {open === 0
            ? 'Everything is decided. Time to celebrate.'
            : `${open} thing${open === 1 ? '' : 's'} still open across ${topics.filter((t) => t.open > 0).length} areas.`}
        </Text>
      </Box>

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        <Stat label="Progress" value={total ? `${Math.round((settled / total) * 100)}%` : '—'} hint={`${settled} of ${total} items settled`} />
        <Stat label="Committed" value={formatInr(committed)} hint="Decided or done" />
        <Stat label="Still comparing" value={formatInr(considering)} hint="Open quotes, not spent" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
        {topics.map((t) => {
          const pct = t.total ? Math.round((t.settled / t.total) * 100) : 0;
          return (
            <Card
              key={t.id}
              component={Link}
              to={`/topics/${t.key}`}
              withBorder
              p="lg"
              className="topic-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={4}>
                  <Text fz={28} lh={1}>
                    {TOPIC_EMOJI[t.key] ?? '✨'}
                  </Text>
                  <Text fw={600} mt={6}>
                    {t.label}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t.total === 0 ? 'Nothing yet' : `${t.settled} of ${t.total} settled`}
                  </Text>
                </Stack>
                <RingProgress
                  size={64}
                  thickness={6}
                  roundCaps
                  sections={[{ value: pct, color: pct === 100 ? 'teal' : 'rose' }]}
                  label={
                    <Text size="xs" ta="center" fw={600}>
                      {pct}%
                    </Text>
                  }
                />
              </Group>
              <Group justify="space-between" mt="sm" wrap="nowrap">
                {t.open > 0 ? (
                  <Badge color="orange" variant="light">
                    {t.open} open
                  </Badge>
                ) : (
                  <Badge color="teal" variant="light">
                    All settled
                  </Badge>
                )}
                {t.committed > 0 && (
                  <Text size="sm" fw={600}>
                    {formatInr(t.committed)}
                  </Text>
                )}
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
