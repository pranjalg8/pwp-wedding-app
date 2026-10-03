import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';

type TopicWithCounts = Topic & { open: number; decided: number; done: number; total: number };

export function Dashboard() {
  const [topics, setTopics] = useState<TopicWithCounts[]>([]);

  async function load() {
    const [{ data: topicsData }, { data: itemsData }] = await Promise.all([
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('planning_items').select('topic_id, status'),
    ]);

    const counts = new Map<string, { open: number; decided: number; done: number; total: number }>();
    for (const item of (itemsData ?? []) as Pick<PlanningItem, 'topic_id' | 'status'>[]) {
      const c = counts.get(item.topic_id) ?? { open: 0, decided: 0, done: 0, total: 0 };
      c.total += 1;
      if (item.status === 'open' || item.status === 'in_progress') c.open += 1;
      if (item.status === 'decided') c.decided += 1;
      if (item.status === 'done') c.done += 1;
      counts.set(item.topic_id, c);
    }

    setTopics(
      ((topicsData ?? []) as Topic[]).map((t) => ({
        ...t,
        ...(counts.get(t.id) ?? { open: 0, decided: 0, done: 0, total: 0 }),
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

  return (
    <>
      <Title order={2} mb="lg">
        Wedding Planning Dashboard
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {topics.map((t) => (
          <Card key={t.id} component={Link} to={`/topics/${t.key}`} withBorder shadow="sm" radius="md" p="lg">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{t.label}</Text>
              {t.open > 0 && <Badge color="orange">{t.open} open</Badge>}
            </Group>
            <Text size="sm" c="dimmed">
              {t.total === 0
                ? 'No items yet'
                : `${t.decided + t.done} of ${t.total} decided/done`}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </>
  );
}
