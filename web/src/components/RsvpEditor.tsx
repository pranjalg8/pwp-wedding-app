import { useState } from 'react';
import { ActionIcon, Box, Button, Checkbox, Drawer, Group, Modal, Paper, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import type { Invite } from '../lib/rsvp';

// RSVP is by day: someone coming on a day is at every function that day.
export type RsvpDay = { date: string; label: string; functions: string[] };

type GuestRef = { id: string; name: string; persons: number };
type Mode = 'all' | 'some' | 'none' | 'noreply';
type Row = { invited: boolean; coming: number | string; maybe: number | string; declined: number | string; mode: Mode };

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

// Set one household's answer for each day: everyone coming, some coming (then yes, maybe and no counts), not
// coming, or no reply yet. Whoever is left over has not replied. Changes are recorded in the audit log by a database trigger.
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
        const c = e?.coming ?? 0;
        const m = e?.maybe ?? 0;
        const x = e?.declined ?? 0;
        const mode: Mode = c + m + x === 0 ? 'noreply' : c === guest.persons ? 'all' : x === guest.persons ? 'none' : 'some';
        return [d.date, { invited: !!e, coming: c, maybe: m, declined: x, mode }];
      })
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (date: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [date]: { ...r[date], ...patch } }));
  const choose = (date: string, mode: Mode) =>
    set(date, {
      mode,
      ...(mode === 'all' ? { coming: guest.persons, maybe: 0, declined: 0 } : mode === 'none' ? { coming: 0, maybe: 0, declined: guest.persons } : mode === 'noreply' ? zero : {}),
    });
  const chooseAll = (mode: Mode) =>
    setRows(
      Object.fromEntries(
        days.map((d) => [
          d.date,
          {
            invited: true,
            mode,
            coming: mode === 'all' ? guest.persons : 0,
            maybe: 0,
            declined: mode === 'none' ? guest.persons : 0,
          } as Row,
        ])
      )
    );
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

  const CHOICES: { mode: Mode; label: string; color: string }[] = [
    { mode: 'all', label: "Everyone's coming", color: 'teal' },
    { mode: 'some', label: 'Some are', color: 'teal' },
    { mode: 'none', label: 'Not coming', color: 'red' },
    { mode: 'noreply', label: 'No reply yet', color: 'gray' },
  ];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={500}
      title={
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.6 }}>
            Set the answer
          </Text>
          <Text ff="heading" fz={26} fw={600} lh={1.2}>
            {guest.name}
          </Text>
          <Text size="sm" c="dimmed">
            {guest.persons} {guest.persons === 1 ? 'person' : 'people'}
          </Text>
        </div>
      }
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Tick the days they are invited, then pick how they answered. Whoever comes on a day is at every function that day.
        </Text>

        <Paper withBorder p="sm">
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Same answer for every day
            </Text>
            <SimpleGrid cols={3} spacing={6}>
              {CHOICES.filter((c) => c.mode !== 'some').map((c) => (
                <Button key={c.mode} variant="light" color={c.color} size="compact-md" onClick={() => chooseAll(c.mode)}>
                  {c.label}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>
        </Paper>

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
                  <SimpleGrid cols={2} spacing="xs">
                    {CHOICES.map((c) => {
                      const on = r.mode === c.mode;
                      return (
                        <Button
                          key={c.mode}
                          variant={on ? 'light' : 'default'}
                          color={c.color}
                          h={48}
                          fw={600}
                          aria-pressed={on}
                          styles={{ root: { borderWidth: 2, borderColor: on ? `var(--mantine-color-${c.color}-6)` : undefined } }}
                          onClick={() => choose(d.date, c.mode)}
                        >
                          {c.label}
                        </Button>
                      );
                    })}
                  </SimpleGrid>
                  {r.mode === 'some' && (
                    <Stack gap="sm" p="sm" style={{ borderRadius: 12, background: 'var(--mantine-color-default-hover)' }}>
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
                    </Stack>
                  )}
                </Stack>
              )}
            </Paper>
          );
        })}

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={anyOver}>
            Save answers
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

