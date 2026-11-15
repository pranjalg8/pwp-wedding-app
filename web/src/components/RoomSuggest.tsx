import { useMemo, useState } from 'react';
import { Button, Group, Modal, ScrollArea, Stack, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import type { StaySite } from '../lib/stay';
import { householdsNeedingRooms, suggestLayout, type RoomGuest, type RoomStay, type StayRoom } from '../lib/rooms';
import type { Invite } from '../lib/rsvp';
import { UndoMessage } from './UndoMessage';

// Suggest layout: plans the rooms again around the pinned stays and shows what would change before anything is
// written. Applying it can be undone from the toast.
export function RoomSuggestModal({
  guests,
  invites,
  sites,
  rooms,
  roomStays,
  guestNights,
  onClose,
  reload,
}: {
  guests: RoomGuest[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  rooms: StayRoom[];
  roomStays: RoomStay[];
  guestNights: string[];
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const households = useMemo(() => householdsNeedingRooms(guests, invites, guestNights), [guests, invites, guestNights]);
  const out = useMemo(() => suggestLayout(households, rooms, sites, roomStays, guests, guestNights, { fresh }), [households, rooms, sites, roomStays, guests, guestNights, fresh]);
  const nameOf = useMemo(() => new Map(guests.map((g) => [g.id, g.name])), [guests]);
  const label = (ids: string[]) => {
    if (ids.length === 0) return 'no room';
    const byId = new Map(rooms.map((r) => [r.id, r]));
    const siteName = new Map(sites.map((s) => [s.id, s.name.split(',')[0]]));
    return ids.map((id) => `${siteName.get(byId.get(id)?.site_id ?? '') ?? ''} ${byId.get(id)?.label ?? '?'}`.trim()).join(', ');
  };
  const short = out.short.reduce((a, x) => a + x.rooms, 0);
  const nothing = out.rows.length === 0 && out.removeIds.length === 0;

  async function apply() {
    setBusy(true);
    const removed = roomStays.filter((s) => out.removeIds.includes(s.id)).map((s) => ({ room_id: s.room_id, guest_id: s.guest_id, people: s.people, locked: !!s.locked }));
    if (out.removeIds.length > 0) {
      const { error } = await supabase.from('room_stays').delete().in('id', out.removeIds);
      if (error) {
        setBusy(false);
        return notifications.show({ color: 'red', title: 'Could not change rooms', message: error.message });
      }
    }
    let ids: string[] = [];
    if (out.rows.length > 0) {
      const { data, error } = await supabase.from('room_stays').insert(out.rows).select('id');
      if (error) {
        if (removed.length > 0) await supabase.from('room_stays').insert(removed);
        await reload();
        setBusy(false);
        return notifications.show({ color: 'red', title: 'Could not change rooms', message: `${error.message} Nothing was changed.` });
      }
      ids = (data ?? []).map((r) => r.id as string);
    }
    await reload();
    setBusy(false);
    onClose();
    notifications.show({
      color: short > 0 ? 'orange' : 'teal',
      title: 'Layout applied',
      autoClose: 12000,
      message: (
        <UndoMessage
          text={`${out.changes.length} household${out.changes.length === 1 ? '' : 's'} changed.${short > 0 ? ` Still ${short} room${short === 1 ? '' : 's'} short.` : ''}`}
          onUndo={async () => {
            if (ids.length > 0) await supabase.from('room_stays').delete().in('id', ids);
            if (removed.length > 0) await supabase.from('room_stays').insert(removed);
            await reload();
          }}
        />
      ),
    });
  }

  return (
    <Modal opened onClose={onClose} title="Suggest layout" centered size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Plans rooms around the stays you have pinned. Households that need a lift go to the lowest floor with space, and a household's rooms
          go together on one floor. Nothing changes until you press Apply.
        </Text>
        <Switch
          checked={fresh}
          onChange={(e) => setFresh(e.currentTarget.checked)}
          label="Plan everyone not pinned from scratch"
          description="Off: households already well placed stay where they are. On: they can move too, for example to free low floors."
        />
        <Text size="sm">
          <b>{out.changes.length}</b> household{out.changes.length === 1 ? '' : 's'} to change · <b>{out.kept}</b> stay as they are · <b>{out.fixed}</b> pinned or with their own details
          {short > 0 && (
            <Text span c="orange">
              {' '}
              · {short} room{short === 1 ? '' : 's'} still short
            </Text>
          )}
        </Text>
        {out.changes.length > 0 && (
          <ScrollArea.Autosize mah={300} type="auto" offsetScrollbars>
            <Stack gap={4}>
              {out.changes.map((c) => (
                <Text key={c.guest_id} size="sm">
                  <b>{nameOf.get(c.guest_id) ?? 'Household'}</b>: {label(c.from)} → {label(c.to)}
                </Text>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
        {nothing && (
          <Text size="sm" c="dimmed">
            Nothing to change.
          </Text>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void apply()} disabled={nothing} loading={busy}>
            Apply
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
