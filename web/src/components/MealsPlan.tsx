import { useState } from 'react';
import { Alert, Badge, Button, Group, Modal, NumberInput, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../hooks/useRealtime';
import { useEditMode } from '../hooks/useEditMode';
import { confirmDanger } from '../lib/confirm';
import { firstError } from '../lib/loadState';
import { LoadError } from './PageSkeleton';
import { MEAL_LABEL, MEAL_ORDER, mealCost, mealLineChecks, mealsByDay, type LineForMeals, type Meal, type MealKind } from '../lib/meals';

type Site = { id: string; name: string };
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dayLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

type Draft = Omit<Meal, 'id'> & { id?: string };
const blank = (date: string): Draft => ({
  meal_date: date,
  meal: 'lunch',
  site_id: null,
  place_text: null,
  for_whom: 'Everyone',
  people: null,
  rate: null,
  menu: null,
  notes: null,
  schedule_id: null,
});

function MealEditor({ draft, sites, lines, onClose, onSaved }: { draft: Draft; sites: Site[]; lines: LineForMeals[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save() {
    setSaving(true);
    const row = {
      meal_date: d.meal_date,
      meal: d.meal,
      site_id: d.site_id,
      place_text: d.site_id ? null : d.place_text?.trim() || null,
      for_whom: d.for_whom.trim() || 'Everyone',
      people: d.people,
      rate: d.rate,
      menu: d.menu?.trim() || null,
      notes: d.notes?.trim() || null,
      schedule_id: d.schedule_id,
      updated_at: new Date().toISOString(),
    };
    const { error } = d.id ? await supabase.from('meals').update(row).eq('id', d.id) : await supabase.from('meals').insert(row);
    setSaving(false);
    if (error) {
      const taken = error.code === '23505';
      notifications.show({
        color: 'red',
        title: 'Could not save',
        message: taken ? `There is already a ${MEAL_LABEL[d.meal].toLowerCase()} for "${row.for_whom}" that day. Change "For whom" to tell them apart.` : error.message,
      });
      return;
    }
    onSaved();
    onClose();
  }

  async function remove() {
    if (!d.id) return;
    const ok = await confirmDanger({
      title: 'Delete this meal?',
      message: `${MEAL_LABEL[d.meal]} on ${dayLabel(d.meal_date)} for ${d.for_whom}. The budget line stays as it is.`,
      confirmLabel: 'Delete meal',
    });
    if (!ok) return;
    const { error } = await supabase.from('meals').delete().eq('id', d.id);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not delete', message: error.message });
      return;
    }
    onSaved();
    onClose();
  }

  const cost = mealCost(d);
  return (
    <Modal opened onClose={onClose} title={d.id ? 'Edit meal' : 'Add a meal'} centered>
      <Stack>
        <Group grow>
          <TextInput type="date" label="Day" value={d.meal_date} min="2027-02-10" max="2027-02-18" onChange={(e) => set('meal_date', e.currentTarget.value)} />
          <Select label="Meal" data={MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} value={d.meal} onChange={(v) => v && set('meal', v as MealKind)} allowDeselect={false} />
        </Group>
        <TextInput label="For whom" description="Everyone, Staff and drivers, Bride side…" value={d.for_whom} onChange={(e) => set('for_whom', e.currentTarget.value)} maxLength={80} />
        <Select
          label="Where"
          placeholder="Somewhere else"
          data={sites.map((s) => ({ value: s.id, label: s.name }))}
          value={d.site_id}
          onChange={(v) => set('site_id', v)}
          clearable
        />
        {!d.site_id && <TextInput label="Place" value={d.place_text ?? ''} onChange={(e) => set('place_text', e.currentTarget.value)} maxLength={120} />}
        <Group grow>
          <NumberInput label="People" min={0} max={2000} value={d.people ?? ''} onChange={(v) => set('people', typeof v === 'number' ? v : null)} />
          <NumberInput label="Rate per head" prefix="₹" min={0} thousandSeparator="," value={d.rate ?? ''} onChange={(v) => set('rate', typeof v === 'number' ? v : null)} />
        </Group>
        {cost != null && <Text size="sm" c="dimmed">Comes to {inr(cost)}</Text>}
        <Select
          label="Budget line"
          description="The line this meal is paid from, so the two can be checked against each other"
          placeholder="None"
          data={lines.map((l) => ({ value: l.id, label: l.payee }))}
          value={d.schedule_id}
          onChange={(v) => set('schedule_id', v)}
          clearable
          searchable
        />
        <Textarea label="Menu" value={d.menu ?? ''} onChange={(e) => set('menu', e.currentTarget.value)} maxLength={500} autosize minRows={2} />
        <Textarea label="Notes" value={d.notes ?? ''} onChange={(e) => set('notes', e.currentTarget.value)} maxLength={500} autosize minRows={1} />
        <Group justify="space-between">
          {d.id ? (
            <Button variant="subtle" color="red" onClick={remove}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} loading={saving} disabled={!d.meal_date}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// Meals for 12 to 16 February: who eats where, how many and at what rate, with a check against the budget lines.
export function MealsPlan({ sites }: { sites: Site[] }) {
  const { isUnlocked } = useEditMode();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [lines, setLines] = useState<LineForMeals[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  async function load() {
    const [m, l] = await Promise.all([
      supabase.from('meals').select('id, meal_date, meal, site_id, place_text, for_whom, people, rate, menu, notes, schedule_id').order('meal_date'),
      supabase.from('payment_schedule').select('id, payee, quantity, rate').neq('status', 'cancelled').order('payee'),
    ]);
    const err = firstError(m, l);
    setLoadError(err);
    if (err) return;
    setMeals((m.data ?? []) as Meal[]);
    setLines(((l.data ?? []) as LineForMeals[]).map((x) => ({ ...x, quantity: x.quantity == null ? null : Number(x.quantity), rate: x.rate == null ? null : Number(x.rate) })));
  }
  useRealtime(['meals', 'payment_schedule'], load, { immediate: true });

  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.name : null);
  const checks = mealLineChecks(meals, lines).filter((c) => c.diff !== 0 || c.unpriced > 0);

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={3}>Meals, 12 to 16 February</Title>
        {isUnlocked && (
          <Button size="xs" variant="light" onClick={() => setEditing(blank('2027-02-14'))}>
            Add a meal
          </Button>
        )}
      </Group>
      {loadError && <LoadError message={loadError} onRetry={() => void load()} />}
      {checks.map((c) => (
        <Alert key={c.line.id} color="orange" variant="light" title={`Meals and “${c.line.payee}” differ`}>
          The meals come to {inr(c.meals)}; the budget line plans {inr(c.budget)} ({c.line.quantity} × {inr(c.line.rate ?? 0)}).
          {c.unpriced > 0 && ` ${c.unpriced} meal${c.unpriced === 1 ? ' has' : 's have'} no people or rate yet.`} Change one so they agree.
        </Alert>
      ))}
      {mealsByDay(meals).map(({ date, meals: list }) => (
        <Paper key={date} withBorder p="sm" radius="md">
          <Group justify="space-between" mb={list.length ? 'xs' : 0}>
            <Text fw={600}>{dayLabel(date)}</Text>
            {list.length === 0 && (
              <Text size="sm" c="dimmed">
                No meals planned yet
              </Text>
            )}
          </Group>
          {list.length > 0 && (
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing={6} horizontalSpacing="xs" highlightOnHover={isUnlocked}>
                <Table.Tbody>
                  {list.map((m) => {
                    const cost = mealCost(m);
                    return (
                      <Table.Tr key={m.id} style={isUnlocked ? { cursor: 'pointer' } : undefined} onClick={isUnlocked ? () => setEditing(m) : undefined}>
                        <Table.Td w={110}>
                          <Badge variant="light" color="orange">
                            {MEAL_LABEL[m.meal]}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{m.for_whom}</Text>
                          <Text size="xs" c="dimmed">
                            {siteName(m.site_id) ?? m.place_text ?? 'Place not set'}
                            {m.menu ? ` · ${m.menu}` : ''}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{m.people != null ? `${m.people} people` : '—'}</Text>
                          <Text size="xs" c="dimmed">
                            {m.rate != null ? `${inr(m.rate)} each` : 'No rate'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" w={100}>
                          <Text size="sm" fw={500}>
                            {cost != null ? inr(cost) : '—'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      ))}
      {isUnlocked && editing && <MealEditor key={editing.id ?? 'new'} draft={editing} sites={sites} lines={lines} onClose={() => setEditing(null)} onSaved={load} />}
    </Stack>
  );
}
