import { Link } from 'react-router-dom';
import { Anchor, Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { useLiveData } from '../hooks/useLiveData';
import { LoadError } from '../components/LoadError';
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

const NO_VENDORS: VendorRow[] = [];

async function loadVendors() {
  return rowsOf<VendorRow>(
    await supabase.from('planning_items').select('id, title, detail, status, amount, amount_kind, metadata, topic:topics(key, label)').eq('type', 'vendor').order('title')
  );
}

export function Vendors() {
  const { data: rows, loadError, reload } = useLiveData({ tables: ['planning_items'], load: loadVendors, initial: NO_VENDORS });

  const groups = rows.reduce<Record<string, { label: string; rows: VendorRow[] }>>((acc, r) => {
    (acc[r.topic.key] ??= { label: r.topic.label, rows: [] }).rows.push(r);
    return acc;
  }, {});

  return (
    <Stack gap="xl">
      <LoadError error={loadError} what="The vendors" onRetry={() => void reload()} />
      <Title order={2}>Vendors</Title>
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
      {rows.length === 0 && <Text c="dimmed">No vendors added yet.</Text>}
    </Stack>
  );
}
