import { useState } from 'react';
import { useRealtime } from '../hooks/useRealtime';
import { Link } from 'react-router-dom';
import { Anchor, Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { PageSkeleton } from '../components/PageSkeleton';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { whatsappUrl } from '../lib/whatsapp';
import { VendorTotals } from '../components/VendorTotals';

const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  in_progress: 'blue',
  decided: 'teal',
  done: 'gray',
};

type VendorRow = Pick<PlanningItem, 'id' | 'title' | 'detail' | 'status' | 'amount' | 'amount_kind' | 'metadata'> & {
  topic: Pick<Topic, 'key' | 'label'>;
};

function metaString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value ? value : null;
}

const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', decided: 'Chosen', done: 'Done' };
const KIND_LABEL: Record<string, string> = { quote: 'Quote', planned: 'Planned', paid: 'Paid' };

export function Vendors() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('planning_items')
      .select('id, title, detail, status, amount, amount_kind, metadata, topic:topics(key, label)')
      .eq('type', 'vendor')
      .order('title');
    setRows((data ?? []) as unknown as VendorRow[]);
    setLoaded(true);
  }

  useRealtime(['planning_items'], load, { immediate: true });

  const groups = rows.reduce<Record<string, { label: string; rows: VendorRow[] }>>((acc, r) => {
    (acc[r.topic.key] ??= { label: r.topic.label, rows: [] }).rows.push(r);
    return acc;
  }, {});

  return (
    <Stack gap="xl">
      <PageHeader title="Vendors" />
      <VendorTotals />
      {Object.entries(groups).map(([key, g]) => (
      <Stack key={key} gap="sm">
      <Text fw={700} c="dimmed" tt="uppercase" size="sm">{g.label}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {g.rows.map((r) => {
          const phone = metaString(r.metadata, 'phone');
          const email = metaString(r.metadata, 'email');
          const contactPerson = metaString(r.metadata, 'contact_person');
          return (
            <Card key={r.id} withBorder shadow="sm" radius="md" p="lg">
              <Group justify="space-between" mb="xs">
                <Text fw={600}>{r.title}</Text>
                <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
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
              {!phone && !email && (
                <Text size="xs" c="dimmed" fs="italic">No contact details yet. Add them from the {r.topic.label} page.</Text>
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
                  {r.amount_kind ? `${KIND_LABEL[r.amount_kind]}: ` : ''}₹{r.amount.toLocaleString('en-IN')}
                </Text>
              )}
              {phone && whatsappUrl(phone) && (
                <Button
                  component="a"
                  href={whatsappUrl(phone) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="green"
                  variant="light"
                  size="xs"
                  mt="sm"
                >
                  Open WhatsApp chat
                </Button>
              )}
            </Card>
          );
        })}
      </SimpleGrid>
      </Stack>
      ))}
      {!loaded && <PageSkeleton cards={3} />}
      {loaded && rows.length === 0 && (
        <EmptyState
          emoji="🤝"
          title="No vendors added yet"
          hint="Add a vendor as an item on an area's page and it will show up here with its contact details."
          action={
            <Button component={Link} to="/areas" variant="light">
              Go to areas
            </Button>
          }
        />
      )}
    </Stack>
  );
}
