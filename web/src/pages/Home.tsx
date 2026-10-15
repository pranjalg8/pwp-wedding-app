import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Badge, Box, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { supabase, type PlanningItem, type Task } from '../lib/supabase';
import { OWNER_LABEL, TOPIC_EMOJI, daysToDue, dueBadge, formatInr, formatInrCompact, summarizeMoney } from '../lib/topicMeta';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { usePendingSuggestions } from '../hooks/usePendingSuggestions';
import { useProfile } from '../hooks/useProfile';
import { daysUntil, formatRange } from '../lib/planFacts';
import { FunctionCard, tintFor, type OutfitOption, type WeddingFunction } from '../components/FunctionCard';

type TaskRow = Pick<Task, 'id' | 'title' | 'topic_id' | 'owner' | 'priority' | 'due_date' | 'status' | 'sort_order'>;
type OptionRow = { task_id: string; name: string; status: string };
type MoneyRow = Pick<PlanningItem, 'status' | 'amount' | 'amount_kind'>;
type PaymentRow = { amount: number | string; verification: string };

const isDone = (t: TaskRow) => t.status === 'done' || t.status === 'decided';
const STALE_SYNC_DAYS = 3;

function Panel({ title, to, linkLabel = 'See all', children }: { title: string; to?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="md" h="100%">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Text fw={700}>{title}</Text>
        {to && (
          <Anchor component={Link} to={to} size="sm" c="rose.6">
            {linkLabel}
          </Anchor>
        )}
      </Group>
      {children}
    </Paper>
  );
}

