import { useState } from 'react';
import { Button, Group, Modal, MultiSelect, NumberInput, Select, Stack, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { INVITE_LABEL, INVITE_ORDER, type Invite, type InviteStatus } from '../lib/rsvp';

type FunctionRef = { id: string; name: string };
type GuestRef = { id: string; name: string; persons: number };
type Row = { status: InviteStatus | 'none'; persons: number | string };

const STATUS_DATA = [
  { value: 'none', label: 'Not invited' },
  ...[...INVITE_ORDER].reverse().map((s) => ({ value: s, label: INVITE_LABEL[s] })),
];

// Set one household's answer for every function. Changes are recorded in the audit log by a database trigger.
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
        const existing = invites.find((i) => i.function_id === f.id);
        return [f.id, { status: existing?.status ?? 'none', persons: existing?.persons_attending ?? '' }];
      })
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  async function save() {
    setSaving(true);
    setError(null);
    const keep = functions
      .filter((f) => rows[f.id].status !== 'none')
      .map((f) => {
        const r = rows[f.id];
        const attending = (r.status === 'confirmed' || r.status === 'maybe') && r.persons !== '' ? Number(r.persons) : null;
        return { guest_id: guest.id, function_id: f.id, status: r.status as InviteStatus, persons_attending: attending };
      });
    const drop = functions.filter((f) => rows[f.id].status === 'none' && invites.some((i) => i.function_id === f.id)).map((f) => f.id);

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
    <Modal opened={opened} onClose={onClose} title={`RSVP: ${guest.name}`} centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Household of {guest.persons}. For Yes or Maybe you can set how many are coming; leave it blank for everyone.
        </Text>
        {functions.map((f) => {
          const r = rows[f.id];
          const counts = r.status === 'confirmed' || r.status === 'maybe';
          return (
            <Group key={f.id} gap="sm" align="flex-end" wrap="nowrap">
              <Select
                label={f.name}
                data={STATUS_DATA}
                allowDeselect={false}
                value={r.status}
                onChange={(v) => v && set(f.id, { status: v as Row['status'] })}
                style={{ flex: 1, minWidth: 0 }}
              />
              {counts && (
                <NumberInput
                  aria-label={`People coming to ${f.name}`}
                  placeholder={String(guest.persons)}
                  min={0}
                  max={guest.persons}
                  w={80}
                  value={r.persons}
                  onChange={(v) => set(f.id, { persons: v })}
                />
              )}
            </Group>
          );
        })}
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving}>
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
    const rows = guestIds.flatMap((guest_id) => chosen.map((function_id) => ({ guest_id, function_id, status: 'invited' as const })));
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
