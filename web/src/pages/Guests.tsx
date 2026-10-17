import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, CloseButton, Collapse, Group, Indicator, Paper, SegmentedControl, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import type { GridApi } from 'ag-grid-community';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { GuestEditor, type Guest } from '../components/GuestEditor';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { BulkInviteModal, RsvpEditor, daysFromFunctions, restoreInvites, type InviteSnapshot } from '../components/RsvpEditor';
import { DroppedGuests } from '../components/DroppedGuests';
import { DayPlan } from '../components/DayPlan';
import { GuestSummary } from '../components/GuestSummary';
import { Section } from '../components/Section';
import { useStay } from '../hooks/useStay';
import { splitOf } from '../lib/rsvp';
import { STATUS_COLOR, STATUS_LABEL, countByStatus, type HouseholdStatus, type HouseholdView } from '../lib/guestStatus';
import { GuestsGrid, type GuestRow } from '../components/GuestsGrid';

type FunctionRef = { name: string; event_date: string };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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
  const [view, setView] = useState<HouseholdView>('all');
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [droppedCount, setDroppedCount] = useState(0);
  const { invites, totals, reload: reloadInvites } = useGuestInvites();
  const { sites, nights } = useStay();
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

  const { counts, statusById } = useMemo(() => countByStatus(guests, invites), [guests, invites]);

  const visible = useMemo(
    () =>
      guests
        .filter((g) => view === 'all' || statusById[g.id] === view)
        .filter((g) => group === 'all' || g.list_group === group)
        .filter((g) => !priority || (priority === 'none' ? g.priority === null : String(g.priority) === priority))
        .filter((g) => {
          const q = query.trim().toLowerCase();
          return !q || [g.name, g.family_members, g.location, g.relation].some((v) => v?.toLowerCase().includes(q));
        }),
    [guests, group, priority, query, view, statusById]
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
  const invitesOf = (id: string) => invites.filter((i) => i.guest_id === id);
  const filtered = visible.length !== guests.length;
  const activeFilters = (group !== 'all' ? 1 : 0) + (priority ? 1 : 0);

  // The summary's status buttons and the list's quick views are the same control: picking one jumps to the list.
  function pickView(v: HouseholdStatus) {
    setView((cur) => (cur === v ? 'all' : v));
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

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
    <Stack gap="xl">
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
            {isUnlocked && <Button onClick={() => setEditing('new')}>Add household</Button>}
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
          <Section step={1} title="Where we stand" hint="Everyone on this side, and how far each household has got. Pick a status to see those households.">
            <GuestSummary counts={counts} households={guests.length} people={people(guests)} view={view} onView={pickView} />
          </Section>

          <Section step={2} title="Day by day" hint="Food and rooms for each day, worked out from the replies so far.">
            <DayPlan days={days} totals={totals} guests={guests} invites={invites} sites={sites} nights={nights} />
          </Section>

          <div ref={listRef} style={{ scrollMarginTop: 72 }}>
            <Section step={3} title="Households" hint="Find a household, set its RSVP, or tick several to change their invites together.">
              <Stack gap="xs">
                <Group gap="xs" wrap="nowrap" align="flex-end">
                  <TextInput style={{ flex: 1 }} placeholder="Search name, family or place" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
                  <Indicator label={activeFilters} disabled={activeFilters === 0} size={16} color="rose" offset={4}>
                    <Button variant="default" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                      Filters
                    </Button>
                  </Indicator>
                </Group>

                <Collapse expanded={showFilters}>
                  <Group grow align="flex-end" pb="xs">
                    <Select
                      label="Group"
                      clearable
                      placeholder="Any group"
                      data={groups}
                      value={group === 'all' ? null : group}
                      onChange={(v) => setGroup(v ?? 'all')}
                    />
                    <Select
                      label="Priority"
                      clearable
                      placeholder="Any priority"
                      data={[
                        { value: '1', label: 'Priority 1' },
                        { value: '2', label: 'Priority 2' },
                        { value: 'none', label: 'Not set' },
                      ]}
                      value={priority}
                      onChange={setPriority}
                    />
                  </Group>
                </Collapse>

                {view !== 'all' && (
                  <Group gap="xs">
                    <Badge size="lg" variant="light" color={STATUS_COLOR[view]} tt="none" rightSection={
                      <CloseButton size="xs" aria-label="Show everyone" onClick={() => setView('all')} />
                    }>
                      {STATUS_LABEL[view]}
                    </Badge>
                  </Group>
                )}

                {filtered && (
                  <Text size="sm" c="dimmed">
                    Showing {visible.length} of {guests.length} households, {people(visible)} people.
                  </Text>
                )}
              </Stack>

              {isUnlocked && (
                <Paper withBorder p="sm" bg={selectedIds.length > 0 ? 'var(--mantine-color-rose-light)' : undefined}>
                  {selectedIds.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Tick households to invite them to a day, or to change or remove their invites together.
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
            </Section>
          </div>

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
