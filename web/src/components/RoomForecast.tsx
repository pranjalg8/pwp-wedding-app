import { useMemo, useState } from 'react';
import { Badge, Group, Paper, Progress, SegmentedControl, Stack, Text } from '@mantine/core';
import { forecastRooms, type ForecastScenario, type StayNight, type StaySite } from '../lib/stay';
import type { Invite } from '../lib/rsvp';
import type { RsvpDay } from './RsvpEditor';

type PlanGuest = {
  id: string;
  name: string;
  persons: number;
  priority: 1 | 2 | null;
  rooms_inside: number | string;
  rooms_outside: number | string;
  needs_lift?: boolean;
};

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const worth = (n: number) => `${rooms(n)} ${n === 1 ? "room's" : "rooms'"} worth`;
const nightLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// What if everyone not invited yet is invited? Night by night, do the rooms hold, and how many rooms' worth of the
// remaining households can come on day 1 before that night is full. Households that have answers keep their answers.
export function RoomForecast({
  guests,
  invites,
  sites,
  nights,
  days,
}: {
  guests: PlanGuest[];
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'declined'>[];
  sites: StaySite[];
  nights: StayNight[];
  days: RsvpDay[];
}) {
  const [scenario, setScenario] = useState<ForecastScenario>('both');
  const dates = useMemo(() => days.map((d) => d.date), [days]);
  const f = useMemo(() => (dates.length > 0 ? forecastRooms(guests, invites, sites, nights, dates, scenario) : null), [guests, invites, sites, nights, dates, scenario]);

  // Nothing left to invite, or no days yet: nothing to forecast.
  if (!f || f.restHouseholds === 0) return null;

  const first = f.perNight[0];
  const slack = first ? Math.max(0, first.have - first.needNow) : 0;
  const lastDay = days[days.length - 1];
  const short = f.perNight.filter((n) => n.need > n.have + 0.01);

  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <div>
          <Text ff="heading" fz={24} fw={600}>
            What if everyone else is invited?
          </Text>
          <Text size="sm" c="dimmed">
            {f.restHouseholds} household{f.restHouseholds === 1 ? '' : 's'} not invited yet would need up to {rooms(f.restRooms)} rooms. Households that have answered keep their answers.
          </Text>
        </div>

        <SegmentedControl
          value={scenario}
          onChange={(v) => setScenario(v as ForecastScenario)}
          data={[
            { value: 'both', label: 'Invited both days' },
            { value: 'last', label: `Invited ${lastDay ? nightLabel(lastDay.date).replace(/^\w+, /, '') : 'day 2'} only` },
          ]}
        />

        <Stack gap="sm">
          {f.perNight.map((n) => {
            const over = n.need > n.have + 0.01;
            const pct = n.have > 0 ? Math.min(100, (n.need / n.have) * 100) : 0;
            return (
              <div key={n.night}>
                <Group justify="space-between" gap="xs" mb={4} wrap="wrap">
                  <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                    {nightLabel(n.night)}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      need <b>{rooms(n.need)}</b> of <b>{n.have}</b>
                    </Text>
                    <Badge variant="light" tt="none" color={over ? 'red' : 'teal'} style={{ flexShrink: 0 }} styles={{ label: { overflow: 'visible' } }}>
                      {over ? `${rooms(Math.ceil((n.need - n.have) * 2) / 2)} short` : `${rooms(n.have - n.need)} spare`}
                    </Badge>
                  </Group>
                </Group>
                <Progress value={pct} color={over ? 'red' : 'rose'} size="sm" aria-label={`${nightLabel(n.night)}: ${rooms(n.need)} of ${n.have} rooms needed`} />
              </div>
            );
          })}
        </Stack>

        <Text size="sm">
          {short.length === 0 ? (
            <>
              <b>Everyone fits</b> even if all of them are invited{scenario === 'both' ? ' for both days' : ` for ${lastDay ? nightLabel(lastDay.date).replace(/^\w+, /, '') : 'day 2'} only`}.
            </>
          ) : scenario === 'both' && first ? (
            <>
              Right now the invited households use {rooms(first.needNow)} of {first.have} rooms on {nightLabel(first.night)}, so up to <b>{worth(slack)}</b> of the remaining households can
              come on day 1. About <b>{worth(Math.max(0, f.restRooms - slack))}</b> would have to be invited for day 2 only, since they then need no room on the first night.
            </>
          ) : (
            <>The rooms do not hold on {short.map((n) => nightLabel(n.night)).join(' and ')} even with this plan.</>
          )}
          {f.unplacedRooms > 0 && short.length === 0 && ` The planner could not place ${rooms(f.unplacedRooms)} rooms on every night because of how the rooms are split between places.`}
        </Text>
      </Stack>
    </Paper>
  );
}