// What the households' invites looked like before a bulk change, so the change can be undone.
export type InviteSnapshot = { guestIds: string[]; rows: { guest_id: string; event_date: string; coming: number; maybe: number; declined: number }[] };

export type BulkMode = 'add' | 'only' | 'remove';

// Put the selected households' invites back exactly as they were: clear what is there now, then restore the snapshot.
export async function restoreInvites(snapshot: InviteSnapshot): Promise<string | null> {
  const del = await supabase.from('guest_rsvps').delete().in('guest_id', snapshot.guestIds);
  if (del.error) return del.error.message;
  if (snapshot.rows.length > 0) {
    const ins = await supabase.from('guest_rsvps').insert(snapshot.rows);
    if (ins.error) return ins.error.message;
  }
  return null;
}

// Change the days a set of selected households is invited to. Add keeps what they have and adds the chosen days,
// Only makes the chosen days their only days, Remove takes the chosen days away. Answers on days that stay are kept.
export function BulkInviteModal({
  guestIds,
  invites,
  days,
  opened,
  onClose,
  onSaved,
  onDone,
}: {
  guestIds: string[];
  invites: Invite[];
  days: RsvpDay[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDone: (snapshot: InviteSnapshot, summary: string) => void;
}) {
  const [mode, setMode] = useState<BulkMode>('add');
  const [chosen, setChosen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ids = new Set(guestIds);
  const mine = invites.filter((i) => ids.has(i.guest_id));
  const dayLabel = (date: string) => days.find((d) => d.date === date)?.label ?? date;
  const chosenLabels = days.filter((d) => chosen.includes(d.date)).map((d) => d.label).join(' and ');

  // Invites that would be deleted, and how many of those already carry an answer.
  const doomed = mine.filter((i) => (mode === 'only' ? !chosen.includes(i.event_date) : mode === 'remove' ? chosen.includes(i.event_date) : false));
  const withAnswers = doomed.filter((i) => i.coming + i.maybe + i.declined > 0);
  const householdsWithAnswers = new Set(withAnswers.map((i) => i.guest_id)).size;
  const householdsLosing = new Set(doomed.map((i) => i.guest_id)).size;
  const newInvites = mode === 'remove' ? 0 : guestIds.reduce((count, id) => count + chosen.filter((d) => !mine.some((i) => i.guest_id === id && i.event_date === d)).length, 0);

  async function save() {
    setSaving(true);
    setError(null);
    const snapshot: InviteSnapshot = {
      guestIds,
      rows: mine.map((i) => ({ guest_id: i.guest_id, event_date: i.event_date, coming: i.coming, maybe: i.maybe, declined: i.declined })),
    };
    if (mode !== 'remove') {
      const rows = guestIds.flatMap((guest_id) => chosen.map((event_date) => ({ guest_id, event_date })));
      const { error: err } = await supabase.from('guest_rsvps').upsert(rows, { onConflict: 'guest_id,event_date', ignoreDuplicates: true });
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    const removeDates = mode === 'remove' ? chosen : mode === 'only' ? days.map((d) => d.date).filter((d) => !chosen.includes(d)) : [];
    if (removeDates.length > 0) {
      const { error: err } = await supabase.from('guest_rsvps').delete().in('guest_id', guestIds).in('event_date', removeDates);
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    setSaving(false);
    const n = guestIds.length;
    const who = `${n} household${n === 1 ? '' : 's'}`;
    onSaved();
    onDone(
      snapshot,
      mode === 'add' ? `${who} invited to ${chosenLabels}` : mode === 'only' ? `${who} now invited to ${chosenLabels} only` : `${chosenLabels} invite removed for ${who}`
    );
    onClose();
  }

  const applyLabel = mode === 'add' ? 'Invite' : mode === 'only' ? 'Set invites' : 'Remove invites';

  return (
    <Modal opened={opened} onClose={onClose} title={`Change invites for ${guestIds.length} household${guestIds.length === 1 ? '' : 's'}`} centered>
      <Stack>
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(v) => setMode(v as BulkMode)}
          data={[
            { value: 'add', label: 'Add days' },
            { value: 'only', label: 'Only these days' },
            { value: 'remove', label: 'Remove days' },
          ]}
        />
        <Text size="sm" c="dimmed">
          {mode === 'add' && 'Invites them to the days you tick, and keeps any days and answers they already have.'}
          {mode === 'only' && 'Makes the days you tick their only days. Any other day they were invited to is removed.'}
          {mode === 'remove' && 'Takes the days you tick away from them. Their other days stay.'}
        </Text>
        <Checkbox.Group value={chosen} onChange={setChosen}>
          <Stack gap="xs">
            {days.map((d) => (
              <Checkbox key={d.date} value={d.date} label={d.label} description={d.functions.join(', ')} />
            ))}
          </Stack>
        </Checkbox.Group>

        {chosen.length > 0 && (
          <Text size="sm">
            {mode !== 'remove' && `${newInvites} new invite${newInvites === 1 ? '' : 's'} will be added. `}
            {mode !== 'add' && `${doomed.length} invite${doomed.length === 1 ? '' : 's'} on ${householdsLosing} household${householdsLosing === 1 ? '' : 's'} will be removed. `}
            {mode === 'add' && 'Nothing is removed.'}
          </Text>
        )}
        {householdsWithAnswers > 0 && (
          <Text size="sm" c="red">
            {householdsWithAnswers} household{householdsWithAnswers === 1 ? ' has' : 's have'} answers on a day that would be removed (
            {[...new Set(withAnswers.map((i) => dayLabel(i.event_date)))].join(', ')}). You can undo right after.
          </Text>
        )}
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving} disabled={chosen.length === 0 || guestIds.length === 0} color={mode === 'remove' ? 'red' : undefined}>
          {applyLabel}
        </Button>
      </Stack>
    </Modal>
  );
}

export type BulkAnswer = 'waiting' | 'coming' | 'maybe' | 'declined' | 'reset';

const BULK_ANSWERS: { value: BulkAnswer; label: string; hint: string; color: string }[] = [
  { value: 'waiting', label: 'Invited, no reply yet', hint: 'Invites them and clears any answer', color: 'blue' },
  { value: 'coming', label: "Everyone's coming", hint: 'The whole household says yes', color: 'teal' },
  { value: 'maybe', label: 'Maybe', hint: 'The whole household is unsure', color: 'yellow' },
  { value: 'declined', label: 'Not coming', hint: 'The whole household says no', color: 'red' },
];

// Flip the answer for many households at once, for the days you tick: invited with no reply yet, everyone coming,
// maybe, not coming, or reset (take the invite away, back to not invited). The whole household gets the answer;
// answers that differ per person are still set one household at a time. Undo restores what they had.
export function BulkAnswerModal({
  guests,
  invites,
  days,
  opened,
  onClose,
  onSaved,
  onDone,
}: {
  guests: GuestRef[];
  invites: Invite[];
  days: RsvpDay[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDone: (snapshot: InviteSnapshot, summary: string) => void;
}) {
  const [answer, setAnswer] = useState<BulkAnswer>('waiting');
  const [chosen, setChosen] = useState<string[]>(() => days.map((d) => d.date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guestIds = guests.map((g) => g.id);
  const ids = new Set(guestIds);
  const mine = invites.filter((i) => ids.has(i.guest_id));
  const persons = new Map(guests.map((g) => [g.id, g.persons]));

  const target = (id: string) => {
    const p = persons.get(id) ?? 0;
    return { coming: answer === 'coming' ? p : 0, maybe: answer === 'maybe' ? p : 0, declined: answer === 'declined' ? p : 0 };
  };
  // Answers that would be lost or replaced: rows on the chosen days that already hold an answer and would change.
  const replaced = mine.filter((i) => {
    if (!chosen.includes(i.event_date) || i.coming + i.maybe + i.declined === 0) return false;
    if (answer === 'reset') return true;
    const t = target(i.guest_id);
    return t.coming !== i.coming || t.maybe !== i.maybe || t.declined !== i.declined;
  });
  const householdsReplaced = new Set(replaced.map((i) => i.guest_id)).size;
  const dayLabels = days.filter((d) => chosen.includes(d.date)).map((d) => d.label).join(' and ');
  const n = guests.length;
  const who = `${n} household${n === 1 ? '' : 's'}`;

  async function save() {
    setSaving(true);
    setError(null);
    const snapshot: InviteSnapshot = {
      guestIds,
      rows: mine.map((i) => ({ guest_id: i.guest_id, event_date: i.event_date, coming: i.coming, maybe: i.maybe, declined: i.declined })),
    };
    if (answer === 'reset') {
      const { error: err } = await supabase.from('guest_rsvps').delete().in('guest_id', guestIds).in('event_date', chosen);
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    } else {
      const rows = guests.flatMap((g) => chosen.map((event_date) => ({ guest_id: g.id, event_date, ...target(g.id) })));
      const { error: err } = await supabase.from('guest_rsvps').upsert(rows, { onConflict: 'guest_id,event_date' });
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    setSaving(false);
    onSaved();
    const label = BULK_ANSWERS.find((a) => a.value === answer)?.label.toLowerCase();
    onDone(snapshot, answer === 'reset' ? `${who} reset to not invited for ${dayLabels}` : `${who} set to "${label}" for ${dayLabels}`);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Set answer for ${who}`} centered>
      <Stack>
        <SimpleGrid cols={2} spacing="xs">
          {BULK_ANSWERS.map((a) => {
            const on = answer === a.value;
            return (
              <Button
                key={a.value}
                variant={on ? 'light' : 'default'}
                color={a.color}
                h={56}
                fw={600}
                aria-pressed={on}
                styles={{ root: { borderWidth: 2, borderColor: on ? `var(--mantine-color-${a.color}-6)` : undefined }, label: { whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.25 } }}
                onClick={() => setAnswer(a.value)}
              >
                {a.label}
              </Button>
            );
          })}
        </SimpleGrid>
        <Button
          variant={answer === 'reset' ? 'filled' : 'default'}
          color="red"
          h={48}
          fw={600}
          aria-pressed={answer === 'reset'}
          onClick={() => setAnswer('reset')}
        >
          Reset: take the invite away (not invited)
        </Button>
        <Text size="sm" c="dimmed">
          {answer === 'reset' ? 'Back to the starting state: no invite and no answer for the days you tick.' : BULK_ANSWERS.find((a) => a.value === answer)?.hint + ' for the days you tick.'}
        </Text>

        <Checkbox.Group value={chosen} onChange={setChosen}>
          <Stack gap="xs">
            {days.map((d) => (
              <Checkbox key={d.date} value={d.date} label={d.label} description={d.functions.join(', ')} />
            ))}
          </Stack>
        </Checkbox.Group>

        {householdsReplaced > 0 && (
          <Text size="sm" c="red">
            {householdsReplaced} household{householdsReplaced === 1 ? ' has' : 's have'} an answer that will be {answer === 'reset' ? 'removed' : 'replaced'}. You can undo right
            after.
          </Text>
        )}
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving} disabled={chosen.length === 0 || n === 0} color={answer === 'reset' ? 'red' : undefined}>
          {answer === 'reset' ? `Reset ${who}` : `Set ${who}`}
        </Button>
      </Stack>
    </Modal>
  );
}
