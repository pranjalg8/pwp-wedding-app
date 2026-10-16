import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Chip, Group, Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { GuestEditor, type Guest } from '../components/GuestEditor';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { BulkInviteModal, RsvpEditor } from '../components/RsvpEditor';
import { RsvpBar } from '../components/RsvpBar';
import { INVITE_COLOR, INVITE_LABEL, INVITE_ORDER, scaleRooms, splitOf, stayRange, type Invite } from '../lib/rsvp';

type FunctionRef = { id: string; name: string };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

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

export function Guests() {
  const { isUnlocked } = useEditMode();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [group, setGroup] = useState('all');
  const [priority, setPriority] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Guest | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [functions, setFunctions] = useState<FunctionRef[]>([]);
  const [rsvpFor, setRsvpFor] = useState<Guest | null>(null);
  const [bulk, setBulk] = useState(false);
  const { invites, totals, reload: reloadInvites } = useGuestInvites();

  async function loadFunctions() {
    const { data } = await supabase.from('wedding_functions').select('id, name').order('sort_order');
    setFunctions((data ?? []) as FunctionRef[]);
  }

  async function load() {
    const { data, error: err } = await supabase.from('guests').select('*').order('sort_order');
    if (err) setError(err.message);
    setGuests((data ?? []) as Guest[]);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    loadFunctions();
    const channel = supabase
      .channel('guests_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function remove(g: Guest) {
    if (!window.confirm(`Remove ${g.name} (${g.persons} ${g.persons === 1 ? 'person' : 'people'}) from the list? This is recorded in the activity log.`)) return;
    setError(null);
    const { error: err } = await supabase.from('guests').delete().eq('id', g.id);
    if (err) setError(err.message);
    else load();
  }

  const groups = useMemo(() => [...new Set(guests.map((g) => g.list_group).filter((x): x is string => !!x))], [guests]);

  const visible = guests
    .filter((g) => group === 'all' || g.list_group === group)
    .filter((g) => !priority || (priority === 'none' ? g.priority === null : String(g.priority) === priority))
    .filter((g) => {
      const q = query.trim().toLowerCase();
      return !q || [g.name, g.family_members, g.location, g.relation].some((v) => v?.toLowerCase().includes(q));
    });

  const people = (list: Guest[]) => sum(list.map((g) => g.persons));
  const p1 = guests.filter((g) => g.priority === 1);
  const p2 = guests.filter((g) => g.priority === 2);
  const unset = guests.filter((g) => g.priority === null);
  const filtered = visible.length !== guests.length;

  // Rooms follow who might actually come: "most" drops only those who said no, "least" keeps only the yeses.
  const invitesOf = (id: string) => invites.filter((i) => i.guest_id === id);
  const anyInvites = invites.length > 0;
  const roomsAt = (pick: 'most' | 'least') =>
    guests.reduce(
      (acc, g) => {
        const people = stayRange(g.persons, invitesOf(g.id))[pick];
        acc.inside += scaleRooms(Number(g.rooms_inside), g.persons, people);
        acc.outside += scaleRooms(Number(g.rooms_outside), g.persons, people);
        return acc;
      },
      { inside: 0, outside: 0 }
    );
  const roomsMost = roomsAt('most');
  const roomsLeast = roomsAt('least');
  const nextOrder = Math.max(0, ...guests.map((g) => g.sort_order)) + 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Guests</Title>
          <Text size="sm" c="dimmed">
            Pranjal's side: the finalised family and friends lists (29 Mar 2026).
          </Text>
        </div>
        {isUnlocked && (
          <Group gap="xs">
            <Button variant="light" onClick={() => setBulk(true)} disabled={visible.length === 0}>
              Invite shown to functions
            </Button>
            <Button onClick={() => setEditing('new')}>Add household</Button>
          </Group>
        )}
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Stat label="People" value={String(people(guests))} hint={`${guests.length} households`} />
        <Stat
          label="Rooms"
          value={`${rooms(roomsMost.inside)} + ${rooms(roomsMost.outside)}`}
          hint={
            anyInvites
              ? `Up to, if no one else drops · confirmed only: ${rooms(roomsLeast.inside)} + ${rooms(roomsLeast.outside)}`
              : 'At the main stay + elsewhere'
          }
        />
        <Stat label="Priority 1" value={String(people(p1))} hint={`${p1.length} households · Priority 2: ${people(p2)}`} />
        <Stat label="No priority set" value={String(people(unset))} hint={`${unset.length} household${unset.length === 1 ? '' : 's'}`} />
      </SimpleGrid>

      <Paper withBorder p="md">
        <Text fw={700} mb="sm">
          RSVP by function
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {functions.map((f) => (
            <div key={f.id}>
              <Text size="sm" fw={600} mb={4}>
                {f.name}
              </Text>
              <RsvpBar totals={totals[f.id]} compact />
            </div>
          ))}
        </SimpleGrid>
      </Paper>

      <Stack gap="xs">
        <ScrollArea type="never">
          <Chip.Group multiple={false} value={group} onChange={(v) => setGroup(v as string)}>
            <Group gap="xs" wrap="nowrap">
              <Chip value="all" size="sm" variant="light">
                Everyone
              </Chip>
              {groups.map((g) => (
                <Chip key={g} value={g} size="sm" variant="light">
                  {g}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </ScrollArea>
        <Group grow align="flex-end">
          <TextInput placeholder="Search name, family or place" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <Select
            placeholder="Any priority"
            clearable
            data={[
              { value: '1', label: 'Priority 1' },
              { value: '2', label: 'Priority 2' },
              { value: 'none', label: 'Not set' },
            ]}
            value={priority}
            onChange={setPriority}
          />
        </Group>
        {filtered && (
          <Text size="sm" c="dimmed">
            Showing {visible.length} households, {people(visible)} people.
          </Text>
        )}
      </Stack>

      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={860}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Household</Table.Th>
                <Table.Th>Group</Table.Th>
                <Table.Th>Where</Table.Th>
                <Table.Th ta="right">People</Table.Th>
                <Table.Th ta="right">Rooms</Table.Th>
                <Table.Th>Priority</Table.Th>
                <Table.Th>Functions</Table.Th>
                <Table.Th>RSVP</Table.Th>
                {isUnlocked && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((g) => (
                <Table.Tr key={g.id}>
                  <Table.Td>
                    <Text fw={500}>{g.name}</Text>
                    {g.family_members && (
                      <Text size="xs" c="dimmed">
                        {g.family_members}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{g.list_group ?? '—'}</Text>
                    {g.relation && (
                      <Text size="xs" c="dimmed">
                        {g.relation}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{g.location ?? '—'}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {g.persons}
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {Number(g.rooms_inside) > 0 || Number(g.rooms_outside) > 0
                      ? [
                          Number(g.rooms_inside) > 0 ? `${rooms(Number(g.rooms_inside))} in` : null,
                          Number(g.rooms_outside) > 0 ? `${rooms(Number(g.rooms_outside))} out` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '—'}
                  </Table.Td>
                  <Table.Td>
                    {g.priority ? (
                      <Badge variant="light" color={g.priority === 1 ? 'rose' : 'gray'}>
                        Priority {g.priority}
                      </Badge>
                    ) : (
                      <Badge variant="outline" color="gray">
                        Not set
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{g.functions ?? '—'}</Table.Td>
                  <Table.Td>
                    <RsvpCell invites={invitesOf(g.id)} persons={g.persons} />
                  </Table.Td>
                  {isUnlocked && (
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      <Button size="compact-xs" variant="subtle" onClick={() => setRsvpFor(g)}>
                        RSVP
                      </Button>
                      <Button size="compact-xs" variant="subtle" onClick={() => setEditing(g)}>
                        Edit
                      </Button>
                      <Button size="compact-xs" variant="subtle" color="red" onClick={() => remove(g)}>
                        Delete
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {loaded && visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={isUnlocked ? 9 : 8}>
                    <Text c="dimmed">{guests.length === 0 ? 'No guests yet.' : 'No households match.'}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {isUnlocked && editing && (
        <GuestEditor
          key={editing === 'new' ? 'new' : editing.id}
          guest={editing === 'new' ? null : editing}
          side="groom"
          nextOrder={nextOrder}
          opened
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {isUnlocked && rsvpFor && (
        <RsvpEditor
          key={rsvpFor.id}
          guest={rsvpFor}
          functions={functions}
          invites={invites.filter((i) => i.guest_id === rsvpFor.id)}
          opened
          onClose={() => setRsvpFor(null)}
          onSaved={reloadInvites}
        />
      )}
      {isUnlocked && bulk && (
        <BulkInviteModal guestIds={visible.map((g) => g.id)} functions={functions} opened onClose={() => setBulk(false)} onSaved={reloadInvites} />
      )}
    </Stack>
  );
}

// A household's answers in one line, in people: e.g. 2 yes, 1 maybe, 1 no. When its answers differ between
// functions it says so instead of adding them up (that would count the same person more than once).
function RsvpCell({ invites, persons }: { invites: Invite[]; persons: number }) {
  if (invites.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Not invited
      </Text>
    );
  }
  const splits = invites.map((i) => splitOf({ ...i, guests: { persons } }));
  const first = splits[0];
  const same = splits.every((s) => s.coming === first.coming && s.maybe === first.maybe && s.declined === first.declined);
  if (!same) {
    return (
      <Text size="xs" c="dimmed">
        Varies by function
      </Text>
    );
  }
  const parts: [keyof typeof first, (typeof INVITE_ORDER)[number]][] = [
    ['coming', 'confirmed'],
    ['maybe', 'maybe'],
    ['declined', 'declined'],
    ['noReply', 'invited'],
  ];
  return (
    <Group gap={4}>
      {parts.map(([k, status]) =>
        first[k] > 0 ? (
          <Badge key={k} size="sm" variant="light" color={INVITE_COLOR[status]} tt="none">
            {first[k]} {INVITE_LABEL[status].toLowerCase()}
          </Badge>
        ) : null
      )}
    </Group>
  );
}
