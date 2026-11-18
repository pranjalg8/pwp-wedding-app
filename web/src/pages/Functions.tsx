import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Group, Modal, Select, SimpleGrid, Stack, Text, TagsInput, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { useLiveData } from '../hooks/useLiveData';
import { LoadError } from '../components/LoadError';
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

const EMPTY_FUNCTIONS = { rows: [] as WeddingFunction[], outfits: [] as OutfitOption[] };

async function loadFunctions() {
  const [fns, opts] = await Promise.all([
    supabase.from('wedding_functions').select('*').order('sort_order'),
    supabase.from('task_options').select('name, status, tasks!inner(title)').ilike('tasks.title', 'Groom outfits%'),
  ]);
  return { rows: rowsOf<WeddingFunction>(fns), outfits: rowsOf<OutfitOption>(opts).map((o) => ({ name: o.name, status: o.status })) };
}

export function Functions() {
  const { isUnlocked } = useEditMode();
  const { totals } = useGuestInvites();
  const [editing, setEditing] = useState<WeddingFunction | null>(null);

  const { data, loadError, reload: load } = useLiveData({ tables: ['wedding_functions'], load: loadFunctions, initial: EMPTY_FUNCTIONS });
  const { rows, outfits } = data;

  const days = [...new Set(rows.map((r) => r.event_date))];

  return (
    <Stack gap="xl">
      <LoadError error={loadError} what="The functions" onRetry={() => void load()} />
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
                showRsvp={!r.family_only}
                rsvp={totals[r.event_date]}
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
