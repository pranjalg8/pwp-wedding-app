import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Badge, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';

const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  in_progress: 'blue',
  decided: 'teal',
  done: 'gray',
};

type VendorRow = Pick<PlanningItem, 'id' | 'title' | 'detail' | 'status' | 'amount' | 'metadata'> & {
  topic: Pick<Topic, 'key' | 'label'>;
};

function metaString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value ? value : null;
}

export function Vendors() {
  const [rows, setRows] = useState<VendorRow[]>([]);

  async function load() {
    const { data } = await supabase
      .from('planning_items')
      .select('id, title, detail, status, amount, metadata, topic:topics(key, label)')
      .eq('type', 'vendor')
      .order('title');
    setRows((data ?? []) as unknown as VendorRow[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('planning_items_vendors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items', filter: 'type=eq.vendor' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Stack>
      <Title order={2}>Vendors</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {rows.map((r) => {
          const phone = metaString(r.metadata, 'phone');
          const email = metaString(r.metadata, 'email');
          const contactPerson = metaString(r.metadata, 'contact_person');
          return (
            <Card key={r.id} withBorder shadow="sm" radius="md" p="lg">
              <Group justify="space-between" mb="xs">
                <Text fw={600}>{r.title}</Text>
                <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
              </Group>
              <Text
                component={Link}
                to={`/topics/${r.topic.key}`}
                size="sm"
                c="dimmed"
                mb="xs"
                style={{ display: 'block' }}
              >
                {r.topic.label}
              </Text>
              {contactPerson && <Text size="sm">{contactPerson}</Text>}
              {phone && (
                <Text size="sm">
                  <Anchor href={`tel:${phone}`}>{phone}</Anchor>
                </Text>
              )}
              {email && (
                <Text size="sm">
                  <Anchor href={`mailto:${email}`}>{email}</Anchor>
                </Text>
              )}
              {r.detail && (
                <Text size="sm" c="dimmed" mt="xs">
                  {r.detail}
                </Text>
              )}
              {r.amount != null && (
                <Text size="sm" fw={500} mt="xs">
                  ₹{r.amount.toLocaleString('en-IN')}
                </Text>
              )}
            </Card>
          );
        })}
        {rows.length === 0 && <Text c="dimmed">No vendors added yet.</Text>}
      </SimpleGrid>
    </Stack>
  );
}
