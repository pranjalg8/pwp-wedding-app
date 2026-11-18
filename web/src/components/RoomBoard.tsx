import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Box, Button, Group, Paper, ScrollArea, SegmentedControl, Stack, Text, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { allNightsOf, guestNightsOf, type StayNight, type StaySite } from '../lib/stay';
import type { Invite } from '../lib/rsvp';
import {
  ISSUE_TEXT,
  autoPlace,
  householdsNeedingRooms,
  isProblem,
  occupantsByRoom,
  roomIssues,
  roomOpenOn,
  stateOf,
  type Household,
  type Occupant,
  type RoomGuest,
  type RoomStay,
  type StayRoom,
} from '../lib/rooms';
import { AddRoomsModal, RoomModal } from './RoomModals';
import { RoomSuggestModal } from './RoomSuggest';
import { UndoMessage } from './UndoMessage';

const nightShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const first = (name: string) => name.split(/[\s(-]/)[0] || name;

type Drag = { guestId: string; stayId: string | null };

// Room board: the real rooms at each place, with the households sleeping in each. Households still to place wait
// in a tray; drop one on a room (or pick it, then pick a room) to place it. Pick a night to see who is there that
// night, since households that only come on day 2 take rooms on the last night only.
export function RoomBoard({
  guests,
  invites,
  sites,
  nights,
  rooms,
  roomStays,
  reload,
}: {
  guests: RoomGuest[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  nights: StayNight[];
  rooms: StayRoom[];
  roomStays: RoomStay[];
  reload: () => Promise<void>;
}) {
  const { isUnlocked } = useEditMode();
  const allNights = useMemo(() => allNightsOf(nights), [nights]);
  const guestNights = useMemo(() => guestNightsOf(nights, invites), [nights, invites]);
  const [night, setNight] = useState<string | null>(null);
  const shownNight = night && allNights.includes(night) ? night : (guestNights[guestNights.length - 1] ?? allNights[allNights.length - 1] ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [over, setOverState] = useState<string | null>(null);
  const overRef = useRef<string | null>(null);
  const drag = useRef<Drag | null>(null);
  // dragover fires many times a second; only re-render when the room under the pointer changes.
  const setOver = useCallback((id: string | null) => {
    if (overRef.current === id) return;
    overRef.current = id;
    setOverState(id);
  }, []);

  const households = useMemo(() => householdsNeedingRooms(guests, invites, guestNights), [guests, invites, guestNights]);
  const occ = useMemo(() => occupantsByRoom(roomStays, households, guests, guestNights), [roomStays, households, guests, guestNights]);
  const roomsOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of roomStays) m.set(s.guest_id, (m.get(s.guest_id) ?? 0) + 1);
    return m;
  }, [roomStays]);
  const siteById = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s])), [sites]);

  const rows = useMemo(
    () =>
      households.map((h) => ({ h, placed: roomsOf.get(h.g.id) ?? 0, state: stateOf(roomsOf.get(h.g.id) ?? 0, h.roomsNeeded) })),
    [households, roomsOf]
  );
  const tray = rows
    .filter((r) => r.state === 'none' || r.state === 'partly')
    .sort(
      (a, b) =>
        (a.h.firstNight ?? '').localeCompare(b.h.firstNight ?? '') ||
        b.h.roomsNeeded - a.h.roomsNeeded ||
        (a.h.g.priority ?? 9) - (b.h.g.priority ?? 9) ||
        a.h.g.sort_order - b.h.g.sort_order
    );
  const placedHouseholds = rows.filter((r) => r.state === 'placed' || r.state === 'extra').length;
  const extra = rows.filter((r) => r.state === 'extra').length;

  const issuesByRoom = useMemo(() => {
    const m = new Map<string, ReturnType<typeof roomIssues>>();
    for (const r of rooms) m.set(r.id, roomIssues(r, siteById[r.site_id], occ.get(r.id) ?? [], allNights));
    return m;
  }, [rooms, occ, siteById, allNights]);
  const problems = [...issuesByRoom.values()].filter((i) => i.some(isProblem)).length;

  // Each site's rooms sorted and grouped by floor, and who is in each room on the shown night: worked out once
  // per data change rather than on every render of the board.
  const siteLayouts = useMemo(() => {
    const bySite = new Map<string, StayRoom[]>();
    for (const r of rooms) bySite.set(r.site_id, [...(bySite.get(r.site_id) ?? []), r]);
    return new Map(
      sites.map((site) => {
        const mine = (bySite.get(site.id) ?? []).sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0) || a.sort_order - b.sort_order || a.label.localeCompare(b.label, undefined, { numeric: true }));
        const openRooms = mine.filter((r) => roomOpenOn(r, shownNight));
        const inUse = openRooms.filter((r) => (occ.get(r.id) ?? []).some((o) => o.nights.includes(shownNight))).length;
        const floors = [...new Set(mine.map((r) => r.floor))].map((floor) => ({ floor, rooms: mine.filter((r) => r.floor === floor) }));
        return [site.id, { mine, openCount: openRooms.length, inUse, floors }];
      })
    );
  }, [sites, rooms, occ, shownNight]);
  const tonightByRoom = useMemo(() => {
    const m = new Map<string, Occupant[]>();
    for (const r of rooms) m.set(r.id, (occ.get(r.id) ?? []).filter((o) => o.nights.includes(shownNight)));
    return m;
  }, [rooms, occ, shownNight]);

  async function place(guestId: string, roomId: string) {
    const { error } = await supabase.from('room_stays').insert({ guest_id: guestId, room_id: roomId });
    if (error) {
      notifications.show({ color: 'red', title: 'Could not place', message: error.code === '23505' ? 'That household is already in this room.' : error.message });
      return;
    }
    await reload();
  }

  async function move(stayId: string, roomId: string) {
    const { error } = await supabase.from('room_stays').update({ room_id: roomId, people: null }).eq('id', stayId);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not move', message: error.code === '23505' ? 'That household is already in this room.' : error.message });
      return;
    }
    await reload();
  }

  // Put every household still to place into rooms free on all its nights. Nothing already placed moves.
  async function fill() {
    const plan = autoPlace(households, rooms, sites, occ, roomsOf);
    const placedNow = new Set(plan.rows.map((r) => r.guest_id)).size;
    const shortRooms = plan.short.reduce((a, x) => a + x.rooms, 0);
    if (plan.rows.length === 0) {
      notifications.show({ color: 'orange', title: 'No free rooms', message: 'No household still to place fits in a room free on all its nights.' });
      return;
    }
    const msg =
      `Put ${placedNow} household${placedNow === 1 ? '' : 's'} into ${plan.rows.length} room${plan.rows.length === 1 ? '' : 's'}?` +
      (shortRooms > 0 ? ` ${shortRooms} more room${shortRooms === 1 ? '' : 's'} would still be needed.` : '') +
      (plan.tight.length > 0 ? ` ${plan.tight.length} room${plan.tight.length === 1 ? '' : 's'} would hold more people than set for.` : '') +
      ' Households already in rooms stay where they are.';
    if (!window.confirm(msg)) return;
    const { data, error } = await supabase.from('room_stays').insert(plan.rows).select('id');
    if (error) {
      notifications.show({ color: 'red', title: 'Could not fill rooms', message: error.message });
      return;
    }
    const ids = (data ?? []).map((r) => r.id as string);
    notifications.show({
      color: shortRooms > 0 ? 'orange' : 'teal',
      title: 'Rooms filled',
      autoClose: 10000,
      message: (
        <UndoMessage
          text={`${placedNow} household${placedNow === 1 ? '' : 's'} placed.${shortRooms > 0 ? ` Still ${shortRooms} room${shortRooms === 1 ? '' : 's'} short.` : ''}`}
          onUndo={async () => {
            const { error: err } = await supabase.from('room_stays').delete().in('id', ids);
            if (err) notifications.show({ color: 'red', title: 'Could not undo', message: err.message });
            await reload();
          }}
        />
      ),
    });
    await reload();
  }

  function dropOn(room: StayRoom) {
    const d = drag.current;
    drag.current = null;
    setOver(null);
    if (!d || !isUnlocked) return;
    if (d.stayId) {
      const here = occ.get(room.id) ?? [];
      if (here.some((o) => o.guest.id === d.guestId)) return;
      void move(d.stayId, room.id);
    } else void place(d.guestId, room.id);
  }

  function clickRoom(room: StayRoom) {
    if (isUnlocked && picked) {
      void place(picked, room.id);
      setPicked(null);
    } else setOpenRoom(room.id);
  }

  // Stable handlers for the memoised tiles; they call the latest clickRoom/dropOn.
  const latest = useRef({ clickRoom, dropOn });
  useEffect(() => {
    latest.current = { clickRoom, dropOn };
  });
  const onTileClick = useCallback((room: StayRoom) => latest.current.clickRoom(room), []);
  const onTileDrop = useCallback((room: StayRoom) => latest.current.dropOn(room), []);
  const onTileDragOver = useCallback((room: StayRoom) => setOver(room.id), [setOver]);
  const onTileDragLeave = useCallback((room: StayRoom) => {
    if (overRef.current === room.id) setOver(null);
  }, [setOver]);
  const onDragOccupant = useCallback((o: Occupant) => {
    drag.current = { guestId: o.guest.id, stayId: o.stay.id };
  }, []);

  const pickedHousehold = picked ? households.find((h) => h.g.id === picked) : null;
  const total = rows.length;
  const openRoomRow = openRoom ? rooms.find((r) => r.id === openRoom) : undefined;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
        <Stack gap={2}>
          <Text size="sm">
            <b>{placedHouseholds}</b> of <b>{total}</b> households in a room
            {tray.length > 0 && (
              <Text span size="sm" c="dimmed">
                {' '}
                · {tray.length} still to place
              </Text>
            )}
          </Text>
          {(problems > 0 || extra > 0) && (
            <Text size="xs" c="orange">
              {[problems > 0 ? `${problems} room${problems === 1 ? '' : 's'} to check` : null, extra > 0 ? `${extra} household${extra === 1 ? ' has' : 's have'} more rooms than needed` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </Stack>
        <Group gap="xs">
          {allNights.length > 0 && (
            <SegmentedControl size="xs" value={shownNight} onChange={setNight} data={allNights.map((n) => ({ value: n, label: nightShort(n) }))} aria-label="Night" />
          )}
          {isUnlocked && tray.length > 0 && rooms.length > 0 && (
            <Button size="compact-md" onClick={() => void fill()}>
              Fill rooms
            </Button>
          )}
          {isUnlocked && rooms.length > 0 && households.length > 0 && (
            <Button size="compact-md" variant="light" onClick={() => setSuggesting(true)}>
              Suggest layout
            </Button>
          )}
          {isUnlocked && (
            <Button size="compact-md" variant="light" onClick={() => setAdding(true)}>
              Add rooms
            </Button>
          )}
        </Group>
      </Group>

      {!isUnlocked && (
        <Text size="xs" c="dimmed">
          Unlock edit mode to place households in rooms. You can still open a room to see who is in it.
        </Text>
      )}

      {pickedHousehold && (
        <Alert color="rose" variant="light" py={6} withCloseButton onClose={() => setPicked(null)} closeButtonLabel="Cancel">
          Placing <b>{pickedHousehold.g.name}</b> ({pickedHousehold.people} {pickedHousehold.people === 1 ? 'person' : 'people'}, {pickedHousehold.roomsNeeded} room{pickedHousehold.roomsNeeded === 1 ? '' : 's'}). Pick a room.
        </Alert>
      )}

      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--mantine-spacing-md)', alignItems: 'start' }}>
        <Paper withBorder p="sm" radius="md" style={{ gridColumn: '1 / -1' }}>
          <Group justify="space-between" mb={6}>
            <Text fw={600} size="sm">
              To place ({tray.length})
            </Text>
            <Text size="xs" c="dimmed">
              {isUnlocked ? 'Drag onto a room, or tap one and then tap a room' : 'Unlock to place'}
            </Text>
          </Group>
          {tray.length === 0 ? (
            <Text size="sm" c="dimmed">
              {total === 0 ? 'No invited household needs rooms yet.' : 'Every household that needs rooms is in a room.'}
            </Text>
          ) : (
            <ScrollArea.Autosize mah={170} type="auto" offsetScrollbars>
              <Group gap={6}>
                {tray.map(({ h, placed }) => (
                  <HouseholdChip
                    key={h.g.id}
                    h={h}
                    placed={placed}
                    selected={picked === h.g.id}
                    canDrag={isUnlocked}
                    onPick={() => isUnlocked && setPicked((cur) => (cur === h.g.id ? null : h.g.id))}
                    onDragStart={() => (drag.current = { guestId: h.g.id, stayId: null })}
                    allNights={guestNights}
                  />
                ))}
              </Group>
            </ScrollArea.Autosize>
          )}
        </Paper>

        {sites.map((site) => {
          const { mine, openCount, inUse, floors } = siteLayouts.get(site.id)!;
          return (
            <Paper key={site.id} withBorder p="sm" radius="md" style={{ gridColumn: '1 / -1' }}>
              <Group justify="space-between" mb={8} gap="xs">
                <Group gap={8}>
                  <Text fw={600}>{site.name.split(',')[0]}</Text>
                  <Badge size="xs" variant="light" color={site.has_lift ? 'gray' : 'orange'}>
                    {site.has_lift ? 'Lift' : 'No lift'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {inUse} of {openCount} rooms in use on {shownNight ? nightShort(shownNight) : ''}
                </Text>
              </Group>
              {mine.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No rooms added here yet.
                </Text>
              ) : (
                <Stack gap="sm">
                  {floors.map(({ floor, rooms: floorRooms }) => (
                    <Box key={String(floor)}>
                      {floors.length > 1 && (
                        <Text size="xs" c="dimmed" mb={4}>
                          {floor === null ? 'Floor not set' : `Floor ${floor}`}
                        </Text>
                      )}
                      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 8 }}>
                        {floorRooms.map((room) => (
                          <RoomTile
                            key={room.id}
                            room={room}
                            night={shownNight}
                            occupants={tonightByRoom.get(room.id) ?? NO_OCCUPANTS}
                            issues={issuesByRoom.get(room.id) ?? NO_ISSUES}
                            highlight={over === room.id}
                            canDrop={isUnlocked}
                            onClick={onTileClick}
                            onDragOver={onTileDragOver}
                            onDragLeave={onTileDragLeave}
                            onDrop={onTileDrop}
                            onDragOccupant={onDragOccupant}
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          );
        })}
      </Box>

      {openRoom && openRoomRow && (
        <RoomModal
          key={openRoom}
          room={openRoomRow}
          site={siteById[openRoomRow.site_id]}
          occupants={occ.get(openRoom) ?? []}
          households={households}
          roomsOf={roomsOf}
          allNights={allNights}
          editable={isUnlocked}
          onClose={() => setOpenRoom(null)}
          reload={reload}
        />
      )}
      {suggesting && isUnlocked && (
        <RoomSuggestModal guests={guests} invites={invites} sites={sites} rooms={rooms} roomStays={roomStays} guestNights={guestNights} onClose={() => setSuggesting(false)} reload={reload} />
      )}
      {adding && isUnlocked && <AddRoomsModal sites={sites} rooms={rooms} allNights={allNights} onClose={() => setAdding(false)} reload={reload} />}
    </Stack>
  );
}

function HouseholdChip({
  h,
  placed,
  selected,
  canDrag,
  onPick,
  onDragStart,
  allNights,
}: {
  h: Household;
  placed: number;
  selected: boolean;
  canDrag: boolean;
  onPick: () => void;
  onDragStart: () => void;
  allNights: string[];
}) {
  const late = h.firstNight && allNights.length > 0 && h.firstNight > allNights[0];
  return (
    <UnstyledButton
      draggable={canDrag}
      onDragStart={onDragStart}
      onClick={onPick}
      aria-pressed={selected}
      title={h.g.name}
      style={{
        border: `1px solid ${selected ? 'var(--mantine-color-rose-6)' : 'var(--mantine-color-default-border)'}`,
        background: selected ? 'var(--mantine-color-rose-light)' : 'var(--mantine-color-body)',
        borderRadius: 8,
        padding: '4px 8px',
        cursor: canDrag ? 'grab' : 'default',
        maxWidth: 230,
      }}
    >
      <Text size="sm" fw={500} lh={1.25} truncate>
        {h.g.name}
      </Text>
      <Text size="xs" c="dimmed" lh={1.25}>
        {h.people} {h.people === 1 ? 'person' : 'people'} · {placed > 0 ? `${placed} of ${h.roomsNeeded}` : h.roomsNeeded} room{h.roomsNeeded === 1 ? '' : 's'}
        {late && h.firstNight ? ` · from ${nightShort(h.firstNight)}` : ''}
        {h.g.needs_lift ? ' · lift' : ''}
      </Text>
    </UnstyledButton>
  );
}

const NO_OCCUPANTS: Occupant[] = [];
const NO_ISSUES: ReturnType<typeof roomIssues> = [];

// Memoised: during a drag only the tile entering or leaving the highlight re-renders.
const RoomTile = memo(function RoomTile({
  room,
  night,
  occupants,
  issues,
  highlight,
  canDrop,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragOccupant,
}: {
  room: StayRoom;
  night: string;
  occupants: Occupant[];
  issues: ReturnType<typeof roomIssues>;
  highlight: boolean;
  canDrop: boolean;
  onClick: (room: StayRoom) => void;
  onDragOver: (room: StayRoom) => void;
  onDragLeave: (room: StayRoom) => void;
  onDrop: (room: StayRoom) => void;
  onDragOccupant: (o: Occupant) => void;
}) {
  const closed = !roomOpenOn(room, night);
  const problem = issues.some(isProblem);
  const people = occupants.reduce((a, o) => a + o.people, 0);
  const border = highlight ? 'var(--mantine-color-rose-6)' : problem ? 'var(--mantine-color-red-6)' : occupants.length > 0 ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-default-border)';
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Room ${room.label}, ${occupants.length === 0 ? 'empty' : `${people} of ${room.capacity} people`}${closed ? ', not open this night' : ''}${issues.filter(isProblem).map((i) => `, ${ISSUE_TEXT[i]}`).join('')}`}
      onClick={() => onClick(room)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(room);
        }
      }}
      onDragOver={(e) => {
        if (!canDrop || closed) return;
        e.preventDefault();
        onDragOver(room);
      }}
      onDragLeave={() => onDragLeave(room)}
      onDrop={(e) => {
        e.preventDefault();
        if (!closed) onDrop(room);
      }}
      style={{
        border: `1.5px ${occupants.length === 0 ? 'dashed' : 'solid'} ${border}`,
        borderRadius: 8,
        padding: '5px 7px',
        minHeight: 64,
        cursor: 'pointer',
        opacity: closed ? 0.45 : 1,
        background: highlight ? 'var(--mantine-color-rose-light)' : 'var(--mantine-color-body)',
      }}
    >
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Text size="xs" fw={700}>
          {room.label}
        </Text>
        <Text size="xs" c={people > room.capacity ? 'red' : 'dimmed'}>
          {closed ? (room.available_from && night < room.available_from ? `from ${nightShort(room.available_from)}` : 'closed') : `${people}/${room.capacity}`}
        </Text>
      </Group>
      <Stack gap={2} mt={2}>
        {occupants.map((o) => (
          <Text
            key={o.stay.id}
            size="xs"
            lh={1.25}
            truncate
            draggable={canDrop}
            onDragStart={(e) => {
              e.stopPropagation();
              onDragOccupant(o);
            }}
            title={`${o.guest.name} (${o.people})`}
            style={{ cursor: canDrop ? 'grab' : undefined }}
          >
            {first(o.guest.name)} · {o.people}
            {o.stay.locked ? ' · pinned' : ''}
          </Text>
        ))}
      </Stack>
      {issues.some((i) => i === 'stairs' || i === 'not_open') && (
        <Text size="10px" c="red" lh={1.2} mt={2}>
          {issues.includes('stairs') ? 'No lift' : 'Night not open'}
        </Text>
      )}
    </Box>
  );
});
