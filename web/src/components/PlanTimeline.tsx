import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Box, Button, Group, Paper, SegmentedControl, Stack, Switch, Text, Timeline, Title } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../hooks/useRealtime';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { firstError } from '../lib/loadState';
import { LoadError } from './PageSkeleton';
import {
  SECTION_META,
  buildTimeline,
  groupByMonth,
  visibleEntries,
  type TimelineEntry,
  type TimelineFunction,
  type TimelinePayment,
  type TimelineTask,
  type TimelineView,
} from '../lib/timeline';

// How many lines show before "Show all", so Home stays short.
const FIRST_SHOWN = 12;

const isoIst = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const todayIst = () => isoIst(new Date());

function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function EntryLine({ e }: { e: TimelineEntry }) {
  const meta = SECTION_META[e.section];
  return (
    <Link to={e.to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <Group gap={6} wrap="wrap" align="baseline">
        <Text size="xs" c={e.state === 'overdue' ? 'red' : 'dimmed'} fw={600} style={{ whiteSpace: 'nowrap' }}>
          {dayLabel(e.date)}
        </Text>
        <Badge size="xs" variant="light" color={meta.color} tt="none">
          {meta.label}
        </Badge>
        {e.state === 'overdue' && (
          <Badge size="xs" variant="filled" color="red" tt="none">
            Overdue
          </Badge>
        )}
        {e.state === 'done' && (
          <Badge size="xs" variant="light" color="gray" tt="none">
            Done
          </Badge>
        )}
      </Group>
      <Text
        size={e.milestone ? 'md' : 'sm'}
        fw={e.milestone ? 700 : 500}
        td={e.state === 'done' ? 'line-through' : undefined}
        c={e.state === 'done' ? 'dimmed' : undefined}
        style={{ overflowWrap: 'anywhere' }}
      >
        {e.title}
      </Text>
      {e.detail && (
        <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
          {e.detail}
        </Text>
      )}
    </Link>
  );
}

function Bullet({ e }: { e: TimelineEntry }) {
  return (
    <Text span fz={e.milestone ? 14 : 11} lh={1} aria-hidden>
      {SECTION_META[e.section].icon}
    </Text>
  );
}

// Every dated thing in the planner on one line, from what is overdue to the honeymoon. Planning is deciding (tasks);
// executing is doing (payments, the functions, the honeymoon). Each line opens the page where it is handled.
export function PlanTimeline() {
  const { dates } = usePlanFacts();
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [payments, setPayments] = useState<TimelinePayment[]>([]);
  const [functions, setFunctions] = useState<TimelineFunction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<TimelineView>('all');
  const [showDone, setShowDone] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load(isActive: () => boolean = () => true) {
    const [t, p, f] = await Promise.all([
      supabase.from('tasks').select('id, title, due_date, status').not('due_date', 'is', null),
      supabase.from('payment_schedule').select('id, payee, amount, due_date, status').not('due_date', 'is', null),
      supabase.from('wedding_functions').select('id, name, event_date'),
    ]);
    if (!isActive()) return;
    const failed = firstError(t, p, f);
    setLoadError(failed);
    if (failed) return;
    setTasks((t.data ?? []) as TimelineTask[]);
    setPayments((p.data ?? []) as TimelinePayment[]);
    setFunctions((f.data ?? []) as TimelineFunction[]);
    setLoaded(true);
  }

  useRealtime(['tasks', 'payment_schedule', 'wedding_functions'], load, { immediate: true });

  const today = todayIst();
  const honeymoonStart = isoIst(dates.honeymoon.start);
  const honeymoonEnd = isoIst(dates.honeymoon.end);
  const all = useMemo(
    () => buildTimeline({ tasks, payments, functions, honeymoon: { start: honeymoonStart, end: honeymoonEnd } }, today),
    [tasks, payments, functions, honeymoonStart, honeymoonEnd, today]
  );
  const shown = visibleEntries(all, view, showDone);
  const overdue = shown.filter((e) => e.state === 'overdue');
  const rest = shown.filter((e) => e.state !== 'overdue');
  const restShown = showAll ? rest : rest.slice(0, FIRST_SHOWN);
  const months = groupByMonth(restShown);
  // The "Today" line goes before the first entry dated today or later.
  const firstFutureId = restShown.find((e) => e.date >= today)?.id;

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="sm">
        <Box style={{ minWidth: 0, flex: '1 1 260px' }}>
          <Title order={3}>Timeline</Title>
          <Text size="sm" c="dimmed">
            Everything with a date, from today to the honeymoon. Planning is deciding (tasks); executing is doing it
            (payments, the functions, the trip). Tap a line to open it where it is handled.
          </Text>
        </Box>
        <Stack gap={6} align="flex-end">
          <SegmentedControl
            size="xs"
            value={view}
            onChange={(v) => setView(v as TimelineView)}
            data={[
              { value: 'all', label: 'Everything' },
              { value: 'plan', label: 'Planning' },
              { value: 'execute', label: 'Executing' },
            ]}
          />
          <Switch size="xs" label="Show done" checked={showDone} onChange={(e) => setShowDone(e.currentTarget.checked)} />
        </Stack>
      </Group>

      {loadError && <LoadError message={loadError} onRetry={() => load()} />}

      {!loaded ? (
        <Text size="sm" c="dimmed">Loading the timeline…</Text>
      ) : shown.length === 0 ? (
        <Text size="sm" c="dimmed">Nothing dated here yet. Give a task or a payment a date and it shows up.</Text>
      ) : (
        <Stack gap="md">
          {overdue.length > 0 && (
            <Box>
              <Text size="xs" fw={700} tt="uppercase" c="red" mb={6} style={{ letterSpacing: 0.6 }}>
                Overdue ({overdue.length})
              </Text>
              <Timeline bulletSize={22} lineWidth={2} color="red" active={overdue.length}>
                {overdue.map((e) => (
                  <Timeline.Item key={e.id} bullet={<Bullet e={e} />}>
                    <EntryLine e={e} />
                  </Timeline.Item>
                ))}
              </Timeline>
            </Box>
          )}

          {months.map((m) => (
            <Box key={m.key}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6} style={{ letterSpacing: 0.6 }}>
                {m.label}
              </Text>
              <Timeline bulletSize={22} lineWidth={2} color="rose" active={m.entries.filter((e) => e.date < today).length - 1}>
                {m.entries.map((e) => (
                  <Timeline.Item
                    key={e.id}
                    bullet={<Bullet e={e} />}
                    title={
                      e.id === firstFutureId ? (
                        <Badge size="xs" color="rose" variant="filled" tt="none" mb={4}>
                          Today, {dayLabel(today)}
                        </Badge>
                      ) : undefined
                    }
                  >
                    <EntryLine e={e} />
                  </Timeline.Item>
                ))}
              </Timeline>
            </Box>
          ))}

          {rest.length > FIRST_SHOWN && (
            <Button variant="subtle" color="rose" size="xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : `Show all ${rest.length}`}
            </Button>
          )}
        </Stack>
      )}
    </Paper>
  );
}
