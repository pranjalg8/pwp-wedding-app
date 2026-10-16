import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Chip, Group, Paper, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { useProfile } from '../hooks/useProfile';

type Dropped = {
  id: string;
  side: 'groom' | 'bride';
  from_list: 'family' | 'friends';
  relation: string | null;
  name: string;
  family_members: string | null;
  persons: number;
  location: string | null;
  priority: 1 | 2 | null;
  functions: string | null;
  reconsider: boolean;
  note: string | null;
  extra: Record<string, unknown>;
  sort_order: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper withBorder p="md">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text fz={26} fw={700} mt={2}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

// Households that were on the earlier list (19 May 2024) but not on the finalised lists, kept to look at again.
// In edit mode you can mark one as worth reconsidering, or bring it back onto the guest list.
export function DroppedGuests({ onChanged }: { onChanged: () => void }) {
  const { isUnlocked } = useEditMode();
  const { profile } = useProfile();
  const [rows, setRows] = useState<Dropped[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState('all');
  const [priority, setPriority] = useState<string | null>(null);
  const [markedOnly, setMarkedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase.from('guests_dropped').select('*').order('sort_order');
    if (err) setError(err.message);
    setRows((data ?? []) as Dropped[]);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleMark(r: Dropped) {
    setBusy(r.id);
    setError(null);
    const { error: err } = await supabase.from('guests_dropped').update({ reconsider: !r.reconsider }).eq('id', r.id);
    setBusy(null);
    if (err) setError(err.message);
    else load();
  }

  async function bringBack(r: Dropped) {
    if (!window.confirm(`Bring ${r.name} (${r.persons} ${r.persons === 1 ? 'person' : 'people'}) back onto the guest list? Rooms start at 0 and you can set them after. This is recorded in the activity log.`)) return;
    setBusy(r.id);
    setError(null);
    const { data: last } = await supabase.from('guests').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const next = Math.max(2000, (last?.[0]?.sort_order ?? 0) + 1);
    const { error: insertErr } = await supabase.from('guests').insert({
      side: r.side,
      list_group: 'Reconsidered (earlier list)',
      relation: r.relation,
      name: r.name,
      family_members: r.family_members,
      persons: r.persons,
      location: r.location,
      priority: r.priority,
      functions: r.functions,
      extra: { ...r.extra, restored_from: 'dropped list' },
      sort_order: next,
      created_by: profile?.id ?? null,
    });
    if (insertErr) {
      setBusy(null);
      setError(insertErr.message);
      return;
    }
    const { error: deleteErr } = await supabase.from('guests_dropped').delete().eq('id', r.id);
    setBusy(null);
    if (deleteErr) setError(`Added to the guest list, but could not remove from this list: ${deleteErr.message}`);
    load();
    onChanged();
  }

  const people = (list: Dropped[]) => sum(list.map((r) => r.persons));
  const p1 = rows.filter((r) => r.priority === 1);
  const marked = rows.filter((r) => r.reconsider);

  const visible = rows
    .filter((r) => kind === 'all' || r.from_list === kind)
    .filter((r) => !priority || (priority === 'none' ? r.priority === null : String(r.priority) === priority))
    .filter((r) => !markedOnly || r.reconsider)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      return !q || [r.name, r.family_members, r.location, r.relation].some((v) => v?.toLowerCase().includes(q));
    });
  const filtered = visible.length !== rows.length;

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        On the earlier list (19 May 2024) but not on the finalised lists (29 Mar 2026). Mark anyone worth another look, or bring
        them back onto the guest list.
      </Text>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Stat label="Dropped" value={String(people(rows))} hint={`${rows.length} households`} />
        <Stat label="Were Priority 1" value={String(people(p1))} hint={`${p1.length} households`} />
        <Stat label="Marked to reconsider" value={String(people(marked))} hint={`${marked.length} household${marked.length === 1 ? '' : 's'}`} />
        <Stat
          label="Family / friends"
          value={`${people(rows.filter((r) => r.from_list === 'family'))} / ${people(rows.filter((r) => r.from_list === 'friends'))}`}
          hint="People dropped from each list"
        />
      </SimpleGrid>

      <Stack gap="xs">
        <Chip.Group multiple={false} value={kind} onChange={(v) => setKind(v as string)}>
          <Group gap="xs">
            <Chip value="all" size="sm" variant="light">
              Everyone
            </Chip>
            <Chip value="family" size="sm" variant="light">
              Family
            </Chip>
            <Chip value="friends" size="sm" variant="light">
              Friends
            </Chip>
          </Group>
        </Chip.Group>
        <Group grow align="flex-end">
          <TextInput placeholder="Search name, family or place" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <Select
            placeholder="Any earlier priority"
            clearable
            data={[
              { value: '1', label: 'Was Priority 1' },
              { value: '2', label: 'Was Priority 2' },
              { value: 'none', label: 'No priority' },
            ]}
            value={priority}
            onChange={setPriority}
          />
        </Group>
        <Switch label="Only the ones marked to reconsider" checked={markedOnly} onChange={(e) => setMarkedOnly(e.currentTarget.checked)} />
        {filtered && (
          <Text size="sm" c="dimmed">
            Showing {visible.length} households, {people(visible)} people.
          </Text>
        )}
      </Stack>

      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Household</Table.Th>
                <Table.Th>From</Table.Th>
                <Table.Th>Where</Table.Th>
                <Table.Th ta="right">People</Table.Th>
                <Table.Th>Was</Table.Th>
                <Table.Th>Reconsider</Table.Th>
                {isUnlocked && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text fw={500}>{r.name}</Text>
                    {r.family_members && (
                      <Text size="xs" c="dimmed">
                        {r.family_members}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.from_list === 'family' ? 'Family' : 'Friends'}</Text>
                    {r.relation && (
                      <Text size="xs" c="dimmed">
                        {r.relation}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{r.location ?? '—'}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {r.persons}
                  </Table.Td>
                  <Table.Td>
                    {r.priority ? (
                      <Badge variant="light" color={r.priority === 1 ? 'rose' : 'gray'}>
                        Priority {r.priority}
                      </Badge>
                    ) : (
                      <Badge variant="outline" color="gray">
                        Not set
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {r.reconsider ? (
                      <Badge color="orange" variant="light">
                        Reconsider
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  {isUnlocked && (
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      <Button size="compact-xs" variant="subtle" onClick={() => toggleMark(r)} loading={busy === r.id}>
                        {r.reconsider ? 'Unmark' : 'Mark'}
                      </Button>
                      <Button size="compact-xs" variant="subtle" onClick={() => bringBack(r)} disabled={busy === r.id}>
                        Bring back
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {loaded && visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={isUnlocked ? 7 : 6}>
                    <Text c="dimmed">{rows.length === 0 ? 'Nobody has been dropped.' : 'No households match.'}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
