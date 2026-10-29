import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Collapse, Group, Indicator, Menu, Paper, SegmentedControl, Select, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { GuestEditor, type Guest } from '../components/GuestEditor';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { BulkAnswerModal, BulkInviteModal, RsvpEditor, daysFromFunctions, restoreInvites, type InviteSnapshot } from '../components/RsvpEditor';
import { DroppedGuests } from '../components/DroppedGuests';
import { RoomPlan } from '../components/RoomPlan';
import { RoomForecast } from '../components/RoomForecast';
import { GuestsOverview } from '../components/GuestsOverview';
import { HouseholdList } from '../components/HouseholdList';
import { useGuestStays } from '../hooks/useGuestStays';
import { useStay } from '../hooks/useStay';
import { splitOf } from '../lib/rsvp';
import { allNightsOf, householdNeed } from '../lib/stay';
import { countByStatus, type HouseholdStatus } from '../lib/guestStatus';

type FunctionRef = { name: string; event_date: string; family_only: boolean };
type Tab = 'overview' | 'households' | 'rooms' | 'dropped';
type ListView = 'all' | 'not_invited' | 'waiting' | 'answered';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// The Guests page is three views instead of one long page: Overview (what needs you, replies, each day), Households
// (the list, with each household's answers and room) and Rooms (who sleeps where). Dropped households are one click
// away in the More menu.
export function Guests() {
  const { isUnlocked } = useEditMode();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (['overview', 'households', 'rooms', 'dropped'] as const).find((t) => t === params.get('tab')) ?? 'overview';
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t });

  const [guests, setGuests] = useState<Guest[]>([]);
  const [group, setGroup] = useState('all');
  const [priority, setPriority] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ListView>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Guest | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [fnRows, setFnRows] = useState<FunctionRef[]>([]);
  const [rsvpFor, setRsvpFor] = useState<Guest | null>(null);
  const [bulk, setBulk] = useState(false);
  const [bulkAnswer, setBulkAnswer] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [droppedCount, setDroppedCount] = useState(0);
  const { invites, totals, reload: reloadInvites } = useGuestInvites();
  const { sites, nights } = useStay();
  const { stays, reload: reloadStays } = useGuestStays();
  const days = useMemo(() => daysFromFunctions(fnRows), [fnRows]);

  async function loadFunctions() {
    const { data } = await supabase.from('wedding_functions').select('name, event_date, family_only').order('sort_order');
    setFnRows((data ?? []) as FunctionRef[]);
  }

  async function load() {
    const { data, error: err } = await supabase.from('guests').select('*').order('sort_order');
    if (err) setError(err.message);
    setGuests((data ?? []) as Guest[]);
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
  const answeredCount = counts.coming.households + counts.maybe.households + counts.declined.households;

  const visible = useMemo(
    () =>
      guests
        .filter((g) => {
          const s = statusById[g.id];
          return view === 'all' || (view === 'answered' ? s === 'coming' || s === 'maybe' || s === 'declined' : s === view);
        })
        .filter((g) => group === 'all' || g.list_group === group)
        .filter((g) => !priority || (priority === 'none' ? g.priority === null : String(g.priority) === priority))
        .filter((g) => {
          const q = query.trim().toLowerCase();
          return !q || [g.name, g.family_members, g.location, g.relation].some((v) => v?.toLowerCase().includes(q));
        }),
    [guests, group, priority, query, view, statusById]
  );

  // Households that need rooms and are not fully placed yet: the number on the Rooms tab and the Overview.
  const toPlace = useMemo(() => {
    const all = allNightsOf(nights);
    return guests.filter((g) => {
      const need = householdNeed(g, invites, all);
      if (!need || need.main + need.other <= 0) return false;
      const placed = stays.filter((s) => s.guest_id === g.id).reduce((a, s) => a + Number(s.rooms), 0);
      return placed < need.main + need.other - 0.01;
    }).length;
  }, [guests, invites, nights, stays]);

  const guestIds = new Set(guests.map((g) => g.id));
  const selectedIds = [...selected].filter((id) => guestIds.has(id));
  const selectedGuests = guests.filter((g) => selected.has(g.id));

  function goStatus(s: HouseholdStatus) {
    setView(s === 'not_invited' || s === 'waiting' ? s : 'answered');
    setTab('households');
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

  // One row per household with its answer for each day, for sharing with whoever books travel or food.
  function downloadCsv() {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['Household', 'Group', 'Where', 'People', 'Rooms inside', 'Rooms outside'];
    for (const d of days) head.push(`${d.label} yes`, `${d.label} maybe`, `${d.label} no`, `${d.label} no reply`);
    const lines = [head.map(q).join(',')];
    for (const g of guests) {
      const cells: (string | number)[] = [g.name, g.list_group ?? '', g.location ?? '', g.persons, Number(g.rooms_inside), Number(g.rooms_outside)];
      for (const d of days) {
        const inv = invites.find((i) => i.guest_id === g.id && i.event_date === d.date);
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
  const activeFilters = (group !== 'all' ? 1 : 0) + (priority ? 1 : 0);
  const people = sum(guests.map((g) => g.persons));

  const tabs: { value: Tab; label: string; badge?: string; hot?: boolean }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'households', label: 'Households', badge: String(guests.length) },
    { value: 'rooms', label: 'Rooms', badge: toPlace > 0 ? `${toPlace} to place` : undefined, hot: toPlace > 0 },
  ];

  const views: { value: ListView; label: string; n: number }[] = [
    { value: 'all', label: 'Everyone', n: guests.length },
    { value: 'not_invited', label: 'Not invited yet', n: counts.not_invited.households },
    { value: 'waiting', label: 'Waiting for a reply', n: counts.waiting.households },
    { value: 'answered', label: 'Answered', n: answeredCount },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" gap="sm">
        <div>
          <Title order={1} fz={{ base: 30, sm: 38 }} lh={1.1}>
            Guests
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            Pranjal's side · {people} people in {guests.length} households
          </Text>
        </div>
        <Group gap="xs">
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <Button variant="default" rightSection={<span aria-hidden>▾</span>}>
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={downloadCsv} disabled={guests.length === 0}>
                Download RSVP CSV
              </Menu.Item>
              <Menu.Item onClick={() => setTab('dropped')}>Dropped from earlier list ({droppedCount})</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {isUnlocked && <Button onClick={() => setEditing('new')}>Add household</Button>}
        </Group>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {tab === 'dropped' ? (
        <Stack gap="md">
          <Group>
            <Button variant="subtle" onClick={() => setTab('households')}>
              ← Back to guests
            </Button>
          </Group>
          <DroppedGuests onChanged={load} />
        </Stack>
      ) : (
        <>
          <SegmentedControl hiddenFrom="sm" fullWidth value={tab} onChange={(v) => setTab(v as Tab)} data={tabs.map((t) => ({ value: t.value, label: t.label }))} />
          <Group visibleFrom="sm" gap="xl" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            {tabs.map((t) => {
              const on = tab === t.value;
              return (
                <UnstyledButton
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  aria-current={on ? 'page' : undefined}
                  style={{ padding: '10px 2px 12px', marginBottom: -1, borderBottom: `3px solid ${on ? 'var(--mantine-color-rose-6)' : 'transparent'}` }}
                >
                  <Group gap={8} wrap="nowrap">
                    <Text fw={on ? 700 : 500} c={on ? undefined : 'dimmed'}>
                      {t.label}
                    </Text>
                    {t.badge && (
                      <Text
                        span
                        size="xs"
                        fw={600}
                        px={8}
                        py={2}
                        style={{ borderRadius: 999, background: t.hot ? 'var(--mantine-color-yellow-light)' : 'var(--mantine-color-default-hover)' }}
                        c={t.hot ? 'yellow.9' : undefined}
                      >
                        {t.badge}
                      </Text>
                    )}
                  </Group>
                </UnstyledButton>
              );
            })}
          </Group>

          {tab === 'overview' && (
            <GuestsOverview
              counts={counts}
              households={guests.length}
              people={people}
              toPlace={toPlace}
              days={days}
              totals={totals}
              guests={guests}
              invites={invites}
              sites={sites}
              nights={nights}
              onStatus={goStatus}
              onRooms={() => setTab('rooms')}
            />
          )}

          {tab === 'households' && (
            <Stack gap="md">
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <TextInput
                  style={{ flex: 1 }}
                  size="md"
                  radius="xl"
                  placeholder="Search name, family or place"
                  aria-label="Search households"
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
                <Indicator label={activeFilters} disabled={activeFilters === 0} size={16} color="rose" offset={4}>
                  <Button variant="default" size="md" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                    Filters
                  </Button>
                </Indicator>
              </Group>

              <Collapse expanded={showFilters}>
                <Group grow align="flex-end" pb="xs">
                  <Select label="Group" clearable placeholder="Any group" data={groups} value={group === 'all' ? null : group} onChange={(v) => setGroup(v ?? 'all')} />
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

              <Group gap="xs">
                {views.map((v) => {
                  const on = view === v.value;
                  return (
                    <UnstyledButton
                      key={v.value}
                      onClick={() => setView(v.value)}
                      aria-pressed={on}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 999,
                        border: `1px solid ${on ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-default-border)'}`,
                        background: on ? 'var(--mantine-color-dark-8)' : undefined,
                        color: on ? 'white' : undefined,
                      }}
                    >
                      <Text size="sm" fw={500} span>
                        {v.label}{' '}
                        <Text span fw={700}>
                          {v.n}
                        </Text>
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Group>

              <HouseholdList
                guests={visible}
                invites={invites}
                days={days}
                stays={stays}
                sites={sites}
                nights={nights}
                isUnlocked={isUnlocked}
                selected={selected}
                onSelect={setSelected}
                onAnswer={setRsvpFor}
                onEdit={setEditing}
                onDelete={remove}
              />

              {isUnlocked && selectedIds.length > 0 && (
                <Box style={{ position: 'sticky', bottom: 16, zIndex: 5, display: 'flex', justifyContent: 'center' }}>
                  <Paper
                    p="sm"
                    pl="lg"
                    radius="xl"
                    shadow="lg"
                    style={{ background: 'var(--mantine-color-dark-8)', color: 'white', maxWidth: '100%' }}
                    role="region"
                    aria-label="Selected households"
                  >
                    <Group gap="md" wrap="wrap">
                      <Text fw={600} size="sm">
                        {selectedIds.length} household{selectedIds.length === 1 ? '' : 's'} selected
                      </Text>
                      <Text size="sm" c="gray.4">
                        {sum(selectedGuests.map((g) => g.persons))} {sum(selectedGuests.map((g) => g.persons)) === 1 ? 'person' : 'people'}
                      </Text>
                      <Button size="compact-md" color="gray.0" c="dark.8" onClick={() => setBulkAnswer(true)}>
                        Set answer
                      </Button>
                      <Button size="compact-md" variant="default" color="gray.0" bg="transparent" c="white" onClick={() => setBulk(true)}>
                        Invite to days
                      </Button>
                      {selectedIds.length < visible.length && (
                        <Button size="compact-md" variant="subtle" color="gray.3" onClick={() => setSelected(new Set(visible.map((g) => g.id)))}>
                          Select all {visible.length}
                        </Button>
                      )}
                      <Button size="compact-md" variant="subtle" color="gray.3" onClick={() => setSelected(new Set())}>
                        Clear
                      </Button>
                    </Group>
                  </Paper>
                </Box>
              )}
            </Stack>
          )}

          {tab === 'rooms' && (
            <Stack gap="lg">
              <RoomForecast guests={guests} invites={invites} sites={sites} nights={nights} days={days} />
              <RoomPlan guests={guests} invites={invites} sites={sites} nights={nights} stays={stays} reloadStays={reloadStays} onGuestsChanged={load} />
            </Stack>
          )}
        </>
      )}

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

      {isUnlocked && bulkAnswer && (
        <BulkAnswerModal
          guests={selectedGuests}
          invites={invites}
          days={days}
          opened
          onClose={() => setBulkAnswer(false)}
          onSaved={reloadInvites}
          onDone={invitesChanged}
        />
      )}

      {isUnlocked && bulk && (
        <BulkInviteModal guestIds={selectedIds} invites={invites} days={days} opened onClose={() => setBulk(false)} onSaved={reloadInvites} onDone={invitesChanged} />
      )}
    </Stack>
  );
}
