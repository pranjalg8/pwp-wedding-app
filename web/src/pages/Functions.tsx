import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Group, Modal, Select, SimpleGrid, Stack, Text, TagsInput, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { FUNCTION_STATUS_LABEL, FunctionCard, tintFor, type OutfitOption, type WeddingFunction } from '../components/FunctionCard';

const STATUS_LABEL = FUNCTION_STATUS_LABEL;

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
  const { totals } = useGuestInvites();
  const [rows, setRows] = useState<WeddingFunction[]>([]);
  const [outfits, setOutfits] = useState<OutfitOption[]>([]);
  const [editing, setEditing] = useState<WeddingFunction | null>(null);

  async function load() {
    const [fns, opts] = await Promise.all([
      supabase.from('wedding_functions').select('*').order('sort_order'),
      supabase.from('task_options').select('name, status, tasks!inner(title)').ilike('tasks.title', 'Groom outfits%'),
    ]);
    setRows((fns.data ?? []) as WeddingFunction[]);
    setOutfits(((opts.data ?? []) as OutfitOption[]).map((o) => ({ name: o.name, status: o.status })));
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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {rows.filter((r) => r.event_date === d).map((r) => (
              <FunctionCard
                key={r.id}
                fn={r}
                tint={tintFor(rows.indexOf(r))}
                outfits={outfits}
                detailed
                showRsvp
                rsvp={totals[r.id]}
                onEdit={isUnlocked ? () => setEditing(r) : undefined}
              />
            ))}
          </SimpleGrid>
        </Stack>
      ))}
      {rows.length === 0 && <Text c="dimmed">No functions yet.</Text>}
      {isUnlocked && editing && <Editor key={editing.id} fn={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </Stack>
  );
}
