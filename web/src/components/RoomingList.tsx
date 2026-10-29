import { useMemo, useState } from 'react';
import { Button, Group, SegmentedControl, Stack, Switch, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { allNightsOf, type StayNight, type StaySite } from '../lib/stay';
import type { Invite } from '../lib/rsvp';
import { householdsNeedingRooms, occupantsByRoom, roomingCsv, roomingHtml, roomingRows, type RoomGuest, type RoomStay, type StayRoom } from '../lib/rooms';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The rooming list for a hotel: one row per room that has someone in it, with the guests, check in and check out.
// Download it as a spreadsheet, print it or save it as a PDF, or copy it as text for WhatsApp or email.
export function RoomingList({
  guests,
  invites,
  sites,
  nights,
  rooms,
  roomStays,
}: {
  guests: RoomGuest[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  nights: StayNight[];
  rooms: StayRoom[];
  roomStays: RoomStay[];
}) {
  const allNights = useMemo(() => allNightsOf(nights), [nights]);
  const [siteId, setSiteId] = useState<string>('all');
  const [members, setMembers] = useState(true);

  const households = useMemo(() => householdsNeedingRooms(guests, invites, allNights), [guests, invites, allNights]);
  const occ = useMemo(() => occupantsByRoom(roomStays, households, guests, allNights), [roomStays, households, guests, allNights]);
  const chosen = siteId === 'all' ? sites : sites.filter((s) => s.id === siteId);
  const rows = useMemo(() => roomingRows(chosen, rooms, occ, allNights, members), [chosen, rooms, occ, allNights, members]);
  const people = rows.reduce((a, r) => a + r.people, 0);
  const title = siteId === 'all' ? 'Rooming list: all places' : `Rooming list: ${chosen[0]?.name ?? ''}`;
  const fileBase = siteId === 'all' ? 'rooming-list' : `rooming-list-${slug(chosen[0]?.name ?? 'hotel')}`;

  function print() {
    const w = window.open('', '_blank');
    if (!w) {
      notifications.show({ color: 'red', message: 'Allow pop-ups to print the list, or download the spreadsheet instead.' });
      return;
    }
    w.document.write(roomingHtml(title, rows));
    w.document.close();
    w.focus();
    w.print();
  }

  async function copy() {
    const text = [title, ...rows.map((r) => `${siteId === 'all' ? `${r.site.split(',')[0]} ` : ''}${r.room}${r.floor ? ` (floor ${r.floor})` : ''}: ${r.guests}. ${r.checkIn} to ${r.checkOut}.`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({ color: 'teal', message: 'Rooming list copied.', autoClose: 3000 });
    } catch {
      notifications.show({ color: 'red', message: 'Could not copy. Download the spreadsheet instead.' });
    }
  }

  const empty = rooms.length === 0 || roomStays.length === 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={siteId}
          onChange={setSiteId}
          data={[{ value: 'all', label: 'All places' }, ...sites.map((s) => ({ value: s.id, label: s.name.split(',')[0].replace(/ Hotel$/, '') }))]}
        />
        <Switch size="xs" checked={members} onChange={(e) => setMembers(e.currentTarget.checked)} label="Include family names" />
      </Group>

      <Group justify="space-between" gap="sm" wrap="wrap">
        <Text size="sm">
          <b>{rows.length}</b> room{rows.length === 1 ? '' : 's'} · <b>{people}</b> {people === 1 ? 'person' : 'people'}
        </Text>
        <Group gap="xs">
          <Button size="compact-md" variant="light" disabled={rows.length === 0} onClick={() => download(`${fileBase}.csv`, roomingCsv(rows), 'text/csv;charset=utf-8')}>
            Download spreadsheet
          </Button>
          <Button size="compact-md" variant="light" disabled={rows.length === 0} onClick={print}>
            Print or save PDF
          </Button>
          <Button size="compact-md" variant="subtle" disabled={rows.length === 0} onClick={copy}>
            Copy text
          </Button>
        </Group>
      </Group>

      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          {empty ? 'Nothing to list yet. Place households in rooms on the Room board and they appear here.' : 'No room is in use at this place yet.'}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders>
            <Table.Thead>
              <Table.Tr>
                {siteId === 'all' && <Table.Th>Place</Table.Th>}
                <Table.Th>Room</Table.Th>
                <Table.Th>Guests</Table.Th>
                <Table.Th ta="right">People</Table.Th>
                <Table.Th>Stay</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={`${r.site}-${r.room}`}>
                  {siteId === 'all' && (
                    <Table.Td>
                      <Text size="sm">{r.site.split(',')[0]}</Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {r.room}
                    </Text>
                    {r.floor && (
                      <Text size="xs" c="dimmed">
                        Floor {r.floor}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {r.guests}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{r.people}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    {r.checkIn} to {r.checkOut}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {r.notes}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
