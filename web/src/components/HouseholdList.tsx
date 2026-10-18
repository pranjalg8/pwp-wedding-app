import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Checkbox, Group, Menu, Paper, Stack, Text } from '@mantine/core';
import type { Guest } from './GuestEditor';
import type { RsvpDay } from './RsvpEditor';
import { splitOf, type Invite } from '../lib/rsvp';
import { allNightsOf, householdNeed, type GuestStay, type StayNight, type StaySite } from '../lib/stay';

const PAGE = 40;
const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// One day's answer as a small pill: who is coming, unsure, not coming and still to reply. The colour follows the
// most important thing: anyone still to reply is blue, otherwise teal if anyone is coming, yellow if unsure, red.
function answerPill(invite: Invite | undefined, persons: number): { text: string; color: string } {
  if (!invite) return { text: 'Not invited', color: 'gray' };
  const s = splitOf({ ...invite, guests: { persons } });
  if (s.coming === 0 && s.maybe === 0 && s.declined === 0) return { text: `Waiting for ${s.noReply}`, color: 'blue' };
  const parts = [
    s.coming > 0 ? `${s.coming} coming` : null,
    s.maybe > 0 ? `${s.maybe} maybe` : null,
    s.declined > 0 ? `${s.declined} no` : null,
    s.noReply > 0 ? `${s.noReply} waiting` : null,
  ].filter(Boolean);
  const color = s.noReply > 0 ? 'blue' : s.coming > 0 ? 'teal' : s.maybe > 0 ? 'yellow' : 'red';
  return { text: parts.join(', '), color };
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <Badge variant="light" color={color} tt="none" size="lg" fw={600} styles={{ label: { overflow: 'visible' } }}>
      {text}
    </Badge>
  );
}