function TaskLine({ task, detail, badge }: { task: TaskRow; detail: string; badge?: { label: string; color: string } | null }) {
  return (
    <Link to={`/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
            {task.title}
          </Text>
          <Text size="xs" c="dimmed">
            {detail}
          </Text>
        </div>
        {badge && (
          <Badge color={badge.color} variant="light" tt="none" style={{ flexShrink: 0 }}>
            {badge.label}
          </Badge>
        )}
      </Group>
    </Link>
  );
}

type Alert = { key: string; color: string; text: string; to: string };

export function Home() {
  const { profile } = useProfile();
  const { dates } = usePlanFacts();
  const pendingSuggestions = usePendingSuggestions();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [topicKeyById, setTopicKeyById] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [items, setItems] = useState<MoneyRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [unsorted, setUnsorted] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  async function load() {
    const [t, tp, o, i, p, f, u, s] = await Promise.all([
      supabase.from('tasks').select('id, title, topic_id, owner, priority, due_date, status, sort_order'),
      supabase.from('topics').select('id, key'),
      supabase.from('task_options').select('task_id, name, status'),
      supabase.from('planning_items').select('status, amount, amount_kind'),
      supabase.from('payments').select('amount, verification'),
      supabase.from('wedding_functions').select('*').order('sort_order'),
      supabase.from('unmapped_messages').select('msg_id', { count: 'exact', head: true }),
      supabase.from('sync_status').select('last_run_at').limit(1),
    ]);
    setTasks((t.data ?? []) as TaskRow[]);
    setTopicKeyById(Object.fromEntries(((tp.data ?? []) as { id: string; key: string }[]).map((x) => [x.id, x.key])));
    setOptions((o.data ?? []) as OptionRow[]);
    setItems((i.data ?? []) as MoneyRow[]);
    setPayments((p.data ?? []) as PaymentRow[]);
    setFunctions((f.data ?? []) as WeddingFunction[]);
    setUnsorted(u.count ?? 0);
    setLastSynced(s.data?.[0]?.last_run_at ?? null);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('home_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_options' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wedding_functions' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const emoji = (t: TaskRow) => (t.topic_id && TOPIC_EMOJI[topicKeyById[t.topic_id]]) || '✨';
  const byDue = (a: TaskRow, b: TaskRow) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.sort_order - b.sort_order;
  const open = tasks.filter((t) => !isDone(t));

  const nextUp = open.filter((t) => t.due_date).sort(byDue).slice(0, 5);

  const optionsOf = (id: string) => options.filter((o) => o.task_id === id);
  const needsDecision = open
    .filter((t) => {
      const mine = optionsOf(t.id);
      return mine.length > 0 && !mine.some((o) => o.status === 'chosen') && mine.some((o) => o.status !== 'on_hold' && o.status !== 'rejected');
    })
    .sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || byDue(a, b));

  const money = summarizeMoney(items);
  const unverified = payments.filter((p) => p.verification !== 'receipt_checked');
  const unverifiedTotal = unverified.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0) / 100;

  const alerts: Alert[] = [];
  for (const t of open) {
    if (!t.due_date) continue;
    const d = daysToDue(t.due_date);
    if (d <= 14) {
      alerts.push({
        key: `due-${t.id}`,
        color: d < 0 ? 'red' : 'orange',
        text: `${t.title}: ${d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? 'due today' : `due in ${d} days`}`,
        to: `/tasks/${t.id}`,
      });
    }
  }
  if (unverified.length > 0) {
    alerts.push({
      key: 'payments',
      color: 'orange',
      text: `${unverified.length} payment${unverified.length === 1 ? '' : 's'} (${formatInr(unverifiedTotal)}) not checked against a receipt`,
      to: '/budget',
    });
  }
  if (pendingSuggestions > 0) {
    alerts.push({
      key: 'suggestions',
      color: 'rose',
      text: `${pendingSuggestions} suggestion${pendingSuggestions === 1 ? '' : 's'} from the chats to review`,
      to: '/activity/suggestions',
    });
  }
  if (unsorted > 0) {
    alerts.push({ key: 'unsorted', color: 'blue', text: `${unsorted} chat messages not filed under a task yet`, to: '/areas' });
  }
  if (lastSynced) {
    const days = Math.floor((now - new Date(lastSynced).getTime()) / 86_400_000);
    if (days >= STALE_SYNC_DAYS) {
      alerts.push({ key: 'sync', color: 'orange', text: `Chat data was last synced ${days} days ago`, to: '/activity' });
    }
  }

  const days = daysUntil(dates.wedding.start);
  const outfits: OutfitOption[] = options.filter((o) => tasks.find((t) => t.id === o.task_id)?.title.startsWith('Groom outfits'));

  return (
    <Stack gap="lg">
      <Box className="hero" c="white" p={{ base: 'lg', sm: 'xl' }} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
        <Text size="sm" fw={600} tt="uppercase" style={{ letterSpacing: 1, opacity: 0.9 }}>
          {profile?.display_name ? `Hi ${profile.display_name} · ` : ''}
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
          {open.length === 0
            ? 'Everything is decided. Time to celebrate.'
            : `${open.length} task${open.length === 1 ? '' : 's'} to finish, ${needsDecision.length} waiting on a decision.`}
        </Text>
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Panel title="Next up" to="/tasks">
          {nextUp.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nothing has a due date.
            </Text>
          ) : (
            <Stack gap="sm">
              {nextUp.map((t) => (
                <TaskLine
                  key={t.id}
                  task={t}
                  detail={`${emoji(t)} ${t.owner ? OWNER_LABEL[t.owner] : 'Unassigned'}`}
                  badge={dueBadge(t.due_date, false)}
                />
              ))}
            </Stack>
          )}
        </Panel>

        <Panel title="Needs a decision" to="/tasks">
          {needsDecision.length === 0 ? (
            <Text size="sm" c="dimmed">
              Every task with options has a pick.
            </Text>
          ) : (
            <Stack gap="sm">
              {needsDecision.slice(0, 5).map((t) => {
                const live = optionsOf(t.id).filter((o) => o.status !== 'on_hold' && o.status !== 'rejected').length;
                return (
                  <TaskLine
                    key={t.id}
                    task={t}
                    detail={`${emoji(t)} ${live} option${live === 1 ? '' : 's'} open, none chosen`}
                    badge={t.priority === 'high' ? { label: 'High', color: 'red' } : null}
                  />
                );
              })}
            </Stack>
          )}
        </Panel>

        <Panel title="Alerts">
          {alerts.length === 0 ? (
            <Group gap="xs">
              <Box w={10} h={10} style={{ borderRadius: '50%', background: 'var(--mantine-color-teal-6)' }} />
              <Text size="sm">All clear.</Text>
            </Group>
          ) : (
            <Stack gap="xs">
              {alerts.map((a) => (
                <Link key={a.key} to={a.to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    <Box
                      w={10}
                      h={10}
                      mt={5}
                      style={{ borderRadius: '50%', flexShrink: 0, background: `var(--mantine-color-${a.color}-6)` }}
                    />
                    <Text size="sm">{a.text}</Text>
                  </Group>
                </Link>
              ))}
            </Stack>
          )}
        </Panel>

        <Panel title="Money" to="/budget" linkLabel="Budget">
          <SimpleGrid cols={2} spacing="sm">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
                Paid so far
              </Text>
              <Text fz={26} fw={700}>
                {formatInr(money.paid)}
              </Text>
            </div>
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
                Planned and chosen
              </Text>
              <Text fz={26} fw={700}>
                {formatInr(money.planned)}
              </Text>
            </div>
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt="sm">
            {money.openCount === 0
              ? 'No open quotes being compared.'
              : `${money.openCount} open quote${money.openCount === 1 ? '' : 's'} from ${formatInrCompact(money.openLow)} to ${formatInrCompact(money.openHigh)}, not added up.`}
          </Text>
        </Panel>
      </SimpleGrid>

      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={3}>Functions</Title>
          <Anchor component={Link} to="/functions" size="sm" c="rose.6">
            See all
          </Anchor>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {functions.map((f, i) => (
            <FunctionCard key={f.id} fn={f} tint={tintFor(i)} outfits={outfits} to="/functions" />
          ))}
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
