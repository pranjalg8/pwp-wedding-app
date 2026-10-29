import { useState } from 'react';
import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import type { StaySite } from '../lib/stay';
import { ISSUE_TEXT, PAID_BY_LABEL, isProblem, roomIssues, type Household, type Occupant, type PaidBy, type StayRoom } from '../lib/rooms';

const nightLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const PAID_DATA = (Object.keys(PAID_BY_LABEL) as PaidBy[]).map((v) => ({ value: v, label: PAID_BY_LABEL[v] }));

function fail(title: string, message: string) {
  notifications.show({ color: 'red', title, message });
}

// One room: who is in it, and (when edit mode is on) its details.
export function RoomModal({
  room,
  site,
  occupants,
  households,
  roomsOf,
  allNights,
  editable,
  onClose,
  reload,
}: {
  room: StayRoom;
  site: StaySite | undefined;
  occupants: Occupant[];
  households: Household[];
  roomsOf: Map<string, number>;
  allNights: string[];
  editable: boolean;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const [label, setLabel] = useState(room.label);
  const [floor, setFloor] = useState<number | string>(room.floor ?? '');
  const [capacity, setCapacity] = useState<number | string>(room.capacity);
  const [from, setFrom] = useState<string | null>(room.available_from);
  const [paidBy, setPaidBy] = useState<string | null>(room.paid_by);
  const [notes, setNotes] = useState(room.notes ?? '');
  const [add, setAdd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const issues = roomIssues(room, site, occupants, allNights);
  const inRoom = new Set(occupants.map((o) => o.guest.id));
  const choices = households
    .filter((h) => !inRoom.has(h.g.id))
    .sort((a, b) => (roomsOf.get(a.g.id) ?? 0) - (roomsOf.get(b.g.id) ?? 0) || a.g.sort_order - b.g.sort_order)
    .map((h) => ({ value: h.g.id, label: `${h.g.name} (${h.people}, ${roomsOf.get(h.g.id) ?? 0} of ${h.roomsNeeded} rooms)` }));

  async function saveDetails() {
    if (!label.trim()) return fail('Room needs a name', 'Give the room a number or name.');
    setSaving(true);
    const { error } = await supabase
      .from('stay_rooms')
      .update({
        label: label.trim(),
        floor: floor === '' ? null : Number(floor),
        capacity: Math.max(1, Number(capacity) || 1),
        available_from: from,
        paid_by: paidBy,
        notes: notes.trim() || null,
      })
      .eq('id', room.id);
    setSaving(false);
    if (error) return fail('Could not save', error.code === '23505' ? 'Another room here already has that name.' : error.message);
    await reload();
    onClose();
  }

  async function addHousehold() {
    if (!add) return;
    const { error } = await supabase.from('room_stays').insert({ room_id: room.id, guest_id: add });
    if (error) return fail('Could not place', error.message);
    setAdd(null);
    await reload();
  }

  async function removeOccupant(id: string) {
    const { error } = await supabase.from('room_stays').delete().eq('id', id);
    if (error) return fail('Could not remove', error.message);
    await reload();
  }

  async function setPeople(id: string, v: number | string) {
    const people = v === '' ? null : Math.max(1, Number(v));
    const { error } = await supabase.from('room_stays').update({ people }).eq('id', id);
    if (error) return fail('Could not save', error.message);
    await reload();
  }

  async function deleteRoom() {
    if (!window.confirm(`Delete room ${room.label}${occupants.length > 0 ? ` and take ${occupants.length} household${occupants.length === 1 ? '' : 's'} out of it` : ''}? This is recorded in the activity log.`)) return;
    const { error } = await supabase.from('stay_rooms').delete().eq('id', room.id);
    if (error) return fail('Could not delete', error.message);
    await reload();
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title={`Room ${room.label}${site ? `, ${site.name.split(',')[0]}` : ''}`} centered>
      <Stack gap="sm">
        {issues.length > 0 && (
          <Group gap={6}>
            {issues.map((i) => (
              <Badge key={i} size="sm" variant="light" tt="none" color={isProblem(i) ? 'red' : 'gray'}>
                {ISSUE_TEXT[i]}
              </Badge>
            ))}
          </Group>
        )}

        <Stack gap={6}>
          <Text size="sm" fw={600}>
            Who is here
          </Text>
          {occupants.length === 0 && (
            <Text size="sm" c="dimmed">
              Nobody yet.
            </Text>
          )}
          {occupants.map((o) => (
            <Group key={o.stay.id} justify="space-between" wrap="nowrap" gap="xs">
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {o.guest.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {(roomsOf.get(o.guest.id) ?? 1) > 1 ? `In ${roomsOf.get(o.guest.id)} rooms` : 'One room'}
                  {o.guest.needs_lift ? ' · needs a lift' : ''}
                  {o.firstNight ? ` · from ${nightLabel(o.firstNight)}` : ''}
                </Text>
              </div>
              {editable ? (
                <Group gap={6} wrap="nowrap">
                  <NumberInput
                    aria-label={`People from ${o.guest.name} in this room`}
                    w={74}
                    size="xs"
                    min={1}
                    max={20}
                    placeholder={String(o.people)}
                    value={o.stay.people ?? ''}
                    onChange={(v) => setPeople(o.stay.id, v)}
                  />
                  <Button size="compact-xs" variant="subtle" color="red" onClick={() => removeOccupant(o.stay.id)}>
                    Remove
                  </Button>
                </Group>
              ) : (
                <Text size="sm">{o.people}</Text>
              )}
            </Group>
          ))}
          {editable && (
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <Select
                style={{ flex: 1 }}
                size="xs"
                searchable
                placeholder="Add a household"
                data={choices}
                value={add}
                onChange={setAdd}
                nothingFoundMessage="No household left to place"
                aria-label="Add a household to this room"
              />
              <Button size="xs" onClick={addHousehold} disabled={!add}>
                Add
              </Button>
            </Group>
          )}
          {editable && occupants.length > 0 && (
            <Text size="xs" c="dimmed">
              Leave the number blank to split a household evenly across its rooms.
            </Text>
          )}
        </Stack>

        {editable && (
          <Stack gap="xs" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="sm" fw={600}>
              Room details
            </Text>
            <Group grow gap="xs" align="flex-start">
              <TextInput label="Room" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
              <NumberInput label="Floor" value={floor} onChange={setFloor} min={0} max={30} allowDecimal={false} />
              <NumberInput label="Holds up to" value={capacity} onChange={setCapacity} min={1} max={12} allowDecimal={false} />
            </Group>
            <Group grow gap="xs" align="flex-start">
              <Select
                label="Open from"
                value={from ?? ''}
                onChange={(v) => setFrom(v || null)}
                allowDeselect={false}
                data={[{ value: '', label: 'Every night' }, ...allNights.map((n) => ({ value: n, label: nightLabel(n) }))]}
              />
              <Select label="Paid by" value={paidBy} onChange={setPaidBy} data={PAID_DATA} clearable placeholder="Not set" />
            </Group>
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} autosize minRows={1} maxRows={4} placeholder="Connecting room, ground floor, extra bed" />
            <Group justify="space-between">
              <Button size="xs" variant="subtle" color="red" onClick={deleteRoom}>
                Delete room
              </Button>
              <Button onClick={saveDetails} loading={saving}>
                Save room
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

// Add several rooms at once: a place, how many, a name prefix and a first number.
export function AddRoomsModal({ sites, rooms, allNights, onClose, reload }: { sites: StaySite[]; rooms: StayRoom[]; allNights: string[]; onClose: () => void; reload: () => Promise<void> }) {
  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [count, setCount] = useState<number | string>(1);
  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState<number | string>(1);
  const [floor, setFloor] = useState<number | string>('');
  const [capacity, setCapacity] = useState<number | string>(4);
  const [from, setFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!siteId) return;
    const n = Math.min(60, Math.max(1, Number(count) || 1));
    const first = Number(start) || 1;
    const existing = new Set(rooms.filter((r) => r.site_id === siteId).map((r) => r.label));
    const order = Math.max(0, ...rooms.filter((r) => r.site_id === siteId).map((r) => r.sort_order));
    const rows = Array.from({ length: n }, (_, i) => ({
      site_id: siteId,
      label: `${prefix.trim()}${first + i}`,
      floor: floor === '' ? null : Number(floor),
      capacity: Math.max(1, Number(capacity) || 1),
      available_from: from,
      sort_order: order + i + 1,
    }));
    const clash = rows.find((r) => existing.has(r.label));
    if (clash) return fail('Name already used', `Room ${clash.label} already exists here. Change the prefix or the first number.`);
    setSaving(true);
    const { error } = await supabase.from('stay_rooms').insert(rows);
    setSaving(false);
    if (error) return fail('Could not add rooms', error.message);
    await reload();
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title="Add rooms" centered>
      <Stack gap="sm">
        <Select label="Place" value={siteId} onChange={setSiteId} allowDeselect={false} data={sites.map((s) => ({ value: s.id, label: s.name }))} />
        <Group grow gap="xs" align="flex-start">
          <NumberInput label="How many" value={count} onChange={setCount} min={1} max={60} allowDecimal={false} />
          <TextInput label="Name starts with" value={prefix} onChange={(e) => setPrefix(e.currentTarget.value)} placeholder="Blank, or R, 2-" />
          <NumberInput label="First number" value={start} onChange={setStart} min={0} allowDecimal={false} />
        </Group>
        <Group grow gap="xs" align="flex-start">
          <NumberInput label="Floor" value={floor} onChange={setFloor} min={0} max={30} allowDecimal={false} />
          <NumberInput label="Holds up to" value={capacity} onChange={setCapacity} min={1} max={12} allowDecimal={false} />
          <Select
            label="Open from"
            value={from ?? ''}
            onChange={(v) => setFrom(v || null)}
            allowDeselect={false}
            data={[{ value: '', label: 'Every night' }, ...allNights.map((n) => ({ value: n, label: nightLabel(n) }))]}
          />
        </Group>
        <Button onClick={save} loading={saving}>
          Add {Number(count) || 1} room{(Number(count) || 1) === 1 ? '' : 's'}
        </Button>
      </Stack>
    </Modal>
  );
}
