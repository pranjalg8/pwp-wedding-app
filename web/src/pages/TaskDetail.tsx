import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Accordion, Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { supabase, type ChatMessage, type PlanningItem, type Task, type TaskOption, type Topic } from '../lib/supabase';
import {
  KIND_LABEL,
  OPTION_STATUS_ORDER,
  OWNER_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  TOPIC_EMOJI,
  dueBadge,
  formatInr,
} from '../lib/topicMeta';
import { useEditMode } from '../hooks/useEditMode';
import { OptionCard } from '../components/OptionCard';
import { OptionEditor } from '../components/OptionEditor';
import { TaskEditor } from '../components/TaskEditor';
import { MessageThread } from '../components/MessageThread';

export function TaskDetail() {
  const { taskId } = useParams();
  const { isUnlocked } = useEditMode();
  const [task, setTask] = useState<Task | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [options, setOptions] = useState<TaskOption[]>([]);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage>>({});
  const [notFound, setNotFound] = useState(false);
  const [editingTask, setEditingTask] = useState(false);
  const [editingOption, setEditingOption] = useState<TaskOption | null | 'new'>(null);

  async function load() {
    if (!taskId) return;
    const [t, tp, o, i] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('task_options').select('*').eq('task_id', taskId).order('sort_order'),
      supabase.from('planning_items').select('*').eq('task_id', taskId).order('created_at'),
    ]);
    if (!t.data) {
      setNotFound(true);
      return;
    }
    const taskRow = t.data as Task;
    const optionRows = (o.data ?? []) as TaskOption[];
    const itemRows = (i.data ?? []) as PlanningItem[];
    setTask(taskRow);
    setTopics((tp.data ?? []) as Topic[]);
    setOptions(optionRows);
    setItems(itemRows);

    const ids = Array.from(
      new Set([
        ...taskRow.source_msg_ids,
        ...optionRows.flatMap((x) => x.source_msg_ids),
        ...itemRows.flatMap((x) => x.source_msg_ids ?? []),
      ])
    );
    if (ids.length) {
      const { data } = await supabase.from('messages').select('*').in('msg_id', ids).eq('is_noise', false);
      setMessages(Object.fromEntries((data ?? []).map((m) => [m.msg_id, m as ChatMessage])));
    } else {
      setMessages({});
    }
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`task_${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_options', filter: `task_id=eq.${taskId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items', filter: `task_id=eq.${taskId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (notFound) {
    return (
      <Stack>
        <Anchor component={Link} to="/" size="sm" c="dimmed">
          ← All tasks
        </Anchor>
        <Text c="dimmed">That task doesn't exist.</Text>
      </Stack>
    );
  }
  if (!task) return null;

  const topic = topics.find((t) => t.id === task.topic_id);
  const done = task.status === 'done' || task.status === 'decided';
  const due = dueBadge(task.due_date, done);

  const sortedOptions = [...options].sort(
    (a, b) => OPTION_STATUS_ORDER.indexOf(a.status) - OPTION_STATUS_ORDER.indexOf(b.status) || a.sort_order - b.sort_order
  );
  const live = sortedOptions.filter((o) => o.status !== 'on_hold' && o.status !== 'rejected');
  const parked = sortedOptions.filter((o) => o.status === 'on_hold' || o.status === 'rejected');
  const taskLevelItems = items.filter((i) => !i.option_id);

  const card = (o: TaskOption) => (
    <OptionCard
      key={o.id}
      option={o}
      items={items.filter((i) => i.option_id === o.id)}
      messages={messages}
      editMode={isUnlocked}
      onChanged={load}
      onEdit={setEditingOption}
    />
  );

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/" size="sm" c="dimmed">
        ← All tasks
      </Anchor>

      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
          <Text fz={32} lh={1}>
            {(topic && TOPIC_EMOJI[topic.key]) ?? '✨'}
          </Text>
          <Title order={2} style={{ overflowWrap: 'anywhere' }}>
            {task.title}
          </Title>
        </Group>
        {isUnlocked && (
          <Button variant="light" size="xs" onClick={() => setEditingTask(true)} style={{ flexShrink: 0 }}>
            Edit task
          </Button>
        )}
      </Group>

      <Group gap={6}>
        <Badge color={STATUS_COLOR[task.status]} variant="light">
          {STATUS_LABEL[task.status]}
        </Badge>
        {task.priority === 'high' && !done && <Badge color="red">High priority</Badge>}
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
        {topic && (
          <Badge color="gray" variant="transparent" tt="none">
            {topic.label}
          </Badge>
        )}
      </Group>

      {task.summary && <Text style={{ overflowWrap: 'anywhere' }}>{task.summary}</Text>}

      {taskLevelItems.length > 0 && (
        <Stack gap="xs">
          <Text fw={700} c="dimmed" tt="uppercase" size="sm">
            Details
          </Text>
          {taskLevelItems.map((i) => (
            <Paper key={i.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
                <div style={{ minWidth: 0 }}>
                  <Text fw={500} size="sm">
                    {i.title}
                  </Text>
                  {i.detail && (
                    <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                      {i.detail}
                    </Text>
                  )}
                </div>
                {i.amount != null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <Text size="sm" fw={600}>
                      {formatInr(i.amount)}
                    </Text>
                    {i.amount_kind && (
                      <Text size="xs" c="dimmed">
                        {KIND_LABEL[i.amount_kind]}
                      </Text>
                    )}
                  </div>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Group justify="space-between" align="center">
        <Text fw={700} c="dimmed" tt="uppercase" size="sm">
          Options ({options.length})
        </Text>
        {isUnlocked && (
          <Button size="xs" variant="light" onClick={() => setEditingOption('new')}>
            Add option
          </Button>
        )}
      </Group>

      {options.length === 0 && (
        <Paper withBorder p="lg" ta="center">
          <Text c="dimmed">No options yet. Add the vendors or candidates being compared.</Text>
        </Paper>
      )}

      <Stack gap="sm">{live.map(card)}</Stack>

      {parked.length > 0 && (
        <Accordion variant="contained" radius="lg">
          <Accordion.Item value="parked">
            <Accordion.Control>Parked: on hold or rejected ({parked.length})</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm" pt="xs">
                {parked.map(card)}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}

      <MessageThread
        label="general discussion"
        msgIds={task.source_msg_ids}
        messages={messages}
        editMode={isUnlocked}
        onChanged={load}
      />

      {editingTask && (
        <TaskEditor task={task} topics={topics} opened onClose={() => setEditingTask(false)} onSaved={load} />
      )}
      {editingOption && (
        <OptionEditor
          taskId={task.id}
          option={editingOption === 'new' ? null : editingOption}
          opened
          onClose={() => setEditingOption(null)}
          onSaved={load}
        />
      )}
    </Stack>
  );
}
