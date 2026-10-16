import { Badge, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useStay } from '../hooks/useStay';
import { roomsAvailable, roomsWanted } from '../lib/stay';
import type { Invite } from '../lib/rsvp';

type GuestRooms = { id: string; persons: number; rooms_inside: number | string; rooms_outside: number | string };

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', opts);

// One side (main stay or elsewhere) on one night: rooms we have against rooms the invited households need.
function Cell({ have, least, most }: { have: number; least: number; most: number }) {
  let verdict: { color: string; text: string } | null = null;
  if (most > 0) {
    if (most <= have) verdict = { color: 'teal', text: 'Enough' };
    else if (least <= have) verdict = { color: 'orange', text: `Up to ${Math.ceil(most - have)} short` };
    else verdict = { color: 'red', text: `${Math.ceil(least - have)} short` };
  }
  return (
    <Stack gap={2}>
      <Text size="sm">
        <b>{have}</b> rooms
      </Text>
      <Text size="xs" c="dimmed">
        {most > 0 ? `Wanted: ${rooms(least)} confirmed, up to ${rooms(most)}` : 'No one invited yet'}
      </Text>
      {verdict && (
        <Badge size="sm" variant="light" color={verdict.color} tt="none" w="fit-content">
          {verdict.text}
        </Badge>
      )}
    </Stack>
  );
}

// Rooms by night against the RSVPs, then the places themselves. Read-only for now.
export function StayPlan({ guests, invites }: { guests: GuestRooms[]; invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[] }) {
  const { sites, nights } = useStay();
  const dates = [...new Set(nights.map((n) => n.night))].sort();
  if (sites.length === 0) return null;

  return (
    <Paper withBorder p="md">
      <Text fw={700}>Rooms by night</Text>
      <Text size="xs" c="dimmed" mb="sm">
        Everyone checks out on 16 Feb. People who come on day 1 stay over to day 2 and keep their rooms; households that only come on day 2 take
        the extra rooms. "Main stay" is the rooms-inside column of the guest list (Royal Pepper), "elsewhere" the rooms-outside column (Shri Kanth
        and Hotel Sai).
      </Text>

      <Stack gap="md">
        {dates.map((date) => {
          const have = roomsAvailable(sites, nights, date);
          const least = roomsWanted(guests, invites, date, 'least');
          const most = roomsWanted(guests, invites, date, 'most');
          return (
            <Paper key={date} withBorder p="sm" radius="md">
              <Text fw={600}>{dayLabel(date)}</Text>
              <Text size="xs" c="dimmed" mb="xs">
                {have.bySite.map((x) => `${x.site.name.split(',')[0]} ${x.rooms}`).join(' · ')}
              </Text>
              <SimpleGrid cols={2} spacing="md">
                <div>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4} style={{ letterSpacing: 0.5 }}>
                    Main stay
                  </Text>
                  <Cell have={have.main} least={least.main} most={most.main} />
                </div>
                <div>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4} style={{ letterSpacing: 0.5 }}>
                    Elsewhere
                  </Text>
                  <Cell have={have.other} least={least.other} most={most.other} />
                </div>
              </SimpleGrid>
            </Paper>
          );
        })}
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" mt="md">
        {sites.map((s) => (
          <Paper key={s.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
              <Text fw={600}>{s.name}</Text>
              <Group gap={4} wrap="nowrap">
                <Badge size="xs" variant="light" color={s.role === 'main' ? 'rose' : 'gray'}>
                  {s.role === 'main' ? 'Main stay' : 'Elsewhere'}
                </Badge>
                <Badge size="xs" variant="light" color={s.has_lift ? 'teal' : 'orange'}>
                  {s.has_lift ? 'Lift' : 'No lift'}
                </Badge>
              </Group>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {nights
                .filter((n) => n.site_id === s.id)
                .map((n) => `${dayLabel(n.night, { day: 'numeric', month: 'short' })}: ${n.rooms}`)
                .join(' · ')}
              {s.floors ? ` · ${s.floors}` : ''}
            </Text>
            <Text size="xs" mt={4}>
              {[s.people_per_room ? `${s.people_per_room} people a room` : null, s.distance_note].filter(Boolean).join(' · ')}
            </Text>
            {s.booking_note && (
              <Text size="xs" mt={4}>
                {s.booking_note}
              </Text>
            )}
            {s.notes && (
              <Text size="xs" c="dimmed" mt={4}>
                {s.notes}
              </Text>
            )}
          </Paper>
        ))}
      </SimpleGrid>
    </Paper>
  );
}
