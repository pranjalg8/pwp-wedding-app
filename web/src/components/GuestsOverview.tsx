import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { RsvpBar } from './RsvpBar';
import type { RsvpDay } from './RsvpEditor';
import type { Invite, RsvpTotals } from '../lib/rsvp';
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, type HouseholdStatus, type StatusCounts } from '../lib/guestStatus';
import { roomsAvailable, roomsWanted, type StayNight, type StaySite } from '../lib/stay';

type GuestRooms = { id: string; persons: number; rooms_inside: number | string; rooms_outside: number | string };

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const dayLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const LABEL = { letterSpacing: 0.6 } as const;

// Whether the rooms we have cover what the invited households need: from those who have said yes to everyone who
// has not said no.
function verdict(have: number, least: number, most: number): { color: string; text: string } | null {
  if (most <= 0) return null;
  if (most <= have) return { color: 'teal', text: 'Enough' };
  if (least <= have) return { color: 'yellow', text: `Up to ${Math.ceil(most - have)} short` };
  return { color: 'red', text: `${Math.ceil(least - have)} short` };
}

function NeedCard({ big, label, action, onClick }: { big: number; label: string; action: string; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick} style={{ display: 'block', width: '100%' }}>
      <Paper withBorder p="lg" className="topic-card" h="100%">
        <Group gap="sm" align="baseline" wrap="nowrap">
          <Text ff="heading" fz={44} fw={600} lh={1}>
            {big}
          </Text>
          <Text fw={500}>{label}</Text>
        </Group>
        <Text c="rose.7" fw={600} mt={6}>
          {action} →
        </Text>
      </Paper>
    </UnstyledButton>
  );
}

// The first thing you see: what needs you, how the replies stand, and how each day works out for food and rooms.
export function GuestsOverview({
  counts,
  households,
  people,
  toPlace,
  days,
  totals,
  guests,
  invites,
  sites,
  nights,
  onStatus,
  onRooms,
}: {
  counts: StatusCounts;
  households: number;
  people: number;
  toPlace: number;
  days: RsvpDay[];
  totals: Record<string, RsvpTotals>;
  guests: GuestRooms[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  nights: StayNight[];
  onStatus: (s: HouseholdStatus) => void;
  onRooms: () => void;
}) {
  const shade = (s: HouseholdStatus) => `var(--mantine-color-${STATUS_COLOR[s]}-${s === 'not_invited' ? 4 : 6})`;
  const dayDates = new Set(days.map((d) => d.date));
  const extraNights = [...new Set(nights.map((n) => n.night))].filter((n) => !dayDates.has(n)).sort();

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={LABEL}>
          What needs you
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <NeedCard big={counts.waiting.households} label="households waiting for a reply" action="Review replies" onClick={() => onStatus('waiting')} />
          <NeedCard big={counts.not_invited.households} label="households not invited yet" action="Invite them" onClick={() => onStatus('not_invited')} />
          <NeedCard big={toPlace} label="households need a room" action="Place rooms" onClick={onRooms} />
        </SimpleGrid>
      </Stack>

      <Paper withBorder p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="baseline" gap="xs">
            <Text ff="heading" fz={24} fw={600}>
              Replies so far
            </Text>
            <Text size="sm" c="dimmed">
              {people} people in {households} households · pick a status to see those households
            </Text>
          </Group>
          <Group gap={3} wrap="nowrap" role="img" aria-label={STATUS_ORDER.map((s) => `${counts[s].households} ${STATUS_LABEL[s].toLowerCase()}`).join(', ')}>
            {STATUS_ORDER.filter((s) => counts[s].households > 0).map((s) => (
              <Box key={s} h={14} style={{ flex: counts[s].households, borderRadius: 7, background: shade(s) }} />
            ))}
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
            {STATUS_ORDER.map((s) => (
              <UnstyledButton
                key={s}
                onClick={() => onStatus(s)}
                disabled={counts[s].households === 0}
                style={{ borderRadius: 12, padding: '10px 14px', background: `var(--mantine-color-${STATUS_COLOR[s]}-light)`, opacity: counts[s].households === 0 ? 0.55 : 1 }}
              >
                <Text ff="heading" fz={28} fw={600} lh={1.1} c={`${STATUS_COLOR[s]}.8`}>
                  {counts[s].households}
                </Text>
                <Text size="sm" fw={500}>
                  {STATUS_LABEL[s]}
                </Text>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>

      <Stack gap="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={LABEL}>
          Day by day
        </Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {days.map((d) => {
            const t = totals[d.date];
            const have = roomsAvailable(sites, nights, d.date);
            const least = roomsWanted(guests, invites, d.date, 'least');
            const most = roomsWanted(guests, invites, d.date, 'most');
            const main = verdict(have.main, least.main, most.main);
            const other = verdict(have.other, least.other, most.other);
            const upTo = t ? t.confirmed + t.maybe + t.invited : 0;
            return (
              <Paper key={d.date} withBorder p="lg">
                <Stack gap="md">
                  <div>
                    <Text ff="heading" fz={24} fw={600}>
                      {dayLabel(d.date)}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {d.functions.join(', ')}
                    </Text>
                  </div>
                  {t ? <RsvpBar totals={t} compact /> : <Text size="sm" c="dimmed">No one invited yet</Text>}
                  <Box style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: '10px 14px', alignItems: 'center' }}>
                    <Text size="sm" c="dimmed">
                      Food
                    </Text>
                    <Text size="sm">
                      <b>{t?.confirmed ?? 0}</b> confirmed, up to <b>{upTo}</b>
                    </Text>
                    <Text size="sm" c="dimmed">
                      Main stay
                    </Text>
                    <Group gap="xs">
                      <Text size="sm">
                        <b>{have.main}</b> rooms{most.main > 0 ? `, need ${rooms(least.main)} to ${rooms(most.main)}` : ''}
                      </Text>
                      {main && (
                        <Badge variant="light" color={main.color} tt="none">
                          {main.text}
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      Elsewhere
                    </Text>
                    <Group gap="xs">
                      <Text size="sm">
                        <b>{have.other}</b> rooms{most.other > 0 ? `, need ${rooms(least.other)} to ${rooms(most.other)}` : ''}
                      </Text>
                      {other && (
                        <Badge variant="light" color={other.color} tt="none">
                          {other.text}
                        </Badge>
                      )}
                    </Group>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>
        {extraNights.length > 0 && (
          <Text size="sm" c="dimmed">
            {extraNights.map((n) => {
              const h = roomsAvailable(sites, nights, n);
              return `${dayLabel(n)}, the night before: ${h.bySite.map((x) => `${x.rooms} rooms at ${x.site.name.split(',')[0]}`).join(', ')}, no function`;
            }).join('. ')}
            . Everyone checks out on 16 Feb.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
