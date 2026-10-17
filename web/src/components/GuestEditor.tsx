import { useState } from 'react';
import { Button, Group, Modal, NumberInput, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';

export type Guest = {
  id: string;
  side: 'groom' | 'bride';
  list_group: string | null;
  relation: string | null;
  name: string;
  family_members: string | null;
  persons: number;
  rooms_inside: number | string;
  rooms_outside: number | string;
  location: string | null;
  priority: 1 | 2 | null;
  functions: string | null;
  needs_lift?: boolean;
  sort_order: number;
};

// Add or edit one invited household. Changes are recorded in the audit log by a database trigger.
export function GuestEditor({
  guest,
  side,
  nextOrder,
  opened,
  onClose,
  onSaved,
}: {
  guest: Guest | null;
  side: 'groom' | 'bride';
  nextOrder: number;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useProfile();
  const [name, setName] = useState(guest?.name ?? '');
  const [members, setMembers] = useState(guest?.family_members ?? '');
  const [group, setGroup] = useState(guest?.list_group ?? '');
  const [relation, setRelation] = useState(guest?.relation ?? '');
  const [location, setLocation] = useState(guest?.location ?? '');
  const [persons, setPersons] = useState<number | string>(guest?.persons ?? 1);
  const [roomsIn, setRoomsIn] = useState<number | string>(Number(guest?.rooms_inside ?? 0));
  const [roomsOut, setRoomsOut] = useState<number | string>(Number(guest?.rooms_outside ?? 0));
  const [priority, setPriority] = useState<string | null>(guest?.priority ? String(guest.priority) : null);
  const [functions, setFunctions] = useState(guest?.functions ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personsNum = Number(persons);
  const valid = name.trim() !== '' && Number.isInteger(personsNum) && personsNum >= 0;

  async function save() {
    setSaving(true);
    setError(null);
    const fields = {
      name: name.trim(),
      family_members: members.trim() || null,
      list_group: group.trim() || null,
      relation: relation.trim() || null,
      location: location.trim() || null,
      persons: personsNum,
      rooms_inside: Number(roomsIn) || 0,
      rooms_outside: Number(roomsOut) || 0,
      priority: priority ? Number(priority) : null,
      functions: functions.trim() || null,
    };
    const res = guest
      ? await supabase.from('guests').update(fields).eq('id', guest.id)
      : await supabase.from('guests').insert({ ...fields, side, sort_order: nextOrder, created_by: profile?.id ?? null });
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={guest ? 'Edit household' : 'Add household'} centered>
      <Stack>
        <TextInput label="Name (head of household)" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <Textarea
          label="Family members coming"
          value={members}
          onChange={(e) => setMembers(e.currentTarget.value)}
          autosize
          minRows={1}
        />
        <Group grow align="flex-start">
          <TextInput label="Group" placeholder="e.g. Relatives" value={group} onChange={(e) => setGroup(e.currentTarget.value)} />
          <TextInput label="Relation" value={relation} onChange={(e) => setRelation(e.currentTarget.value)} />
        </Group>
        <TextInput label="Where they live" value={location} onChange={(e) => setLocation(e.currentTarget.value)} />
        <Group grow align="flex-start">
          <NumberInput label="People" min={0} allowDecimal={false} value={persons} onChange={setPersons} required />
          <NumberInput label="Rooms at the main stay" min={0} step={0.5} decimalScale={1} value={roomsIn} onChange={setRoomsIn} />
          <NumberInput label="Rooms elsewhere" min={0} step={0.5} decimalScale={1} value={roomsOut} onChange={setRoomsOut} />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Priority"
            placeholder="Not set"
            clearable
            data={[
              { value: '1', label: 'Priority 1' },
              { value: '2', label: 'Priority 2' },
            ]}
            value={priority}
            onChange={setPriority}
          />
          <TextInput label="Functions" description='As in the list, e.g. "All"' value={functions} onChange={(e) => setFunctions(e.currentTarget.value)} />
        </Group>
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving} disabled={!valid}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
