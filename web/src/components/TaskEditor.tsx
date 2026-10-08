import { useState } from 'react';
import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { supabase, type Task, type Topic } from '../lib/supabase';
import { OWNER_LABEL, STATUS_LABEL } from '../lib/topicMeta';

export function TaskEditor({
  task,
  topics,
  opened,
  onClose,
  onSaved,
}: {
  task: Task | null;
  topics: Topic[];
  opened: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [summary, setSummary] = useState(task?.summary ?? '');
  const [topicId, setTopicId] = useState<string | null>(task?.topic_id ?? null);
  const [owner, setOwner] = useState<string | null>(task?.owner ?? null);
  const [priority, setPriority] = useState<string>(task?.priority ?? 'normal');
  const [status, setStatus] = useState<string>(task?.status ?? 'open');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      title,
      summary: summary || null,
      topic_id: topicId,
      owner,
      priority,
      status,
      due_date: dueDate || null,
    };
    const res = task
      ? await supabase.from('tasks').update(payload).eq('id', task.id).select('id').single()
      : await supabase.from('tasks').insert(payload).select('id').single();
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? 'Could not save');
      return;
    }
    onSaved(res.data.id);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={task ? 'Edit task' : 'New task'} centered>
      <Stack>
        <TextInput label="Task" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
        <Textarea label="Summary" value={summary} onChange={(e) => setSummary(e.currentTarget.value)} minRows={2} autosize />
        <Select
          label="Area"
          clearable
          placeholder="None"
          data={topics.map((t) => ({ value: t.id, label: t.label }))}
          value={topicId}
          onChange={setTopicId}
        />
        <Group grow align="flex-start">
          <Select
            label="Who is on it?"
            clearable
            placeholder="Not assigned"
            data={Object.entries(OWNER_LABEL).map(([value, label]) => ({ value, label }))}
            value={owner}
            onChange={setOwner}
          />
          <Select
            label="Priority"
            allowDeselect={false}
            data={[
              { value: 'high', label: 'High' },
              { value: 'normal', label: 'Normal' },
              { value: 'low', label: 'Low' },
            ]}
            value={priority}
            onChange={(v) => v && setPriority(v)}
          />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Status"
            allowDeselect={false}
            data={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            value={status}
            onChange={(v) => v && setStatus(v)}
          />
          <TextInput label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.currentTarget.value)} />
        </Group>
        {error && <span style={{ color: 'var(--mantine-color-red-6)', fontSize: 13 }}>{error}</span>}
        <Button onClick={save} loading={saving} disabled={!title.trim()}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
