import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Chip, Group, Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { GuestEditor, type Guest } from '../components/GuestEditor';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { BulkInviteModal, RsvpEditor, daysFromFunctions, restoreInvites, type InviteSnapshot, type RsvpDay } from '../components/RsvpEditor';
import { RsvpBar } from '../components/RsvpBar';
import { DroppedGuests } from '../components/DroppedGuests';
import { StayPlan } from '../components/StayPlan';
import { INVITE_COLOR, INVITE_LABEL, scaleRooms, splitOf, stayRange, type Invite } from '../lib/rsvp';

type FunctionRef = { name: string; event_date: string };

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
  const [fnRows, setFnRows] = useState<FunctionRef[]>([]);
  const [rsvpFor, setRsvpFor] = useState<Guest | null>(null);
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'invited' | 'dropped'>('invited');
  const [droppedCount, setDroppedCount] = useState(0);
  const { invites, totals, reload: reloadInvites } = useGuestInvites();
  const days = useMemo(() => daysFromFunctions(fnRows), [fnRows]);

  async function loadFunctions() {
    const { data } = await supabase.from('wedding_functions').select('name, event_date').order('sort_order');
    setFnRows((data ?? []) as FunctionRef[]);
  }

  async function load() {
    const { data, error: err } = await supabase.from('guests').select('*').order('sort_order');
    if (err) setError(err.message);
    setGuests((data ?? []) as Guest[]);
    setLoaded(true);
    const { count } = await supabase.from('guests_dropped').select('id', { count: 'exact', head: true });
    setDroppedCount(count ?? 0);
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

  // Rows ticked for a bulk change. Ticks survive filtering, so say how many are out of view.
  const guestIdSet = new Set(guests.map((g) => g.id));
  const selectedIds = [...selected].filter((id) => guestIdSet.has(id));
  const selectedGuests = guests.filter((g) => selected.has(g.id));
  const shownIds = visible.map((g) => g.id);
  const shownSelected = shownIds.filter((id) => selected.has(id)).length;
  const allShownSelected = shownIds.length > 0 && shownSelected === shownIds.length;
  const hiddenSelected = selectedIds.length - shownSelected;

  function toggleRow(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allShownSelected) shownIds.forEach((id) => next.delete(id));
      else shownIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function undoInvites(snapshot: InviteSnapshot) {
    const err = await restoreInvites(snapshot);
    notifications.hide('invites-changed');
    if (err) {
      setError(`Could not undo: ${err}`);
      return;
    }
    await reloadInvites();
    notifications.show({ message: 'Invites put back as they were.', color: 'teal', autoClose: 4000 });
  }

  function invitesChanged(snapshot: InviteSnapshot, summary: string) {
    notifications.show({
      id: 'invites-changed',
      color: 'teal',
      autoClose: 20000,
      withCloseButton: true,
      title: 'Invites updated',
      message: (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm">{summary}.</Text>
          <Button size="compact-sm" variant="light" onClick={() => undoInvites(snapshot)}>
            Undo
          </Button>
        </Group>
      ),
    });
  }

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

  // Per day, for food: people by answer. Rooms are worked out per night in the Rooms by night panel (StayPlan).

  // One row per household with its answer for each day, for sharing with whoever books travel or food.
  function downloadCsv() {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['Household', 'Group', 'Where', 'People', 'Rooms inside', 'Rooms outside'];
    for (const d of days) head.push(`${d.label} yes`, `${d.label} maybe`, `${d.label} no`, `${d.label} no reply`);
    const lines = [head.map(q).join(',')];
    for (const g of visible) {
      const cells: (string | number)[] = [g.name, g.list_group ?? '', g.location ?? '', g.persons, Number(g.rooms_inside), Number(g.rooms_outside)];
      for (const d of days) {
        const inv = invitesOf(g.id).find((i) => i.event_date === d.date);
        if (!inv) cells.push('', '', '', '');
        else {
          const sp = splitOf({ ...inv, guests: { persons: g.persons } });
          cells.push(sp.coming, sp.maybe, sp.declined, sp.noReply);
        }
      }
      lines.push(cells.map(q).join(','));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guest-rsvp-by-day.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
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
        {tab === 'invited' && (
          <Group gap="xs">
            <Button variant="default" onClick={downloadCsv} disabled={visible.length === 0}>
              Download CSV
            </Button>
            {isUnlocked && (
              <>
                <Button onClick={() => setEditing('new')}>Add household</Button>
              </>
            )}
          </Group>
        )}
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as 'invited' | 'dropped')}
        data={[
          { value: 'invited', label: 'Invited list' },
          { value: 'dropped', label: `Dropped from earlier list (${droppedCount})` },
        ]}
      />

      {tab === 'dropped' ? (
        <DroppedGuests onChanged={load} />
      ) : (
        <>
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
        <Text fw={700}>Plan by day</Text>
        <Text size="xs" c="dimmed" mb="sm">
          People, not households. Whoever is coming on a day is at every function that day. Use these for food and travel; rooms are in the next panel.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {days.map((d) => {
            const t = totals[d.date];
            const upTo = t ? t.confirmed + t.maybe + t.invited : 0;
            return (
              <Stack key={d.date} gap={6}>
                <div>
                  <Text size="sm" fw={600}>
                    {d.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {d.functions.join(', ')}
                  </Text>
                </div>
                <RsvpBar totals={t} compact />
                {t && (
                  <Text size="xs">
                    Food: <b>{t.confirmed}</b> confirmed, up to <b>{upTo}</b> if everyone who has not said no comes.
                  </Text>
                )}
              </Stack>
            );
          })}
        </SimpleGrid>
      </Paper>

      <StayPlan guests={guests} invites={invites} />

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

      {isUnlocked && (
        <Paper withBorder p="sm" bg={selectedIds.length > 0 ? 'var(--mantine-color-rose-light)' : undefined}>
          {selectedIds.length === 0 ? (
            <Text size="sm" c="dimmed">
              Tick households to invite them to a day, or to change or remove their invites. Use the box in the table header to tick every household shown.
            </Text>
          ) : (
            <Group justify="space-between" gap="sm">
              <Text size="sm" fw={600}>
                {selectedIds.length} household{selectedIds.length === 1 ? '' : 's'} selected ({people(selectedGuests)} people)
                {hiddenSelected > 0 && (
                  <Text span size="sm" c="dimmed" fw={400}>
                    {' '}
                    · {hiddenSelected} not shown by the current filters
                  </Text>
                )}
              </Text>
              <Group gap="xs">
                <Button size="compact-md" onClick={() => setBulk(true)}>
                  Change invites
                </Button>
                <Button size="compact-md" variant="default" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              </Group>
            </Group>
          )}
        </Paper>
      )}

      <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={860}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                {isUnlocked && (
                  <Table.Th w={40}>
                    <Checkbox
                      aria-label="Select every household shown"
                      checked={allShownSelected}
                      indeterminate={shownSelected > 0 && !allShownSelected}
                      onChange={toggleAllShown}
                    />
                  </Table.Th>
                )}
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
                <Table.Tr key={g.id} bg={selected.has(g.id) ? 'var(--mantine-color-rose-light)' : undefined}>
                  {isUnlocked && (
                    <Table.Td>
                      <Checkbox aria-label={`Select ${g.name}`} checked={selected.has(g.id)} onChange={() => toggleRow(g.id)} />
                    </Table.Td>
                  )}
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
                    <RsvpCell invites={invitesOf(g.id)} persons={g.persons} days={days} />
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
                  <Table.Td colSpan={isUnlocked ? 10 : 8}>
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
          days={days}
          invites={invites.filter((i) => i.guest_id === rsvpFor.id)}
          opened
          onClose={() => setRsvpFor(null)}
          onSaved={reloadInvites}
        />
      )}
      {isUnlocked && bulk && (
        <BulkInviteModal
          guestIds={selectedIds}
          invites={invites}
          days={days}
          opened
          onClose={() => setBulk(false)}
          onSaved={reloadInvites}
          onDone={invitesChanged}
        />
      )}
        </>
      )}
    </Stack>
  );
}

// A household's answer for each day it is invited to, in people: e.g. "Sun 14 Feb: 2 yes, 1 maybe".
function RsvpCell({ invites, persons, days }: { invites: Invite[]; persons: number; days: RsvpDay[] }) {
  if (invites.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Not invited
      </Text>
    );
  }
  const parts = [
    ['coming', 'confirmed'],
    ['maybe', 'maybe'],
    ['declined', 'declined'],
    ['noReply', 'invited'],
  ] as const;
  return (
    <Stack gap={2}>
      {days
        .map((d) => ({ d, inv: invites.find((i) => i.event_date === d.date) }))
        .filter((x) => x.inv)
        .map(({ d, inv }) => {
          const split = splitOf({ ...(inv as Invite), guests: { persons } });
          return (
            <Group key={d.date} gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {d.label}
              </Text>
              {parts.map(([k, status]) =>
                split[k] > 0 ? (
                  <Badge key={k} size="sm" variant="light" color={INVITE_COLOR[status]} tt="none">
                    {split[k]} {INVITE_LABEL[status].toLowerCase()}
                  </Badge>
                ) : null
              )}
            </Group>
          );
        })}
    </Stack>
  );
}
