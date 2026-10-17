import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Chip, Group, Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import type { GridApi } from 'ag-grid-community';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { GuestEditor, type Guest } from '../components/GuestEditor';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { BulkInviteModal, RsvpEditor, daysFromFunctions, restoreInvites, type InviteSnapshot } from '../components/RsvpEditor';
import { RsvpBar } from '../components/RsvpBar';
import { DroppedGuests } from '../components/DroppedGuests';
import { StayPlan } from '../components/StayPlan';
import { scaleRooms, splitOf, stayRange } from '../lib/rsvp';
import { GuestsGrid, type GuestRow } from '../components/GuestsGrid';

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
  const [displayed, setDisplayed] = useState<Set<string>>(new Set());
  const gridApi = useRef<GridApi<GuestRow> | null>(null);
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

  const visible = useMemo(
    () =>
      guests
        .filter((g) => group === 'all' || g.list_group === group)
        .filter((g) => !priority || (priority === 'none' ? g.priority === null : String(g.priority) === priority))
        .filter((g) => {
          const q = query.trim().toLowerCase();
          return !q || [g.name, g.family_members, g.location, g.relation].some((v) => v?.toLowerCase().includes(q));
        }),
    [guests, group, priority, query]
  );

  // Rows ticked for a bulk change (the grid owns the ticks). Ticks survive the grid's own column filters,
  // so say how many ticked households are out of view.
  const guestIdSet = new Set(guests.map((g) => g.id));
  const selectedIds = [...selected].filter((id) => guestIdSet.has(id));
  const selectedGuests = guests.filter((g) => selected.has(g.id));
  const hiddenSelected = selectedIds.filter((id) => !displayed.has(id)).length;

  const onSelectionChange = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const onDisplayedChange = useCallback((ids: string[]) => setDisplayed(new Set(ids)), []);
  const onGridReady = useCallback((api: GridApi<GuestRow>) => {
    gridApi.current = api;
  }, []);

  // The grid's handlers stay the same function between renders, so the grid does not refresh its cells for nothing.
  const latest = useRef({ rsvp: (g: Guest) => setRsvpFor(g), edit: (g: Guest) => setEditing(g), del: (g: Guest) => remove(g) });
  useEffect(() => {
    latest.current = { rsvp: (g) => setRsvpFor(g), edit: (g) => setEditing(g), del: (g) => remove(g) };
  });
  const onRsvp = useCallback((g: Guest) => latest.current.rsvp(g), []);
  const onEdit = useCallback((g: Guest) => latest.current.edit(g), []);
  const onDelete = useCallback((g: Guest) => latest.current.del(g), []);

  // One row per household, carrying its RSVP answers, so the grid refreshes a row when its answers change.
  const gridRows = useMemo<GuestRow[]>(() => visible.map((g) => ({ ...g, _invites: invites.filter((i) => i.guest_id === g.id) })), [visible, invites]);

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
              Download RSVP CSV
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
              Tick households in the table to invite them to a day, or to change or remove their invites. The box in the table header ticks every household that matches the filters.
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
                <Button size="compact-md" variant="default" onClick={() => gridApi.current?.deselectAll()}>
                  Clear selection
                </Button>
              </Group>
            </Group>
          )}
        </Paper>
      )}

      <GuestsGrid
        rows={gridRows}
        days={days}
        isUnlocked={isUnlocked}
        onSelectionChange={onSelectionChange}
        onDisplayedChange={onDisplayedChange}
        onReady={onGridReady}
        onRsvp={onRsvp}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {loaded && guests.length === 0 && <Text c="dimmed">No guests yet.</Text>}

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
