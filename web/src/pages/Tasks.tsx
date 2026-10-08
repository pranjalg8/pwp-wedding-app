import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Accordion,
  Badge,
  Box,
  Button,
  Chip,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { supabase, type PlanningItem, type Task, type TaskOption, type Topic } from '../lib/supabase';
import {
  OPTION_STATUS_LABEL,
  OWNER_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  TOPIC_EMOJI,
  dueBadge,
  formatInr,
  summarizeMoney,
} from '../lib/topicMeta';
import { useEditMode } from '../hooks/useEditMode';
import { TaskEditor } from '../components/TaskEditor';

type OptionRow = Pick<TaskOption, 'id' | 'task_id' | 'name' | 'status'>;
type ItemRow = Pick<PlanningItem, 'id' | 'task_id' | 'status' | 'amount' | 'amount_kind'>;

const isDone = (t: Task) => t.status === 'done' || t.status === 'decided';

function TaskCard({ task, topic, options, items }: { task: Task; topic?: Topic; options: OptionRow[]; items: ItemRow[] }) {
  const money = summarizeMoney(items.map((i) => ({ amount: i.amount, status: i.status, amount_kind: i.amount_kind })));
  const chosen = options.filter((o) => o.status === 'chosen');
  const live = options.filter((o) => o.status !== 'on_hold' && o.status !== 'rejected');
  const due = dueBadge(task.due_date, isDone(task));

  let optionLine: string;
  if (options.length === 0) optionLine = 'No options yet';
  else if (chosen.length > 0) optionLine = `${OPTION_STATUS_LABEL.chosen}: ${chosen.map((o) => o.name).join(', ')}`;
  else optionLine = `${live.length} option${live.length === 1 ? '' : 's'} open, none chosen`;
  const parked = options.length - live.length;

  return (
    <Paper
      component={Link}
      to={`/tasks/${task.id}`}
      withBorder
      p="md"
      className="topic-card"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
          <Text fz={24} lh={1}>
            {(topic && TOPIC_EMOJI[topic.key]) ?? '✨'}
          </Text>
          <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
            {task.title}
          </Text>
        </Group>
        {task.priority === 'high' && !isDone(task) && (
          <Badge color="red" variant="filled" size="sm" style={{ flexShrink: 0 }}>
            High
          </Badge>
        )}
      </Group>

      <Group gap={6} mt="xs">
        <Badge color={STATUS_COLOR[task.status]} variant="light">
          {STATUS_LABEL[task.status]}
        </Badge>
        {task.owner && (
          <Badge color="gray" variant="outline">
            {OWNER_LABEL[task.owner]}
          </Badge>
        )}
        {due && (
          <Badge color={due.color} variant="light" tt="none">
            {due.label}
          </Badge>
        )}
      </Group>

      <Text size="sm" mt="xs" c={chosen.length > 0 ? 'teal' : 'dimmed'} fw={chosen.length > 0 ? 600 : 400}>
        {optionLine}
        {parked > 0 ? ` · ${parked} parked` : ''}
      </Text>

      {(money.paid > 0 || money.planned > 0) && (
        <Group gap="md" mt={4}>
          {money.paid > 0 && (
            <Text size="sm" fw={600}>
              Paid {formatInr(money.paid)}
            </Text>
          )}
          {money.planned > 0 && (
            <Text size="sm" c="dimmed">
              Planned {formatInr(money.planned)}
            </Text>
          )}
        </Group>
      )}
    </Paper>
  );
}

export function Tasks() {
  const navigate = useNavigate();
  const { isUnlocked } = useEditMode();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [area, setArea] = useState<string>('all');
  const [owner, setOwner] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    const [t, tp, o, i] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order'),
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('task_options').select('id, task_id, name, status'),
      supabase.from('planning_items').select('id, task_id, status, amount, amount_kind').not('task_id', 'is', null),
    ]);
    setTasks((t.data ?? []) as Task[]);
    setTopics((tp.data ?? []) as Topic[]);
    setOptions((o.data ?? []) as OptionRow[]);
    setItems((i.data ?? []) as ItemRow[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('tasks_board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_options' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const topicById = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);
  const areasWithTasks = topics.filter((t) => tasks.some((k) => k.topic_id === t.id));

  const visible = tasks
    .filter((t) => area === 'all' || t.topic_id === area)
    .filter((t) => !owner || t.owner === owner || t.owner === 'both')
    .filter((t) => !query.trim() || t.title.toLowerCase().includes(query.trim().toLowerCase()));

  const byDue = (a: Task, b: Task) =>
    (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.sort_order - b.sort_order;

  const high = visible.filter((t) => !isDone(t) && t.priority === 'high').sort(byDue);
  const inProgress = visible.filter((t) => !isDone(t) && t.priority !== 'high' && t.status === 'in_progress').sort(byDue);
  const open = visible.filter((t) => !isDone(t) && t.priority !== 'high' && t.status === 'open').sort(byDue);
  const finished = visible.filter(isDone).sort(byDue);

  const openCount = tasks.filter((t) => !isDone(t)).length;

  function section(title: string, list: Task[]) {
    if (list.length === 0) return null;
    return (
      <Stack gap="sm">
        <Text fw={700} c="dimmed" tt="uppercase" size="sm">
          {title} ({list.length})
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {list.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              topic={t.topic_id ? topicById[t.topic_id] : undefined}
              options={options.filter((o) => o.task_id === t.id)}
              items={items.filter((i) => i.task_id === t.id)}
            />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Tasks</Title>
          <Text size="sm" c="dimmed">
            {openCount} to finish, {tasks.length - openCount} done or decided
          </Text>
        </div>
        {isUnlocked && <Button onClick={() => setCreating(true)}>New task</Button>}
      </Group>

      <Stack gap="xs">
        <ScrollArea type="never">
          <Chip.Group multiple={false} value={area} onChange={(v) => setArea(v as string)}>
            <Group gap="xs" wrap="nowrap">
              <Chip value="all" size="sm" variant="light">
                All areas
              </Chip>
              {areasWithTasks.map((t) => (
                <Chip key={t.id} value={t.id} size="sm" variant="light">
                  {TOPIC_EMOJI[t.key] ?? ''} {t.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </ScrollArea>
        <Group grow align="flex-end">
          <TextInput placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <Select
            placeholder="Anyone"
            clearable
            data={[
              { value: 'pranjal', label: 'Pranjal' },
              { value: 'paridhi', label: 'Paridhi' },
            ]}
            value={owner}
            onChange={setOwner}
          />
        </Group>
      </Stack>

      {section('High priority', high)}
      {section('In progress', inProgress)}
      {section('Open', open)}

      {finished.length > 0 && (
        <Accordion variant="contained" radius="lg">
          <Accordion.Item value="done">
            <Accordion.Control>Done or decided ({finished.length})</Accordion.Control>
            <Accordion.Panel>
              <Box pt="xs">
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                  {finished.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      topic={t.topic_id ? topicById[t.topic_id] : undefined}
                      options={options.filter((o) => o.task_id === t.id)}
                      items={items.filter((i) => i.task_id === t.id)}
                    />
                  ))}
                </SimpleGrid>
              </Box>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}

      {visible.length === 0 && (
        <Paper withBorder p="xl" ta="center">
          <Text c="dimmed">No tasks match.</Text>
        </Paper>
      )}

      {creating && (
        <TaskEditor
          task={null}
          topics={topics}
          opened
          onClose={() => setCreating(false)}
          onSaved={(id) => navigate(`/tasks/${id}`)}
        />
      )}
    </Stack>
  );
}
