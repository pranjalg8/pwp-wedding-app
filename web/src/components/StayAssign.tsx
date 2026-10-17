import { useState } from 'react';
import { Badge, Button, Checkbox, Group, Modal, NumberInput, Stack, Text } from '@mantine/core';
import { supabase } from '../lib/supabase';
import type { GuestStay, PlanRow, StaySite, Unplaced } from '../lib/stay';

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Need = { main: number; other: number; people: number };

// Place one household: how many rooms at each place. Changes are recorded in the audit log by a database trigger.
export function StayAssign({
  guest,
  sites,
  stays,
  need,
  opened,
  onClose,
  onSaved,
}: {
  guest: { id: string; name: string; persons: number; needs_lift?: boolean };
  sites: StaySite[];
  stays: GuestStay[];
  need: Need | null;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, number | string>>(() =>
    Object.fromEntries(sites.map((s) => [s.id, Number(stays.find((x) => x.site_id === s.id)?.rooms ?? 0)]))
  );
  const [needsLift, setNeedsLift] = useState(!!guest.needs_lift);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = (v: number | string) => Number(v) || 0;
  const total = sites.reduce((a, s) => a + n(values[s.id]), 0);
  const wanted = need ? need.main + need.other : 0;
  const stairs = needsLift ? sites.filter((s) => !s.has_lift && n(values[s.id]) > 0) : [];

  async function save() {
    setSaving(true);
    setError(null);
    const keep = sites.filter((s) => n(values[s.id]) > 0).map((s) => ({ guest_id: guest.id, site_id: s.id, rooms: n(values[s.id]) }));
    const drop = sites.filter((s) => n(values[s.id]) <= 0 && stays.some((x) => x.site_id === s.id)).map((s) => s.id);

    if (keep.length > 0) {
      const { error: err } = await supabase.from('guest_stays').upsert(keep, { onConflict: 'guest_id,site_id' });
      if (err) return fail(err.message);
    }
    if (drop.length > 0) {
      const { error: err } = await supabase.from('guest_stays').delete().eq('guest_id', guest.id).in('site_id', drop);
      if (err) return fail(err.message);
    }
    if (needsLift !== !!guest.needs_lift) {
      const { error: err } = await supabase.from('guests').update({ needs_lift: needsLift }).eq('id', guest.id);
      if (err) return fail(err.message);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  function fail(message: string) {
    setSaving(false);
    setError(message);
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Rooms: ${guest.name}`} centered>
      <Stack>
        <Text size="sm" c="dimmed">
          {need
            ? `Household of ${guest.persons}, ${need.people} coming at most. Needs ${rooms(need.main)} main stay and ${rooms(need.other)} elsewhere (${rooms(wanted)} in all).`
            : `Household of ${guest.persons}. Not invited to a day yet, so no rooms are needed.`}{' '}
          The same rooms are kept for every night they are there.
        </Text>

        {sites.map((s) => (
          <Group key={s.id} justify="space-between" wrap="nowrap" gap="sm">
            <div style={{ minWidth: 0 }}>
              <Text fw={600} size="sm">
                {s.name}
              </Text>
              <Text size="xs" c="dimmed">
                {[s.has_lift ? 'Lift' : 'No lift', s.people_per_room ? `${s.people_per_room} a room` : null, s.distance_note].filter(Boolean).join(' · ')}
              </Text>
            </div>
            <NumberInput
              aria-label={`Rooms at ${s.name}`}
              min={0}
              max={20}
              step={0.5}
              decimalScale={1}
              w={90}
              value={values[s.id]}
              onChange={(v) => setValues((o) => ({ ...o, [s.id]: v }))}
            />
          </Group>
        ))}

        <Group justify="space-between">
          <Text size="sm">
            Placed: <b>{rooms(total)}</b> of {rooms(wanted)} rooms
          </Text>
          {need && total > wanted + 0.01 && (
            <Badge color="blue" variant="light" tt="none">
              More than they need
            </Badge>
          )}
        </Group>

        <Checkbox
          checked={needsLift}
          onChange={(e) => setNeedsLift(e.currentTarget.checked)}
          label="Needs a lift (cannot manage stairs)"
          description="The suggested plan keeps them at places with a lift."
        />
        {stairs.length > 0 && (
          <Text size="sm" c="red">
            {stairs.map((s) => s.name).join(', ')} has no lift.
          </Text>
        )}

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

export type PlanSnapshot = { guest_id: string; site_id: string; rooms: number }[];

// Put placements back exactly as they were, for Undo.
export async function restoreStays(snapshot: PlanSnapshot): Promise<string | null> {
  const del = await supabase.from('guest_stays').delete().not('id', 'is', null);
  if (del.error) return del.error.message;
  if (snapshot.length === 0) return null;
  const ins = await supabase.from('guest_stays').insert(snapshot);
  return ins.error ? ins.error.message : null;
}

// Preview of a suggested plan before it replaces the current placements.
export function SuggestModal({
  rows,
  unplaced,
  sites,
  names,
  currentCount,
  opened,
  onClose,
  onApply,
}: {
  rows: PlanRow[];
  unplaced: Unplaced[];
  sites: StaySite[];
  names: Record<string, string>;
  currentCount: number;
  opened: boolean;
  onClose: () => void;
  onApply: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const bySite = sites.map((s) => {
    const mine = rows.filter((r) => r.site_id === s.id);
    return { site: s, households: mine.length, rooms: mine.reduce((a, r) => a + r.rooms, 0) };
  });
  const missing = unplaced.reduce((a, u) => a + u.rooms, 0);
  const missingHouseholds = new Set(unplaced.map((u) => u.guest_id));

  return (
    <Modal opened={opened} onClose={onClose} title="Suggested room plan" centered size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Built from the replies so far: households arriving on day 1 first (they keep their rooms for every night), main stay rooms at Royal Pepper,
          other rooms at the nearest place with space, and anyone who needs a lift at a place with one. Nothing changes until you apply it.
        </Text>

        <Stack gap={4}>
          {bySite.map((b) => (
            <Group key={b.site.id} justify="space-between">
              <Text size="sm">{b.site.name}</Text>
              <Text size="sm">
                <b>{rooms(b.rooms)}</b> rooms, {b.households} household{b.households === 1 ? '' : 's'}
              </Text>
            </Group>
          ))}
        </Stack>

        {missing > 0 ? (
          <Stack gap={4}>
            <Text size="sm" fw={600} c="orange">
              {rooms(missing)} rooms for {missingHouseholds.size} household{missingHouseholds.size === 1 ? '' : 's'} do not fit on every night
            </Text>
            <Text size="xs" c="dimmed">
              {unplaced
                .slice(0, 12)
                .map((u) => `${names[u.guest_id] ?? 'Household'} (${rooms(u.rooms)})`)
                .join(', ')}
              {unplaced.length > 12 ? ` and ${unplaced.length - 12} more` : ''}
            </Text>
          </Stack>
        ) : (
          <Text size="sm" c="teal" fw={600}>
            Every household that needs rooms is placed.
          </Text>
        )}

        {currentCount > 0 && (
          <Text size="sm" c="red">
            This replaces the {currentCount} placement{currentCount === 1 ? '' : 's'} you have now. You can undo it straight after.
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={rows.length === 0}
            onClick={async () => {
              setSaving(true);
              await onApply();
              setSaving(false);
            }}
          >
            Apply this plan
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
