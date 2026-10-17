import { useState } from 'react';
import { Accordion, Anchor, Badge, Collapse, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { roomsAvailable, roomsWanted, type StayNight, type StaySite } from '../lib/stay';
import { RsvpBar } from './RsvpBar';
import type { Invite, RsvpTotals } from '../lib/rsvp';
import type { RsvpDay } from './RsvpEditor';

type GuestRooms = { id: string; persons: number; rooms_inside: number | string; rooms_outside: number | string };

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', opts);

const LABEL_STYLE = { letterSpacing: 0.5 } as const;

// A column heading on wide screens, and the same words as a small label above the value on a phone.
function Cell({ label, empty = false, children }: { label: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className={empty ? 'dayplan-empty' : undefined}>
      <Text hiddenFrom="sm" size="xs" tt="uppercase" fw={600} c="dimmed" mb={2} style={LABEL_STYLE}>
        {label}
      </Text>
      {children}
    </div>
  );
}

// Rooms we have against rooms the invited households need on a night.
function Rooms({ have, least, most }: { have: number; least: number; most: number }) {
  if (have === 0 && most === 0) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
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
        {most > 0 ? `Need ${rooms(least)} to ${rooms(most)}` : 'No one invited yet'}
      </Text>
      {verdict && (
        <Badge size="sm" variant="light" color={verdict.color} tt="none" w="fit-content">
          {verdict.text}
        </Badge>
      )}
    </Stack>
  );
}

// Step 2: day by day. One table that puts people, food and rooms side by side, so you read across a day to see
// whether it works and down the days to see how it builds. The places behind the room numbers are folded away.
export function DayPlan({
  days,
  totals,
  guests,
  invites,
  sites,
  nights,
}: {
  days: RsvpDay[];
  totals: Record<string, RsvpTotals>;
  guests: GuestRooms[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  nights: StayNight[];
}) {
  const [how, setHow] = useState(false);
  const dates = [...new Set([...days.map((d) => d.date), ...nights.map((n) => n.night)])].sort();
  if (dates.length === 0) return null;

  return (
    <Paper withBorder p="lg">
      <div className="dayplan-head">
        {['Day', 'People', 'Food', 'Rooms: main stay', 'Rooms: elsewhere'].map((h) => (
          <Text key={h} size="xs" tt="uppercase" fw={600} c="dimmed" style={LABEL_STYLE}>
            {h}
          </Text>
        ))}
      </div>

      {dates.map((date) => {
        const day = days.find((d) => d.date === date);
        const t = totals[date];
        const have = roomsAvailable(sites, nights, date);
        const least = roomsWanted(guests, invites, date, 'least');
        const most = roomsWanted(guests, invites, date, 'most');
        const upTo = t ? t.confirmed + t.maybe + t.invited : 0;
        return (
          <div key={date} className="dayplan-row">
            <Cell label="Day">
              <Text fw={600}>{dayLabel(date)}</Text>
              <Text size="xs" c="dimmed">
                {day ? day.functions.join(', ') : 'Night before, no function'}
              </Text>
            </Cell>
            <Cell label="People" empty={!t}>
              {t ? (
                <RsvpBar totals={t} compact />
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              )}
            </Cell>
            <Cell label="Food" empty={!t}>
              {t ? (
                <Stack gap={0}>
                  <Text size="sm">
                    <b>{t.confirmed}</b> confirmed
                  </Text>
                  <Text size="xs" c="dimmed">
                    up to {upTo} if everyone who has not said no comes
                  </Text>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              )}
            </Cell>
            <Cell label="Rooms: main stay" empty={have.main === 0 && most.main === 0}>
              <Rooms have={have.main} least={least.main} most={most.main} />
            </Cell>
            <Cell label="Rooms: elsewhere" empty={have.other === 0 && most.other === 0}>
              <Rooms have={have.other} least={least.other} most={most.other} />
            </Cell>
          </div>
        );
      })}

      <Divider my="sm" />
      <Anchor component="button" type="button" size="xs" onClick={() => setHow((v) => !v)}>
        {how ? 'Hide how this is worked out' : 'How is this worked out?'}
      </Anchor>
      <Collapse expanded={how}>
        <Text size="xs" c="dimmed" mt="xs">
          People and food count people, not households: whoever comes on a day is at every function that day. Rooms are checked night by night.
          Everyone checks out on 16 Feb, so people who come on day 1 stay over to day 2 and keep their rooms, and households that only come on day 2
          take the extra rooms. "Main stay" is the rooms-inside column of the guest list, "elsewhere" the rooms-outside column. "Need" runs from
          the people who have said yes to everyone who has not said no.
        </Text>
      </Collapse>

      {sites.length > 0 && (
        <Accordion variant="separated" radius="md" mt="md">
          <Accordion.Item value="places">
            <Accordion.Control>
              <Text size="sm" fw={600}>
                Places we are using ({sites.length})
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {sites.map((s, i) => (
                  <div key={s.id}>
                    {i > 0 && <Divider mb="md" />}
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
                  </div>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Paper>
  );
}
