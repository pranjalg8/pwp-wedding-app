import { useState } from 'react';
import { ActionIcon, Box, Button, Checkbox, Group, Modal, MultiSelect, Paper, Stack, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import type { Invite } from '../lib/rsvp';

// RSVP is by day: someone coming on a day is at every function that day.
export type RsvpDay = { date: string; label: string; functions: string[] };

type GuestRef = { id: string; name: string; persons: number };
type Row = { invited: boolean; coming: number | string; maybe: number | string; declined: number | string };

const n = (v: number | string) => Number(v) || 0;
const used = (r: Row) => n(r.coming) + n(r.maybe) + n(r.declined);
const zero = { coming: 0, maybe: 0, declined: 0 };

// Days with their functions, e.g. [{ date: '2027-02-14', label: 'Sun 14 Feb', functions: ['Tilak', ...] }].
export function daysFromFunctions(fns: { name: string; event_date: string }[]): RsvpDay[] {
  const dates = [...new Set(fns.map((f) => f.event_date))].sort();
  return dates.map((date) => ({
    date,
    label: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    functions: fns.filter((f) => f.event_date === date).map((f) => f.name),
  }));
}

type CountKey = 'coming' | 'maybe' | 'declined';
const COUNT_FIELDS: { key: CountKey; name: string; hint: string; color: string }[] = [
  { key: 'coming', name: 'Yes', hint: 'coming', color: 'teal' },
  { key: 'maybe', name: 'Maybe', hint: 'not sure yet', color: 'yellow' },
  { key: 'declined', name: 'No', hint: 'not coming', color: 'red' },
];

// One row per answer: the label on the left, a counter with big minus and plus buttons on the right, so it is
// clear what is being counted and nobody has to type or hit tiny arrows.
function CountRow({
  name,
  hint,
  color,
  value,
  canAdd,
  context,
  onChange,
}: {
  name: string;
  hint: string;
  color: string;
  value: number;
  canAdd: boolean;
  context: string;
  onChange: (v: number) => void;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Group gap={8} wrap="nowrap">
        <Box w={10} h={10} style={{ borderRadius: '50%', flexShrink: 0, background: `var(--mantine-color-${color}-6)` }} />
        <div>
          <Text size="sm" fw={700} lh={1.2}>
            {name}
          </Text>
          <Text size="xs" c="dimmed" lh={1.2}>
            {hint}
          </Text>
        </div>
      </Group>
      <Group gap={6} wrap="nowrap">
        <ActionIcon
          variant="light"
          color={color}
          size="lg"
          radius="xl"
          aria-label={`One fewer ${name.toLowerCase()} for ${context}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
            −
          </span>
        </ActionIcon>
        <Text w={28} ta="center" fw={700} fz={22} aria-live="polite" aria-label={`${name}: ${value}`}>
          {value}
        </Text>
        <ActionIcon
          variant="light"
          color={color}
          size="lg"
          radius="xl"
          aria-label={`One more ${name.toLowerCase()} for ${context}`}
          disabled={!canAdd}
          onClick={() => onChange(value + 1)}
        >
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
            +
          </span>
        </ActionIcon>
      </Group>
    </Group>
  );
}

function Counts({ row, max, label, onChange }: { row: Row; max: number; label: string; onChange: (patch: Partial<Row>) => void }) {
  const canAdd = used(row) < max;
  return (
    <Stack gap="xs">
      {COUNT_FIELDS.map((f) => (
        <CountRow
          key={f.key}
          name={f.name}
          hint={f.hint}
          color={f.color}
          value={n(row[f.key])}
          canAdd={canAdd}
          context={label}
          onChange={(v) => onChange({ [f.key]: v })}
        />
      ))}
    </Stack>
  );
}

// One dot per person, coloured by answer, so the split reads at a glance (grey = has not replied).
function PeopleDots({ row, persons }: { row: Row; persons: number }) {
  const colours = [
    ...Array(Math.min(n(row.coming), persons)).fill('teal'),
    ...Array(n(row.maybe)).fill('yellow'),
    ...Array(n(row.declined)).fill('red'),
  ].slice(0, persons);
  while (colours.length < persons) colours.push('gray');
  if (persons > 24) return null;
  return (
    <Group gap={4} wrap="wrap" aria-hidden>
      {colours.map((c, i) => (
        <Box
          key={i}
          w={12}
          h={12}
          style={{ borderRadius: '50%', background: `var(--mantine-color-${c}-${c === 'gray' ? 4 : 6})`, opacity: c === 'gray' ? 0.5 : 1 }}
        />
      ))}
    </Group>
  );
}

type Answer = 'coming' | 'maybe' | 'declined' | 'clear';
const ANSWERS: { answer: Answer; label: string; color: string }[] = [
  { answer: 'coming', label: 'Everyone yes', color: 'teal' },
  { answer: 'maybe', label: 'Everyone maybe', color: 'yellow' },
  { answer: 'declined', label: 'Everyone no', color: 'red' },
  { answer: 'clear', label: 'Clear', color: 'gray' },
];

// What a one-click answer means: the whole household says the same thing, or nobody has replied yet.
const answerFor = (answer: Answer, persons: number): Partial<Row> => ({
  coming: answer === 'coming' ? persons : 0,
  maybe: answer === 'maybe' ? persons : 0,
  declined: answer === 'declined' ? persons : 0,
});

function QuickPicks({ persons, label, onPick }: { persons: number; label: string; onPick: (patch: Partial<Row>) => void }) {
  return (
    <Group gap={4}>
      {ANSWERS.map((p) => (
        <Button
          key={p.answer}
          size="compact-xs"
          variant="light"
          color={p.color}
          aria-label={`${p.label} for ${label}`}
          onClick={() => onPick(answerFor(p.answer, persons))}
        >
          {p.label}
        </Button>
      ))}
    </Group>
  );
}

// Set one household's answer for each day as three counts: yes, maybe, no. Whoever is left over has not
// replied. Changes are recorded in the audit log by a database trigger.
export function RsvpEditor({
  guest,
  days,
  invites,
  opened,
  onClose,
  onSaved,
}: {
  guest: GuestRef;
  days: RsvpDay[];
  invites: Invite[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      days.map((d) => {
        const e = invites.find((i) => i.event_date === d.date);
        return [d.date, { invited: !!e, coming: e?.coming ?? 0, maybe: e?.maybe ?? 0, declined: e?.declined ?? 0 }];
      })
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (date: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [date]: { ...r[date], ...patch } }));
  const over = (r: Row) => used(r) > guest.persons;
  const anyOver = days.some((d) => rows[d.date].invited && over(rows[d.date]));

  async function save() {
    setSaving(true);
    setError(null);
    const keep = days
      .filter((d) => rows[d.date].invited)
      .map((d) => ({
        guest_id: guest.id,
        event_date: d.date,
        coming: n(rows[d.date].coming),
        maybe: n(rows[d.date].maybe),
        declined: n(rows[d.date].declined),
      }));
    const drop = days.filter((d) => !rows[d.date].invited && invites.some((i) => i.event_date === d.date)).map((d) => d.date);

    if (keep.length > 0) {
      const { error: err } = await supabase.from('guest_rsvps').upsert(keep, { onConflict: 'guest_id,event_date' });
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    if (drop.length > 0) {
      const { error: err } = await supabase.from('guest_rsvps').delete().eq('guest_id', guest.id).in('event_date', drop);
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`RSVP: ${guest.name}`} centered size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Household of {guest.persons}. Tick the days they are invited, then say how many are coming (Yes), unsure (Maybe) or not
          coming (No). Anyone you leave out shows as not replied yet. Whoever comes on a day is at every function that day.
        </Text>

        <Paper withBorder p="sm">
          <Group justify="space-between" gap="sm">
            <Text size="sm" fw={600}>
              Same answer for every day
            </Text>
            <QuickPicks
              persons={guest.persons}
              label="every day"
              onPick={(p) => setRows(Object.fromEntries(days.map((d) => [d.date, { invited: true, ...zero, ...p } as Row])))}
            />
          </Group>
        </Paper>

        <Stack gap="sm">
          {days.map((d) => {
            const r = rows[d.date];
            const left = guest.persons - used(r);
            return (
              <Paper key={d.date} withBorder p="md">
                <Checkbox
                  label={d.label}
                  description={d.functions.join(', ')}
                  checked={r.invited}
                  onChange={(e) => set(d.date, { invited: e.currentTarget.checked })}
                  styles={{ label: { fontWeight: 700 } }}
                />
                {r.invited && (
                  <Stack gap="sm" mt="md">
                    <Counts row={r} max={guest.persons} label={d.label} onChange={(p) => set(d.date, p)} />
                    <Stack gap={6} align="center">
                      <PeopleDots row={r} persons={guest.persons} />
                      <Text size="sm" c={over(r) ? 'red' : 'dimmed'} ta="center">
                        {over(r)
                          ? `That is more than the household of ${guest.persons}`
                          : left === 0
                            ? 'Everyone has replied'
                            : `${left} of ${guest.persons} not replied yet`}
                      </Text>
                    </Stack>
                    <Group justify="center">
                      <QuickPicks persons={guest.persons} label={d.label} onPick={(p) => set(d.date, p)} />
                    </Group>
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving} disabled={anyOver}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}

// Invite every household currently shown to the chosen days. Households already invited keep their answer.
export function BulkInviteModal({
  guestIds,
  days,
  opened,
  onClose,
  onSaved,
}: {
  guestIds: string[];
  days: RsvpDay[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const rows = guestIds.flatMap((guest_id) => chosen.map((event_date) => ({ guest_id, event_date })));
    const { error: err } = await supabase.from('guest_rsvps').upsert(rows, { onConflict: 'guest_id,event_date', ignoreDuplicates: true });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Invite the households shown" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          {guestIds.length} household{guestIds.length === 1 ? '' : 's'} will be marked as invited with no reply yet. Anyone who already has an answer keeps it.
        </Text>
        <MultiSelect
          label="Days"
          placeholder="Pick one or both"
          data={days.map((d) => ({ value: d.date, label: `${d.label}: ${d.functions.join(', ')}` }))}
          value={chosen}
          onChange={setChosen}
        />
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving} disabled={chosen.length === 0 || guestIds.length === 0}>
          Invite
        </Button>
      </Stack>
    </Modal>
  );
}
