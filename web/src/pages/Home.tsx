import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Badge, Box, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { CountdownHero } from '../components/CountdownHero';
import { supabase, type PlanningItem, type Task } from '../lib/supabase';
import { OWNER_LABEL, TOPIC_EMOJI, daysToDue, dueBadge, formatInr, formatInrCompact, summarizeMoney } from '../lib/topicMeta';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { usePendingSuggestions } from '../hooks/usePendingSuggestions';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { splitOf } from '../lib/rsvp';
import { useProfile } from '../hooks/useProfile';
import { daysUntil, formatRange } from '../lib/planFacts';
import { useRealtime } from '../hooks/useRealtime';
import { getTopics } from '../lib/topics';
import { firstError } from '../lib/loadState';
import { LoadError, PageSkeleton } from '../components/PageSkeleton';
import { FunctionCard, type OutfitOption, type WeddingFunction } from '../components/FunctionCard';
import { tintFor } from '../lib/schedule';
import { EmptyState } from '../components/EmptyState';
import { PlanTimeline } from '../components/PlanTimeline';
import { useTour } from '../hooks/useTour';
import { dueLabel, dueSoon, type DuePayment } from '../lib/duePayments';

type TaskRow = Pick<Task, 'id' | 'title' | 'topic_id' | 'owner' | 'priority' | 'due_date' | 'status' | 'sort_order'>;
type OptionRow = { task_id: string; name: string; status: string };
type MoneyRow = Pick<PlanningItem, 'status' | 'amount' | 'amount_kind'>;
type PaymentRow = { amount: number | string; verification: string };
type ScheduledRow = DuePayment;

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
  const tour = useTour();
  const { dates } = usePlanFacts();
  const pendingSuggestions = usePendingSuggestions();
  const { invites, totals } = useGuestInvites();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [topicKeyById, setTopicKeyById] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [items, setItems] = useState<MoneyRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [unsorted, setUnsorted] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load(isActive: () => boolean = () => true) {
    const [t, tp, o, i, p, f, u, s, sc] = await Promise.all([
      supabase.from('tasks').select('id, title, topic_id, owner, priority, due_date, status, sort_order'),
      getTopics(),
      supabase.from('task_options').select('task_id, name, status'),
      // Only rows with an amount count towards money; skipping the rest keeps this well under the 1000-row cap.
      supabase.from('planning_items').select('status, amount, amount_kind').not('amount', 'is', null),
      supabase.from('payments').select('amount, verification'),
      supabase.from('wedding_functions').select('*').order('sort_order'),
      supabase.from('unmapped_messages').select('msg_id', { count: 'exact', head: true }),
      supabase.from('sync_status').select('last_run_at').limit(1),
      supabase.from('payment_schedule').select('id, payee, amount, due_date, status').eq('status', 'pending').not('due_date', 'is', null),
    ]);
    if (!isActive()) return;
    // A failed reload keeps what is on screen rather than showing an empty home page. A failed first load stays
    // "not loaded", so it does not claim everything is decided.
    const failed = firstError(t, tp, o, i, p, f, sc);
    setLoadError(failed);
    if (failed) return;
    setLoaded(true);
    setTasks((t.data ?? []) as TaskRow[]);
    setTopicKeyById(Object.fromEntries(((tp.data ?? []) as { id: string; key: string }[]).map((x) => [x.id, x.key])));
    setOptions((o.data ?? []) as OptionRow[]);
    setItems((i.data ?? []) as MoneyRow[]);
    setPayments((p.data ?? []) as PaymentRow[]);
    setScheduled((sc.data ?? []) as ScheduledRow[]);
    setFunctions((f.data ?? []) as WeddingFunction[]);
    setUnsorted(u.count ?? 0);
    setLastSynced(s.data?.[0]?.last_run_at ?? null);
  }

  useRealtime(['tasks', 'task_options', 'planning_items', 'wedding_functions', 'payments', 'payment_schedule'], load, { immediate: true });

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

  const dueNow = dueSoon(scheduled, new Date(now).toLocaleDateString('en-CA'));

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
  const awaiting = new Set(invites.filter((i) => splitOf(i).noReply > 0).map((i) => i.guest_id)).size;
  if (awaiting > 0) {
    alerts.push({
      key: 'rsvp',
      color: 'blue',
      text: `${awaiting} invited household${awaiting === 1 ? '' : 's'} with people who have not replied`,
      to: '/guests',
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
      <CountdownHero
        eyebrow={`${profile?.display_name ? `Hi ${profile.display_name} · ` : ''}${formatRange(dates.wedding, { full: true })}`}
        days={days}
        note={
          !loaded
            ? '\u00a0'
            : open.length === 0
            ? 'Everything is decided. Time to celebrate.'
            : `${open.length} task${open.length === 1 ? '' : 's'} to finish, ${needsDecision.length} waiting on a decision.`
        }
      />

      <Text size="sm" c="dimmed" mt={-8}>
        New to the planner?{' '}
        <Anchor component="button" type="button" size="sm" c="rose.6" onClick={tour.start}>
          Take the two-minute tour
        </Anchor>
      </Text>

      {loadError && <LoadError message={loadError} onRetry={() => load()} />}

      {!loaded ? (
        <PageSkeleton cards={4} />
      ) : (
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Panel title="Next up" to="/tasks">
          {nextUp.length === 0 ? (
            <EmptyState compact emoji="🗓️" title="Nothing due right now" hint="Give a task a due date and it will show up here." />
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
            <EmptyState compact emoji="🎉" title="All decided" hint="Every task with options has a pick." />
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

        <Panel title="Payments due" to="/budget" linkLabel="Budget">
          {dueNow.length === 0 ? (
            <EmptyState compact emoji="💸" title="No payment due soon" hint="Pending payments due in the next two weeks, or late, show here." />
          ) : (
            <Stack gap="sm">
              {dueNow.slice(0, 5).map((p) => (
                <Link key={p.id} to="/budget" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>{p.payee}</Text>
                      <Text size="xs" c="dimmed">{formatInr(Number(p.amount))}</Text>
                    </div>
                    <Badge color={p.days < 0 ? 'red' : 'orange'} variant="light" tt="none" style={{ flexShrink: 0 }}>
                      {dueLabel(p.days)}
                    </Badge>
                  </Group>
                </Link>
              ))}
              {dueNow.length > 5 && <Text size="xs" c="dimmed">and {dueNow.length - 5} more in Budget</Text>}
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
      )}

      <PlanTimeline />

      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={3}>Functions</Title>
          <Anchor component={Link} to="/functions" size="sm" c="rose.6">
            See all
          </Anchor>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {functions.map((f, i) => (
            <FunctionCard key={f.id} fn={f} tint={tintFor(i)} outfits={outfits} showRsvp={!f.family_only} rsvp={totals[f.event_date]} to="/functions" />
          ))}
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
