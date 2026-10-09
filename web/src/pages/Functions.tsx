import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Group, Modal, Select, Stack, Text, TagsInput, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';

type WeddingFunction = {
  id: string;
  key: string;
  name: string;
  event_date: string;
  slot: 'first_half' | 'second_half';
  sort_order: number;
  theme: string | null;
  colours: string[];
  avoid_colours: string[];
  notes: string | null;
  status: 'open' | 'in_progress' | 'decided';
};

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', decided: 'Decided' } as const;
const STATUS_COLOR = { open: 'orange', in_progress: 'blue', decided: 'teal' } as const;
const SLOT_LABEL = { first_half: 'First half', second_half: 'Second half' } as const;

function Editor({ fn, onClose, onSaved }: { fn: WeddingFunction; onClose: () => void; onSaved: () => void }) {
  const [theme, setTheme] = useState(fn.theme ?? '');
  const [colours, setColours] = useState(fn.colours);
  const [avoid, setAvoid] = useState(fn.avoid_colours);
  const [notes, setNotes] = useState(fn.notes ?? '');
  const [status, setStatus] = useState<string>(fn.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('wedding_functions')
      .update({ theme: theme || null, colours, avoid_colours: avoid, notes: notes || null, status, updated_at: new Date().toISOString() })
      .eq('id', fn.id);
    setSaving(false);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not save', message: error.message });
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title={fn.name} centered>
      <Stack>
        <TextInput label="Theme" value={theme} onChange={(e) => setTheme(e.currentTarget.value)} />
        <TagsInput label="Colours we want" description="Press Enter after each colour" value={colours} onChange={setColours} />
        <TagsInput label="Colours to avoid" value={avoid} onChange={setAvoid} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} minRows={3} />
        <Select
          label="Status"
          data={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          value={status}
          onChange={(v) => v && setStatus(v)}
          allowDeselect={false}
        />
        <Button onClick={save} loading={saving}>Save</Button>
      </Stack>
    </Modal>
  );
}

export function Functions() {
  const { isUnlocked } = useEditMode();
  const [rows, setRows] = useState<WeddingFunction[]>([]);
  const [editing, setEditing] = useState<WeddingFunction | null>(null);

  async function load() {
    const { data } = await supabase.from('wedding_functions').select('*').order('sort_order');
    setRows((data ?? []) as WeddingFunction[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('wedding_functions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wedding_functions' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const days = [...new Set(rows.map((r) => r.event_date))];

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Title order={2}>Functions</Title>
        <Group gap="xs">
          <Button component={Link} to="/functions/results" variant="light" color="rose" size="sm">Results</Button>
          <Button component={Link} to="/functions/swipe" color="rose" size="sm">Pick looks together</Button>
        </Group>
      </Group>
      {days.map((d) => (
        <Stack key={d} gap="sm">
          <Text fw={700} c="dimmed" tt="uppercase" size="sm">
            {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          {rows.filter((r) => r.event_date === d).map((r) => (
            <Card key={r.id} withBorder p="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={700}>{r.name}</Text>
                    <Badge variant="outline" color="gray">{SLOT_LABEL[r.slot]}</Badge>
                    <Badge variant="light" color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </Group>
                  {r.theme && <Text size="sm">Theme: {r.theme}</Text>}
                  {(r.colours.length > 0 || r.avoid_colours.length > 0) && (
                    <Group gap={6}>
                      {r.colours.map((c) => <Badge key={c} color="teal" variant="light">{c}</Badge>)}
                      {r.avoid_colours.map((c) => <Badge key={c} color="red" variant="light">avoid {c}</Badge>)}
                    </Group>
                  )}
                  {r.notes && <Text size="sm" c="dimmed">{r.notes}</Text>}
                </Stack>
                {isUnlocked && (
                  <Button variant="subtle" size="xs" onClick={() => setEditing(r)}>Edit</Button>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      ))}
      {rows.length === 0 && <Text c="dimmed">No functions yet.</Text>}
      {isUnlocked && editing && <Editor key={editing.id} fn={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </Stack>
  );
}
