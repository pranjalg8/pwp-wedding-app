import { useMemo, useState } from 'react';
import { Badge, Box, Button, CloseButton, Group, Progress, ScrollArea, SegmentedControl, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { allNightsOf, householdNeed, suggestPlan, usedByNight, type GuestStay, type StayNight, type StaySite } from '../lib/stay';
import type { Invite } from '../lib/rsvp';
import { StayAssign, SuggestModal, restoreStays } from './StayAssign';

type PlanGuest = {
  id: string;
  name: string;
  persons: number;
  priority: 1 | 2 | null;
  rooms_inside: number | string;
  rooms_outside: number | string;
  needs_lift?: boolean;
  sort_order: number;
};

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const nightLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const nightShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// A household's placements as small badges, or "Not placed".
function Placed({ mine, state, wanted, siteName }: { mine: { id: string; site_id: string; rooms: number | string }[]; state: 'placed' | 'partly' | 'none'; wanted: number; siteName: Record<string, string> }) {
  if (mine.length === 0) {
    return (
      <Badge size="sm" variant="light" color="gray" tt="none">
        Not placed
      </Badge>
    );
  }
  return (
    <Group gap={4}>
      {mine.map((s) => (
        <Badge key={s.id} size="sm" variant="light" tt="none" color={state === 'placed' ? 'teal' : 'orange'}>
          {siteName[s.site_id].split(',')[0]} {rooms(Number(s.rooms))}
        </Badge>
      ))}
      {state === 'partly' && (
        <Text size="xs" c="orange">
          of {rooms(wanted)}
        </Text>
      )}
    </Group>
  );
}

// Step: rooms. Which place each household sleeps at, against what each place has on each night. People who come
// on day 1 stay over and keep their rooms, so a household is placed once and holds those rooms for every night it
// is there. A suggested plan fills it in; each household can then be moved by hand.
export function RoomPlan({
  guests,
  invites,
  sites,
  nights,
  stays,
  reloadStays,
  onGuestsChanged,
}: {
  guests: PlanGuest[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  nights: StayNight[];
  stays: GuestStay[];
  reloadStays: () => Promise<void>;
  onGuestsChanged: () => void;
}) {
  const { isUnlocked } = useEditMode();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [assigning, setAssigning] = useState<PlanGuest | null>(null);
  const [placedAt, setPlacedAt] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestPlan> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allNights = useMemo(() => allNightsOf(nights), [nights]);
  const siteName = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s.name])), [sites]);
  const siteById = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s])), [sites]);
  const names = useMemo(() => Object.fromEntries(guests.map((g) => [g.id, g.name])), [guests]);

  const households = useMemo(
    () =>
      guests
        .map((g) => ({ g, need: householdNeed(g, invites, allNights) }))
        .filter((x): x is { g: PlanGuest; need: NonNullable<ReturnType<typeof householdNeed>> } => !!x.need && x.need.main + x.need.other > 0)
        .map((x) => {
          const mine = stays.filter((s) => s.guest_id === x.g.id);
          const placed = mine.reduce((a, s) => a + Number(s.rooms), 0);
          const wanted = x.need.main + x.need.other;
          const state: 'placed' | 'partly' | 'none' = placed >= wanted - 0.01 ? 'placed' : placed > 0 ? 'partly' : 'none';
          return { ...x, mine, placed, wanted, state };
        }),
    [guests, invites, allNights, stays]
  );

  const nightsOfGuest = useMemo(() => new Map(households.map((h) => [h.g.id, h.need.nights])), [households]);
  const used = useMemo(() => usedByNight(stays, nightsOfGuest, allNights), [stays, nightsOfGuest, allNights]);

  const totalWanted = households.reduce((a, h) => a + h.wanted, 0);
  const totalPlaced = households.reduce((a, h) => a + Math.min(h.placed, h.wanted), 0);
  const notPlaced = households.filter((h) => h.state !== 'placed');
  const base = placedAt ? households.filter((h) => h.mine.some((m) => m.site_id === placedAt)) : show === 'open' ? notPlaced : households;
  const list = [...base].sort((a, b) => a.g.sort_order - b.g.sort_order);

  function suggest() {
    setSuggestion(suggestPlan(guests, invites, sites, nights));
  }

  async function apply() {
    if (!suggestion) return;
    setError(null);
    const before = stays.map((s) => ({ guest_id: s.guest_id, site_id: s.site_id, rooms: Number(s.rooms) }));
    const del = await supabase.from('guest_stays').delete().not('id', 'is', null);
    if (del.error) return setError(del.error.message);
    const ins = await supabase.from('guest_stays').insert(suggestion.rows);
    if (ins.error) {
      await restoreStays(before);
      await reloadStays();
      return setError(ins.error.message);
    }
    setSuggestion(null);
    await reloadStays();
    notifications.show({
      id: 'rooms-applied',
      color: 'teal',
      autoClose: 20000,
      withCloseButton: true,
      title: 'Room plan applied',
      message: (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm">{suggestion.rows.length} placements saved.</Text>
          <Button size="compact-sm" variant="light" onClick={() => undo(before)}>
            Undo
          </Button>
        </Group>
      ),
    });
  }

  async function undo(before: { guest_id: string; site_id: string; rooms: number }[]) {
    const err = await restoreStays(before);
    notifications.hide('rooms-applied');
    await reloadStays();
    if (err) setError(`Could not undo: ${err}`);
    else notifications.show({ message: 'Placements put back as they were.', color: 'teal', autoClose: 4000 });
  }

  async function clearAll() {
    if (!window.confirm(`Remove all ${stays.length} room placements? This is recorded in the activity log.`)) return;
    const { error: err } = await supabase.from('guest_stays').delete().not('id', 'is', null);
    if (err) setError(err.message);
    await reloadStays();
  }

  if (sites.length === 0) return null;

  const pct = totalWanted > 0 ? Math.min(100, (totalPlaced / totalWanted) * 100) : 0;
  const focusSite = placedAt ? siteById[placedAt] : null;

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Group justify="space-between" align="center" gap="sm">
          <Text size="sm">
            <b>{rooms(totalPlaced)}</b> of <b>{rooms(totalWanted)}</b> rooms placed
            {notPlaced.length > 0 && (
              <Text span size="sm" c="dimmed">
                {' '}
                · {notPlaced.length} household{notPlaced.length === 1 ? '' : 's'} still to place
              </Text>
            )}
          </Text>
          {isUnlocked && (
            <Group gap="xs">
              <Button size="compact-md" onClick={suggest} disabled={households.length === 0}>
                Suggest a plan
              </Button>
              <Button size="compact-md" variant="subtle" color="red" onClick={clearAll} disabled={stays.length === 0}>
                Clear all
              </Button>
            </Group>
          )}
        </Group>
        <Progress value={pct} size="sm" color={totalWanted > 0 && totalPlaced >= totalWanted - 0.01 ? 'teal' : 'rose'} aria-label={`${rooms(totalPlaced)} of ${rooms(totalWanted)} rooms placed`} />
      </Stack>

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}

      <Table.ScrollContainer minWidth={290}>
        <Table verticalSpacing={6} horizontalSpacing={6} withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Place</Table.Th>
              {allNights.map((n) => (
                <Table.Th key={n} ta="right" style={{ whiteSpace: 'nowrap' }} title={nightLabel(n)}>
                  {nightShort(n)}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sites.map((s) => (
              <Table.Tr key={s.id} bg={placedAt === s.id ? 'var(--mantine-color-rose-light)' : undefined}>
                <Table.Td>
                  <UnstyledButton onClick={() => setPlacedAt((cur) => (cur === s.id ? null : s.id))} aria-pressed={placedAt === s.id} title="Show the households placed here">
                    <Text size="sm" fw={600} td="underline" style={{ textDecorationStyle: 'dotted', textUnderlineOffset: 3, whiteSpace: 'nowrap' }}>
                      {s.name.split(',')[0].replace(/ Hotel$/, '')}
                    </Text>
                    <Text size="xs" c={s.has_lift ? 'dimmed' : 'orange'}>
                      {s.has_lift ? 'Lift' : 'No lift'}
                    </Text>
                  </UnstyledButton>
                </Table.Td>
                {allNights.map((n) => {
                  const cap = nights.find((x) => x.site_id === s.id && x.night === n)?.rooms ?? 0;
                  const u = used[s.id]?.[n] ?? 0;
                  if (cap === 0) {
                    return (
                      <Table.Td key={n} ta="right">
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      </Table.Td>
                    );
                  }
                  const over = u > cap + 0.01;
                  const full = !over && u >= cap - 0.01;
                  return (
                    <Table.Td key={n} ta="right" style={{ minWidth: 64 }}>
                      <Text size="sm" fw={over ? 700 : 500} c={over ? 'red' : full ? 'teal' : undefined} style={{ whiteSpace: 'nowrap' }}>
                        {rooms(u)} / {cap}
                      </Text>
                      <Progress
                        value={Math.min(100, (u / cap) * 100)}
                        size={4}
                        mt={3}
                        color={over ? 'red' : full ? 'teal' : 'rose'}
                        aria-label={`${s.name}, ${nightLabel(n)}: ${rooms(u)} of ${cap} rooms placed${over ? ', over capacity' : ''}`}
                      />
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Group justify="space-between" gap="sm" wrap="wrap">
        {focusSite ? (
          <Badge size="lg" variant="light" color="rose" tt="none" rightSection={<CloseButton size="xs" aria-label="Show all households" onClick={() => setPlacedAt(null)} />}>
            Placed at {focusSite.name.split(',')[0]}
          </Badge>
        ) : (
          <SegmentedControl
            size="xs"
            value={show}
            onChange={(v) => setShow(v as 'open' | 'all')}
            data={[
              { value: 'open', label: `Still to place (${notPlaced.length})` },
              { value: 'all', label: `All (${households.length})` },
            ]}
          />
        )}
        <Text size="xs" c="dimmed">
          {list.length} household{list.length === 1 ? '' : 's'}
        </Text>
      </Group>

      {list.length === 0 ? (
        <Text size="sm" c="dimmed">
          {households.length === 0
            ? 'No invited household needs rooms yet. Invite households to a day first.'
            : focusSite
              ? 'No household is placed here yet.'
              : 'Every household that needs rooms is placed.'}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={340} type="auto" offsetScrollbars>
          <Table verticalSpacing={6} horizontalSpacing="xs" stickyHeader withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Household</Table.Th>
                <Table.Th visibleFrom="sm">Placed</Table.Th>
                {isUnlocked && <Table.Th w={64} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((h) => {
                const stairs = h.g.needs_lift ? h.mine.filter((s) => !siteById[s.site_id]?.has_lift) : [];
                return (
                  <Table.Tr key={h.g.id}>
                    <Table.Td>
                      <Text fw={500} size="sm" lh={1.3} style={{ overflowWrap: 'anywhere' }}>
                        {h.g.name}
                        {h.g.needs_lift && (
                          <Badge ml={6} size="xs" variant="light" color="orange">
                            Needs lift
                          </Badge>
                        )}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.3}>
                        {h.need.people} {h.need.people === 1 ? 'person' : 'people'} · needs {[h.need.main > 0 ? `${rooms(h.need.main)} main` : null, h.need.other > 0 ? `${rooms(h.need.other)} elsewhere` : null].filter(Boolean).join(' + ')}
                      </Text>
                      <Box hiddenFrom="sm" mt={4}>
                        <Placed mine={h.mine} state={h.state} wanted={h.wanted} siteName={siteName} />
                        {stairs.length > 0 && (
                          <Text size="xs" c="red">
                            {stairs.map((s) => siteName[s.site_id].split(',')[0]).join(', ')} has no lift.
                          </Text>
                        )}
                      </Box>
                    </Table.Td>
                    <Table.Td visibleFrom="sm">
                      <Placed mine={h.mine} state={h.state} wanted={h.wanted} siteName={siteName} />
                      {stairs.length > 0 && (
                        <Text size="xs" c="red">
                          {stairs.map((s) => siteName[s.site_id].split(',')[0]).join(', ')} has no lift.
                        </Text>
                      )}
                    </Table.Td>
                    {isUnlocked && (
                      <Table.Td ta="right">
                        <Button size="compact-xs" variant="light" onClick={() => setAssigning(h.g)}>
                          Place
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}

      {isUnlocked && assigning && (
        <StayAssign
          key={assigning.id}
          guest={assigning}
          sites={sites}
          stays={stays.filter((s) => s.guest_id === assigning.id)}
          need={households.find((h) => h.g.id === assigning.id)?.need ?? householdNeed(assigning, invites, allNights)}
          opened
          onClose={() => setAssigning(null)}
          onSaved={() => {
            reloadStays();
            onGuestsChanged();
          }}
        />
      )}

      {isUnlocked && suggestion && (
        <SuggestModal
          rows={suggestion.rows}
          unplaced={suggestion.unplaced}
          sites={sites}
          names={names}
          currentCount={stays.length}
          opened
          onClose={() => setSuggestion(null)}
          onApply={apply}
        />
      )}
    </Stack>
  );
}