// The households as a clean list: who, how many, each day's answer and where they sleep. On a phone each household
// is a card. In edit mode rows can be ticked, answered, edited or deleted.
export function HouseholdList({
  guests,
  invites,
  days,
  stays,
  sites,
  nights,
  isUnlocked,
  selected,
  onSelect,
  onAnswer,
  onEdit,
  onDelete,
}: {
  guests: Guest[];
  invites: Invite[];
  days: RsvpDay[];
  stays: GuestStay[];
  sites: StaySite[];
  nights: StayNight[];
  isUnlocked: boolean;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onAnswer: (g: Guest) => void;
  onEdit: (g: Guest) => void;
  onDelete: (g: Guest) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const allNights = useMemo(() => allNightsOf(nights), [nights]);
  const siteName = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s.name.split(',')[0]])), [sites]);

  const shown = guests.slice(0, limit);
  const rows = useMemo(
    () =>
      shown.map((g) => {
        const mine = invites.filter((i) => i.guest_id === g.id);
        const need = householdNeed(g, mine, allNights);
        const placed = stays.filter((s) => s.guest_id === g.id);
        let room: { text: string; color: string };
        if (placed.length > 0) room = { text: placed.map((s) => `${siteName[s.site_id]} ${rooms(Number(s.rooms))}`).join(', '), color: 'teal' };
        else if (!need) room = { text: '—', color: 'dimmed' };
        else if (need.main + need.other === 0) room = { text: 'None needed', color: 'dimmed' };
        else room = { text: 'Not placed', color: 'yellow.9' };
        return { g, d: days.map((d) => ({ d, pill: answerPill(mine.find((i) => i.event_date === d.date), g.persons) })), room };
      }),
    [shown, invites, days, stays, allNights, siteName]
  );

  const allTicked = shown.length > 0 && shown.every((g) => selected.has(g.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    if (allTicked) shown.forEach((g) => next.delete(g.id));
    else shown.forEach((g) => next.add(g.id));
    onSelect(next);
  };

  const columns = `${isUnlocked ? '36px ' : ''}minmax(200px, 2.2fr) 64px ${days.map(() => 'minmax(140px, 1.2fr)').join(' ')} minmax(130px, 1fr)${isUnlocked ? ' 120px' : ''}`;

  if (guests.length === 0) {
    return (
      <Paper withBorder p="xl" ta="center">
        <Text c="dimmed">No households match.</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
      <Box visibleFrom="md" style={{ overflowX: 'auto' }}>
        <Box style={{ minWidth: 860 }}>
          <Box
            style={{ display: 'grid', gridTemplateColumns: columns, gap: 12, alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--mantine-color-default-border)' }}
          >
            {isUnlocked && <Checkbox aria-label="Tick all households shown" checked={allTicked} onChange={toggleAll} />}
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
              Household
            </Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" ta="right" style={{ letterSpacing: 0.5 }}>
              People
            </Text>
            {days.map((d) => (
              <Text key={d.date} size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
                {d.label}
              </Text>
            ))}
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.5 }}>
              Room
            </Text>
            {isUnlocked && <span />}
          </Box>
          {rows.map(({ g, d, room }) => (
            <Box
              key={g.id}
              style={{
                display: 'grid',
                gridTemplateColumns: columns,
                gap: 12,
                alignItems: 'center',
                padding: '12px 20px',
                borderBottom: '1px solid var(--mantine-color-default-border)',
                background: selected.has(g.id) ? 'var(--mantine-color-rose-light)' : undefined,
              }}
            >
              {isUnlocked && <Checkbox aria-label={`Tick ${g.name}`} checked={selected.has(g.id)} onChange={() => toggle(g.id)} />}
              <div style={{ minWidth: 0 }}>
                <Text fw={600} size="sm" truncate title={g.name}>
                  {g.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {[g.list_group, g.location].filter(Boolean).join(' · ') || g.family_members || ' '}
                </Text>
              </div>
              <Text ta="right" fw={600} size="sm">
                {g.persons}
              </Text>
              {d.map(({ d: day, pill }) => (
                <div key={day.date}>
                  <Pill {...pill} />
                </div>
              ))}
              <Text size="sm" c={room.color} fw={500}>
                {room.text}
              </Text>
              {isUnlocked && (
                <Group gap={4} wrap="nowrap" justify="flex-end">
                  <Button size="compact-sm" variant="default" onClick={() => onAnswer(g)}>
                    Answer
                  </Button>
                  <RowMenu g={g} onEdit={onEdit} onDelete={onDelete} />
                </Group>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <Stack hiddenFrom="md" gap={0}>
        {rows.map(({ g, d, room }) => (
          <Box
            key={g.id}
            p="md"
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)', background: selected.has(g.id) ? 'var(--mantine-color-rose-light)' : undefined }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
              <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
                {isUnlocked && <Checkbox mt={2} aria-label={`Tick ${g.name}`} checked={selected.has(g.id)} onChange={() => toggle(g.id)} />}
                <div style={{ minWidth: 0 }}>
                  <Text fw={600}>{g.name}</Text>
                  <Text size="xs" c="dimmed">
                    {g.persons} {g.persons === 1 ? 'person' : 'people'}
                    {[g.list_group, g.location].filter(Boolean).length > 0 ? ` · ${[g.list_group, g.location].filter(Boolean).join(' · ')}` : ''}
                  </Text>
                </div>
              </Group>
              {isUnlocked && (
                <Group gap={4} wrap="nowrap">
                  <Button size="compact-md" variant="default" onClick={() => onAnswer(g)}>
                    Answer
                  </Button>
                  <RowMenu g={g} onEdit={onEdit} onDelete={onDelete} />
                </Group>
              )}
            </Group>
            <Stack gap={6} mt="sm">
              {d.map(({ d: day, pill }) => (
                <Group key={day.date} gap="sm" wrap="nowrap">
                  <Text size="xs" c="dimmed" w={72} style={{ flexShrink: 0 }}>
                    {day.label.replace(/^\w+, /, '')}
                  </Text>
                  <Pill {...pill} />
                </Group>
              ))}
              <Group gap="sm" wrap="nowrap">
                <Text size="xs" c="dimmed" w={72} style={{ flexShrink: 0 }}>
                  Room
                </Text>
                <Text size="sm" c={room.color} fw={500}>
                  {room.text}
                </Text>
              </Group>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Group justify="space-between" p="md">
        <Text size="sm" c="dimmed">
          Showing {Math.min(limit, guests.length)} of {guests.length} {guests.length === 1 ? 'household' : 'households'}
        </Text>
        {guests.length > limit && (
          <Button variant="subtle" size="compact-md" onClick={() => setLimit((n) => n + PAGE)}>
            Show more
          </Button>
        )}
      </Group>
    </Paper>
  );
}

function RowMenu({ g, onEdit, onDelete }: { g: Guest; onEdit: (g: Guest) => void; onDelete: (g: Guest) => void }) {
  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label={`More actions for ${g.name}`}>
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
            ⋯
          </span>
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onEdit(g)}>Edit household</Menu.Item>
        <Menu.Item color="red" onClick={() => onDelete(g)}>
          Delete household
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
