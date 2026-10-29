import { useMemo, useState } from 'react';
import { Group, NumberInput, Paper, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { roomCeiling, type StayNight, type StaySite } from '../lib/stay';
import type { Invite } from '../lib/rsvp';
import type { RsvpDay } from './RsvpEditor';

type CeilingGuest = { id: string; persons: number; rooms_inside: number | string; rooms_outside: number | string };

const KEY = 'pwp.roomCeiling';
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { held: Number.isFinite(v.held) ? v.held : 4, attendance: Number.isFinite(v.attendance) ? v.attendance : 100, basis: v.basis === 'invited' ? 'invited' : 'all' } as { held: number; attendance: number; basis: 'all' | 'invited' };
  } catch {
    return { held: 4, attendance: 100, basis: 'all' as const };
  }
};
const dayLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Works backwards from the rooms to the invites: after the rooms held back, how many people can be invited under
// each setup. The rate of rooms per person comes from the guest list itself.
export function RoomCeiling({ guests, invites, sites, nights, days }: { guests: CeilingGuest[]; invites: Pick<Invite, 'guest_id'>[]; sites: StaySite[]; nights: StayNight[]; days: RsvpDay[] }) {
  const [state, setState] = useState(read);
  const set = (patch: Partial<typeof state>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* a private window can refuse storage; the card still works */
      }
      return next;
    });

  const dates = useMemo(() => days.map((d) => d.date), [days]);
  const need = (g: CeilingGuest) => Number(g.rooms_inside) + Number(g.rooms_outside);
  const invitedIds = useMemo(() => new Set(invites.map((i) => i.guest_id)), [invites]);

  const all = useMemo(() => ({ people: guests.reduce((a, g) => a + g.persons, 0), rooms: guests.reduce((a, g) => a + need(g), 0) }), [guests]);
  const invited = useMemo(() => {
    const mine = guests.filter((g) => invitedIds.has(g.id));
    return { people: mine.reduce((a, g) => a + g.persons, 0), rooms: mine.reduce((a, g) => a + need(g), 0) };
  }, [guests, invitedIds]);

  // Fall back to the whole list while nobody has been invited yet.
  const basis = state.basis === 'invited' && invited.people > 0 && invited.rooms > 0 ? invited : all;
  const perPerson = basis.people > 0 ? basis.rooms / basis.people : 0;
  const c = useMemo(() => roomCeiling(sites, nights, dates, state.held, perPerson, state.attendance / 100), [sites, nights, dates, state.held, perPerson, state.attendance]);

  if (dates.length === 0 || perPerson === 0) return null;

  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <div>
          <Text ff="heading" fz={24} fw={600}>
            How many can we invite?
          </Text>
          <Text size="sm" c="dimmed">
            Worked back from the rooms: what each night offers, less the rooms kept out of circulation, divided by the rooms the guest list needs per person.
          </Text>
        </div>

        <Group align="flex-end" gap="md">
          <NumberInput label="Rooms held back" description="Photographers, make-up, etc." w={170} min={0} max={20} allowDecimal={false} value={state.held} onChange={(v) => set({ held: typeof v === 'number' ? v : 0 })} />
          <NumberInput label="Expected to come" description="Of those invited" w={150} min={30} max={100} step={5} suffix="%" allowDecimal={false} value={state.attendance} onChange={(v) => set({ attendance: typeof v === 'number' ? v : 100 })} />
        </Group>

        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Rooms per person, taken from
          </Text>
          <SegmentedControl
            value={state.basis}
            onChange={(v) => set({ basis: v as 'all' | 'invited' })}
            data={[
              { value: 'all', label: `Whole list (${(all.people / Math.max(all.rooms, 1)).toFixed(1)} people a room)` },
              { value: 'invited', label: `Invited so far (${invited.rooms > 0 ? (invited.people / invited.rooms).toFixed(1) : '-'} a room)` },
            ]}
          />
          <Text size="xs" c="dimmed">
            The whole list includes local guests who need no room. Out-of-town families need more rooms per person, so the second option is the safer one.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {c.setups.map((s) => (
            <Paper key={s.key} withBorder p="md" bg="transparent">
              <Text size="sm" fw={600}>
                {s.key === 'both' || s.key === 'split' ? s.label : `Everyone for ${dayLabel(s.key)} only`}
              </Text>
              <Group align="baseline" gap={6}>
                <Text fz={30} fw={700} lh={1.2}>
                  {s.people}
                </Text>
                <Text size="sm" c="dimmed">
                  people
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {rooms(s.rooms)} usable rooms · {s.hint.toLowerCase()}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>

        <Text size="xs" c="dimmed">
          {invited.people} people in {new Set(invites.map((i) => i.guest_id)).size} households are invited today. A household invited for one day only needs a room for that night alone.
          {c.perNight.map((n) => ` ${dayLabel(n.date)}: ${n.total} rooms, ${n.usable} after holding ${state.held} back.`).join('')}
        </Text>
      </Stack>
    </Paper>
  );
}
