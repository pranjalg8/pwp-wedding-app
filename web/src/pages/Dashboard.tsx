import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePendingSuggestions } from '../hooks/usePendingSuggestions';
import { Badge, Box, Card, Group, Paper, RingProgress, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { TOPIC_EMOJI, formatInr, formatInrCompact, summarizeMoney } from '../lib/topicMeta';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { daysUntil, formatRange } from '../lib/planFacts';

type MoneyRow = Pick<PlanningItem, 'id' | 'title' | 'topic_id' | 'status' | 'amount' | 'amount_kind' | 'owner' | 'due_date'>;

const OWNER_LABEL = { both: 'Both of us', pranjal: 'Pranjal', paridhi: 'Paridhi' } as const;

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

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function Dashboard() {
  const pendingSuggestions = usePendingSuggestions();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [items, setItems] = useState<MoneyRow[]>([]);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  async function load() {
    const [{ data: topicsData }, { data: itemsData }, { data: synced }, { data: latest }] = await Promise.all([
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('planning_items').select('id, title, topic_id, status, amount, amount_kind, owner, due_date'),
      supabase.from('sync_status').select('last_run_at').limit(1),
      supabase.from('messages').select('timestamp').order('timestamp', { ascending: false }).limit(1),
    ]);
    setTopics((topicsData ?? []) as Topic[]);
    setItems((itemsData ?? []) as MoneyRow[]);
    setLastSynced(synced?.[0]?.last_run_at ?? null);
    setLastMessage(latest?.[0]?.timestamp ?? null);
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

  const total = items.length;
  const settled = items.filter((i) => i.status === 'decided' || i.status === 'done').length;
  const open = total - settled;
  const money = summarizeMoney(items);
  const { dates } = usePlanFacts();
  const days = daysUntil(dates.wedding.start);
  const openAreas = new Set(items.filter((i) => i.status === 'open' || i.status === 'in_progress').map((i) => i.topic_id)).size;

  const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD, not UTC
  const topicLabel = (id: string) => topics.find((t) => t.id === id)?.label ?? '';
  const dueItems = items
    .filter((i) => i.due_date && i.status !== 'done' && i.status !== 'decided')
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))
    .slice(0, 8);

  return (
    <Stack gap="lg">
      <Box className="hero" c="white" p={{ base: 'lg', sm: 'xl' }} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
        <Text size="sm" fw={600} style={{ letterSpacing: 1, opacity: 0.9 }} tt="uppercase">
          {formatRange(dates.wedding, { full: true })}
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
            : `${open} thing${open === 1 ? '' : 's'} still open across ${openAreas} area${openAreas === 1 ? '' : 's'}.`}
        </Text>
      </Box>

      {pendingSuggestions > 0 && (
        <Paper withBorder p="md" component={Link} to="/activity/suggestions" style={{ textDecoration: 'none', color: 'inherit', borderLeft: '4px solid var(--mantine-color-rose-5)' }}>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={700}>
                {pendingSuggestions} suggestion{pendingSuggestions === 1 ? '' : 's'} to review
              </Text>
              <Text size="sm" c="dimmed">
                New chat activity was turned into proposed changes. Nothing is applied until you accept it.
              </Text>
            </div>
            <Text c="rose.6" fw={600}>
              Review →
            </Text>
          </Group>
        </Paper>
      )}

      {dueItems.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={700} mb="xs">Our due items</Text>
          <Stack gap="xs">
            {dueItems.map((i) => {
              const overdue = (i.due_date as string) < today;
              const d = Math.round((new Date(i.due_date as string).getTime() - new Date(today).getTime()) / 86_400_000);
              return (
                <Group key={i.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <div>
                    <Text size="sm" fw={500}>{i.title}</Text>
                    <Text size="xs" c="dimmed">
                      {topicLabel(i.topic_id)}
                      {i.owner ? ` · ${OWNER_LABEL[i.owner]}` : ''}
                    </Text>
                  </div>
                  <Badge color={overdue ? 'red' : d <= 7 ? 'orange' : 'gray'} variant="light" style={{ flexShrink: 0 }}>
                    {overdue ? `${Math.abs(d)} d overdue` : d === 0 ? 'Today' : `in ${d} d`}
                  </Badge>
                </Group>
              );
            })}
          </Stack>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <Stat
          label="Progress"
          value={total ? `${Math.round((settled / total) * 100)}%` : '—'}
          hint={`${settled} of ${total} items settled`}
        />
        <Stat label="Paid so far" value={formatInr(money.paid)} hint="Money already spent" />
        <Stat label="Planned & chosen" value={formatInr(money.planned)} hint="Budgets and quotes you picked" />
        <Stat
          label="Open quotes"
          value={
            money.openCount === 0
              ? '—'
              : money.openLow === money.openHigh
                ? formatInrCompact(money.openLow)
                : `${formatInrCompact(money.openLow)}–${formatInrCompact(money.openHigh)}`
          }
          hint={money.openCount === 0 ? 'None being compared' : `${money.openCount} alternative${money.openCount === 1 ? '' : 's'}, not added up`}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
        {topics.map((t) => {
          const mine = items.filter((i) => i.topic_id === t.id);
          const done = mine.filter((i) => i.status === 'decided' || i.status === 'done').length;
          const openN = mine.length - done;
          const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
          const m = summarizeMoney(mine);
          const fixed = m.paid + m.planned;
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
                    {mine.length === 0 ? 'Nothing yet' : `${done} of ${mine.length} settled`}
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
                {openN > 0 ? (
                  <Badge color="orange" variant="light">
                    {openN} open
                  </Badge>
                ) : (
                  <Badge color="teal" variant="light">
                    All settled
                  </Badge>
                )}
                {fixed > 0 && (
                  <Text size="sm" fw={600}>
                    {formatInr(fixed)}
                  </Text>
                )}
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      <Text size="xs" c="dimmed" ta="center">
        {lastSynced
          ? `Chat data synced ${timeAgo(lastSynced)}${lastMessage ? ` · latest message ${new Date(lastMessage).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`
          : 'No chat data synced yet'}
      </Text>
    </Stack>
  );
}
