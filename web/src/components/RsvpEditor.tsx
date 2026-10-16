import { useState } from 'react';
import { Button, Checkbox, Group, Modal, MultiSelect, NumberInput, Stack, Text } from '@mantine/core';
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

function Counts({ row, max, label, onChange }: { row: Row; max: number; label: string; onChange: (patch: Partial<Row>) => void }) {
  const fields: { key: 'coming' | 'maybe' | 'declined'; name: string }[] = [
    { key: 'coming', name: 'Yes' },
    { key: 'maybe', name: 'Maybe' },
    { key: 'declined', name: 'No' },
  ];
  return (
    <Group gap={6} wrap="nowrap">
      {fields.map((f) => (
        <NumberInput
          key={f.key}
          aria-label={`${f.name}: ${label}`}
          placeholder={f.name}
          min={0}
          max={max}
          allowDecimal={false}
          w={68}
          value={row[f.key]}
          onChange={(v) => onChange({ [f.key]: v })}
        />
      ))}
    </Group>
  );
}

type Answer = 'coming' | 'maybe' | 'declined' | 'clear';
const ANSWERS: { answer: Answer; label: string; color: string }[] = [
  { answer: 'coming', label: 'All yes', color: 'teal' },
  { answer: 'maybe', label: 'All maybe', color: 'yellow' },
  { answer: 'declined', label: 'All no', color: 'red' },
  { answer: 'clear', label: 'No reply', color: 'gray' },
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
          Household of {guest.persons}. RSVP is by day: whoever is coming on a day is at every function that day. Tick the days they are
          invited, then say how many are coming (yes), maybe or not coming. Anyone left out of those three has not replied yet.
        </Text>

        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Same answer for every day
          </Text>
          <QuickPicks
            persons={guest.persons}
            label="every day"
            onPick={(p) => setRows(Object.fromEntries(days.map((d) => [d.date, { invited: true, ...zero, ...p } as Row])))}
          />
        </Stack>

        <Stack gap="sm">
          {days.map((d) => {
            const r = rows[d.date];
            return (
              <div key={d.date}>
                <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
                  <Checkbox
                    label={d.label}
                    description={d.functions.join(', ')}
                    checked={r.invited}
                    onChange={(e) => set(d.date, { invited: e.currentTarget.checked })}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {r.invited && <Counts row={r} max={guest.persons} label={d.label} onChange={(p) => set(d.date, p)} />}
                </Group>
                {r.invited && (
                  <Group gap="sm" ml={28} mt={4} wrap="wrap">
                    <Text size="xs" c={over(r) ? 'red' : 'dimmed'}>
                      {over(r) ? `More than the household of ${guest.persons}` : `${guest.persons - used(r)} no reply`}
                    </Text>
                    <QuickPicks persons={guest.persons} label={d.label} onPick={(p) => set(d.date, p)} />
                  </Group>
                )}
              </div>
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
