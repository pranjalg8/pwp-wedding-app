import { useMemo, useState } from 'react';
import { Badge, Button, Group, Paper, Progress, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
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
  const list = [...(show === 'open' ? notPlaced : households)].sort((a, b) => a.g.sort_order - b.g.sort_order);

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

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="sm">
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
            <Button size="compact-md" variant="default" color="red" onClick={clearAll} disabled={stays.length === 0}>
              Clear placements
            </Button>
          </Group>
        )}
      </Group>

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {sites.map((s) => (
          <Paper key={s.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
              <Text fw={600} size="sm">
                {s.name}
              </Text>
              <Badge size="xs" variant="light" color={s.has_lift ? 'teal' : 'orange'}>
                {s.has_lift ? 'Lift' : 'No lift'}
              </Badge>
            </Group>
            <Stack gap={6}>
              {allNights
                .filter((n) => nights.some((x) => x.site_id === s.id && x.night === n))
                .map((n) => {
                  const cap = nights.find((x) => x.site_id === s.id && x.night === n)?.rooms ?? 0;
                  const u = used[s.id]?.[n] ?? 0;
                  return (
                    <div key={n}>
                      <Group justify="space-between" gap="xs">
                        <Text size="xs">{nightLabel(n)}</Text>
                        <Text size="xs" c={u > cap ? 'red' : 'dimmed'} fw={u > cap ? 700 : 400}>
                          {rooms(u)} of {cap}
                          {u > cap ? ' (over)' : ''}
                        </Text>
                      </Group>
                      <Progress
                        value={cap > 0 ? Math.min(100, (u / cap) * 100) : 0}
                        size="sm"
                        color={u > cap ? 'red' : u === cap ? 'teal' : 'rose'}
                        aria-label={`${s.name}, ${nightLabel(n)}: ${rooms(u)} of ${cap} rooms placed`}
                      />
                    </div>
                  );
                })}
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>

      <Group justify="space-between" gap="sm">
        <Text fw={600}>Households</Text>
        <SegmentedControl
          size="xs"
          value={show}
          onChange={(v) => setShow(v as 'open' | 'all')}
          data={[
            { value: 'open', label: `Still to place (${notPlaced.length})` },
            { value: 'all', label: `All (${households.length})` },
          ]}
        />
      </Group>

      {list.length === 0 ? (
        <Text size="sm" c="dimmed">
          {households.length === 0 ? 'No invited household needs rooms yet. Invite households to a day first.' : 'Every household that needs rooms is placed.'}
        </Text>
      ) : (
        <Stack gap="xs">
          {list.map((h) => {
            const stairs = h.g.needs_lift ? h.mine.filter((s) => !siteById[s.site_id]?.has_lift) : [];
            return (
              <Paper key={h.g.id} withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {h.g.name}
                      {h.g.needs_lift && (
                        <Badge ml={6} size="xs" variant="light" color="orange">
                          Needs lift
                        </Badge>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {h.need.people} people · needs {rooms(h.need.main)} main stay + {rooms(h.need.other)} elsewhere · from {nightLabel(h.need.firstNight)}
                    </Text>
                    <Text size="xs" mt={2}>
                      {h.mine.length === 0
                        ? 'Not placed'
                        : h.mine.map((s) => `${siteName[s.site_id]} ${rooms(Number(s.rooms))}`).join(' · ')}
                    </Text>
                    {stairs.length > 0 && (
                      <Text size="xs" c="red">
                        {stairs.map((s) => siteName[s.site_id]).join(', ')} has no lift.
                      </Text>
                    )}
                  </div>
                  <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Badge size="sm" variant="light" tt="none" color={h.state === 'placed' ? 'teal' : h.state === 'partly' ? 'orange' : 'gray'}>
                      {h.state === 'placed' ? 'Placed' : h.state === 'partly' ? `${rooms(h.placed)} of ${rooms(h.wanted)}` : 'Not placed'}
                    </Badge>
                    {isUnlocked && (
                      <Button size="compact-xs" variant="light" onClick={() => setAssigning(h.g)}>
                        Place
                      </Button>
                    )}
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
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
