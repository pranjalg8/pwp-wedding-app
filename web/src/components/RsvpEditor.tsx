import { useState } from 'react';
import { Button, Checkbox, Group, Modal, MultiSelect, NumberInput, Stack, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import type { Invite } from '../lib/rsvp';

type FunctionRef = { id: string; name: string };
type GuestRef = { id: string; name: string; persons: number };
type Row = { invited: boolean; coming: number | string; maybe: number | string; declined: number | string };

const n = (v: number | string) => Number(v) || 0;
const zero = { coming: 0, maybe: 0, declined: 0 };
const used = (r: Row) => n(r.coming) + n(r.maybe) + n(r.declined);

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

// Set one household's answer for every function as three counts: yes, maybe, no. Whoever is left over has
// not replied. Changes are recorded in the audit log by a database trigger.
export function RsvpEditor({
  guest,
  functions,
  invites,
  opened,
  onClose,
  onSaved,
}: {
  guest: GuestRef;
  functions: FunctionRef[];
  invites: Invite[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      functions.map((f) => {
        const e = invites.find((i) => i.function_id === f.id);
        return [f.id, { invited: !!e, coming: e?.coming ?? 0, maybe: e?.maybe ?? 0, declined: e?.declined ?? 0 }];
      })
    )
  );
  const [all, setAll] = useState<Row>({ invited: true, coming: 0, maybe: 0, declined: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const over = (r: Row) => used(r) > guest.persons;
  const anyOver = over(all) || functions.some((f) => rows[f.id].invited && over(rows[f.id]));

  function applyToAll() {
    setRows(Object.fromEntries(functions.map((f) => [f.id, { invited: true, coming: n(all.coming), maybe: n(all.maybe), declined: n(all.declined) }])));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const keep = functions
      .filter((f) => rows[f.id].invited)
      .map((f) => ({
        guest_id: guest.id,
        function_id: f.id,
        coming: n(rows[f.id].coming),
        maybe: n(rows[f.id].maybe),
        declined: n(rows[f.id].declined),
      }));
    const drop = functions.filter((f) => !rows[f.id].invited && invites.some((i) => i.function_id === f.id)).map((f) => f.id);

    if (keep.length > 0) {
      const { error: err } = await supabase.from('guest_invites').upsert(keep, { onConflict: 'guest_id,function_id' });
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    if (drop.length > 0) {
      const { error: err } = await supabase.from('guest_invites').delete().eq('guest_id', guest.id).in('function_id', drop);
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
          Household of {guest.persons}. For each function tick who is invited and say how many are coming (yes), maybe, or not coming.
          Anyone left out of those three has not replied yet.
        </Text>

        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Same answer for every function
          </Text>
          <QuickPicks persons={guest.persons} label="every function" onPick={(p) => setRows(Object.fromEntries(functions.map((f) => [f.id, { invited: true, ...zero, ...p } as Row])))} />
          <Group gap="sm" wrap="wrap">
            <Counts row={all} max={guest.persons} label="all functions" onChange={(p) => setAll((a) => ({ ...a, ...p }))} />
            <Button variant="light" size="compact-md" onClick={applyToAll} disabled={over(all)}>
              Apply to all functions
            </Button>
          </Group>
          {over(all) && (
            <Text size="xs" c="red">
              That is more than the household of {guest.persons}.
            </Text>
          )}
        </Stack>

        <Stack gap="xs">
          {functions.map((f) => {
            const r = rows[f.id];
            return (
              <div key={f.id}>
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Checkbox label={f.name} checked={r.invited} onChange={(e) => set(f.id, { invited: e.currentTarget.checked })} style={{ flex: 1, minWidth: 0 }} />
                  {r.invited && <Counts row={r} max={guest.persons} label={f.name} onChange={(p) => set(f.id, p)} />}
                </Group>
                {r.invited && (
                  <Group gap="sm" ml={28} mt={4} wrap="wrap">
                    <Text size="xs" c={over(r) ? 'red' : 'dimmed'}>
                      {over(r) ? `More than the household of ${guest.persons}` : `${guest.persons - used(r)} no reply`}
                    </Text>
                    <QuickPicks persons={guest.persons} label={f.name} onPick={(p) => set(f.id, p)} />
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

// Invite every household currently shown to the chosen functions. Households already invited keep their answer.
export function BulkInviteModal({
  guestIds,
  functions,
  opened,
  onClose,
  onSaved,
}: {
  guestIds: string[];
  functions: FunctionRef[];
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
    const rows = guestIds.flatMap((guest_id) => chosen.map((function_id) => ({ guest_id, function_id })));
    const { error: err } = await supabase.from('guest_invites').upsert(rows, { onConflict: 'guest_id,function_id', ignoreDuplicates: true });
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
          label="Functions"
          placeholder="Pick one or more"
          data={functions.map((f) => ({ value: f.id, label: f.name }))}
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
