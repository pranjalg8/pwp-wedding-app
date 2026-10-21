import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Accordion, Alert, Badge, Box, Container, Group, Loader, Paper, SimpleGrid, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { SECTIONS, SENSITIVE, timeLeft, type SectionKey } from '../lib/shareLinks';
import { STATUS_COLOR as HOUSEHOLD_COLOR, STATUS_LABEL as HOUSEHOLD_LABEL, STATUS_ORDER } from '../lib/guestStatus';
import { OPTION_STATUS_COLOR, OPTION_STATUS_LABEL, OWNER_LABEL, STATUS_COLOR, STATUS_LABEL, formatInr } from '../lib/topicMeta';

// What the share function sends back. It has already left out whatever the link does not allow.
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
type Payload = { link: { label: string; access: 'view' | 'edit'; sections: SectionKey[]; show: Record<string, boolean>; expiresAt: string }; data: Record<string, Row> };
type State = { phase: 'loading' } | { phase: 'unavailable' } | { phase: 'ready'; payload: Payload };

const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Hidden({ what }: { what: string }) {
  return (
    <Alert color="gray" variant="light" title="Not included in this link">
      The person who shared this chose not to include {what}.
    </Alert>
  );
}

function Home({ d }: { d: Row }) {
  const c = d.taskCounts as Row;
  return (
    <Stack gap="md">
      <Box className="hero" c="white" p="lg" style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
        <Text size="sm" fw={600} tt="uppercase" style={{ letterSpacing: 1, opacity: 0.9 }}>
          {shortDay(d.weddingStart)}
          {d.weddingEnd !== d.weddingStart ? ` to ${shortDay(d.weddingEnd)}` : ''}
        </Text>
        <Group align="baseline" gap="sm">
          <Title order={1} c="white" fz={56} lh={1}>
            {Math.max(0, d.daysToGo)}
          </Title>
          <Text fz="xl" fw={500}>
            days to go
          </Text>
        </Group>
      </Box>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {[
          ['Open', c.open],
          ['In progress', c.inProgress],
          ['Decided', c.decided],
          ['Done', c.done],
        ].map(([label, n]) => (
          <Paper key={label as string} withBorder p="md">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              {label}
            </Text>
            <Text fz={26} fw={700}>
              {n}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper withBorder p="md">
          <Text fw={700} mb="xs">
            Due next
          </Text>
          {(d.upcoming as Row[]).length === 0 ? (
            <Text size="sm" c="dimmed">
              Nothing has a due date.
            </Text>
          ) : (
            <Stack gap="xs">
              {(d.upcoming as Row[]).map((t) => (
                <Group key={t.title} justify="space-between" wrap="nowrap" gap="sm">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500}>
                      {t.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t.owner ? OWNER_LABEL[t.owner] : ''}
                    </Text>
                  </div>
                  <Badge variant="light" color="gray" tt="none" style={{ flexShrink: 0 }}>
                    {shortDay(t.due_date)}
                  </Badge>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
        <Paper withBorder p="md">
          <Text fw={700} mb="xs">
            Needs a decision
          </Text>
          {(d.needsDecision as string[]).length === 0 ? (
            <Text size="sm" c="dimmed">
              Everything with options has a pick.
            </Text>
          ) : (
            <Stack gap={6}>
              {(d.needsDecision as string[]).map((t) => (
                <Text key={t} size="sm">
                  {t}
                </Text>
              ))}
            </Stack>
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

function Tasks({ tasks }: { tasks: unknown }) {
  const list = tasks as Row[];
  return (
    <Accordion variant="separated" radius="md">
      {list.map((t) => (
        <Accordion.Item key={t.title} value={t.title}>
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap" gap="sm" pr="xs">
              <div style={{ minWidth: 0 }}>
                <Text fw={600} size="sm">
                  {t.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {[t.area, t.owner ? OWNER_LABEL[t.owner] : null, t.due_date ? `due ${shortDay(t.due_date)}` : null].filter(Boolean).join(' · ')}
                </Text>
              </div>
              <Badge color={STATUS_COLOR[t.status]} variant="light" style={{ flexShrink: 0 }}>
                {STATUS_LABEL[t.status]}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              {t.summary && <Text size="sm">{t.summary}</Text>}
              {t.money && (
                <Text size="sm" fw={600}>
                  {[t.money.paid > 0 ? `Paid ${formatInr(t.money.paid)}` : null, t.money.planned > 0 ? `Planned ${formatInr(t.money.planned)}` : null, t.money.openLow > 0 ? `Open quotes ${formatInr(t.money.openLow)}${t.money.openHigh !== t.money.openLow ? ` to ${formatInr(t.money.openHigh)}` : ''}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No amounts yet'}
                </Text>
              )}
              {(t.options as Row[]).length === 0 ? (
                <Text size="sm" c="dimmed">
                  No options yet.
                </Text>
              ) : (
                (t.options as Row[]).map((o) => (
                  <Group key={o.name} align="flex-start" wrap="nowrap" gap="sm">
                    <Badge color={OPTION_STATUS_COLOR[o.status]} variant="light" style={{ flexShrink: 0 }}>
                      {OPTION_STATUS_LABEL[o.status]}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500}>
                        {o.name}
                      </Text>
                      {o.summary && (
                        <Text size="xs" c="dimmed">
                          {o.summary}
                        </Text>
                      )}
                      {o.why_note && (
                        <Text size="xs" c="dimmed">
                          {o.why_note}
                        </Text>
                      )}
                      {o.contact && (o.contact.person || o.contact.phone || o.contact.email) && (
                        <Text size="xs">{[o.contact.person, o.contact.phone, o.contact.email].filter(Boolean).join(' · ')}</Text>
                      )}
                    </div>
                  </Group>
                ))
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

function Functions({ fns }: { fns: unknown }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {(fns as Row[]).map((f) => (
        <Paper key={f.name} withBorder p="md">
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text fw={700}>{f.name}</Text>
            <Badge variant="light" color={f.status === 'decided' ? 'teal' : f.status === 'in_progress' ? 'blue' : 'orange'}>
              {f.status === 'decided' ? 'Decided' : f.status === 'in_progress' ? 'In progress' : 'Open'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {day(f.event_date)} · {f.slot === 'first_half' ? 'First half' : 'Second half'}
          </Text>
          {f.theme && <Text size="sm" mt="xs">{f.theme}</Text>}
          {(f.colours.length > 0 || f.avoid_colours.length > 0) && (
            <Group gap={6} mt="xs">
              {(f.colours as string[]).map((c) => (
                <Badge key={c} color="teal" variant="light">
                  {c}
                </Badge>
              ))}
              {(f.avoid_colours as string[]).map((c) => (
                <Badge key={c} color="red" variant="light">
                  avoid {c}
                </Badge>
              ))}
            </Group>
          )}
          {f.notes && (
            <Text size="sm" c="dimmed" mt="xs">
              {f.notes}
            </Text>
          )}
        </Paper>
      ))}
    </SimpleGrid>
  );
}

function Guests({ g }: { g: Row }) {
  const counts = g.counts as Record<string, { households: number; people: number }>;
  const days = Object.entries(g.byDay as Record<string, Row>).sort(([a], [b]) => a.localeCompare(b));
  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Group align="baseline" gap="xs" mb="sm">
          <Text fz={30} fw={700} lh={1}>
            {g.people}
          </Text>
          <Text c="dimmed">people in {g.households} households</Text>
        </Group>
        <Group gap="xs">
          {STATUS_ORDER.map((s) => (
            <Badge key={s} size="lg" variant="light" color={HOUSEHOLD_COLOR[s]} tt="none">
              {HOUSEHOLD_LABEL[s]}: {counts[s]?.households ?? 0}
            </Badge>
          ))}
        </Group>
      </Paper>
      {days.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={700} mb="xs">
            People by day
          </Text>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Day</Table.Th>
                <Table.Th ta="right">Yes</Table.Th>
                <Table.Th ta="right">Maybe</Table.Th>
                <Table.Th ta="right">No</Table.Th>
                <Table.Th ta="right">No reply</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {days.map(([date, r]) => (
                <Table.Tr key={date}>
                  <Table.Td>{day(date)}</Table.Td>
                  <Table.Td ta="right">{r.coming}</Table.Td>
                  <Table.Td ta="right">{r.maybe}</Table.Td>
                  <Table.Td ta="right">{r.declined}</Table.Td>
                  <Table.Td ta="right">{r.noReply}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      {g.list ? (
        <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Household</Table.Th>
                  <Table.Th ta="right">People</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Answers</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(g.list as Row[]).map((h) => (
                  <Table.Tr key={h.name + h.persons}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {h.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {[h.family_members, h.group, h.location].filter(Boolean).join(' · ')}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">{h.persons}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={HOUSEHOLD_COLOR[h.status as keyof typeof HOUSEHOLD_COLOR]} tt="none">
                        {HOUSEHOLD_LABEL[h.status as keyof typeof HOUSEHOLD_LABEL]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {(h.answers as Row[]).map((a) => (
                        <Text key={a.date} size="xs">
                          {shortDay(a.date)}: {a.coming} yes, {a.maybe} maybe, {a.declined} no
                        </Text>
                      ))}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : (
        <Text size="xs" c="dimmed">
          Guest names are not included in this link, only the totals.
        </Text>
      )}
    </Stack>
  );
}

function Rooms({ r }: { r: Row }) {
  return (
    <Stack gap="md">
      {(r.sites as Row[]).map((s) => (
        <Paper key={s.name} withBorder p="md">
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text fw={700}>{s.name}</Text>
            <Group gap={4} wrap="nowrap">
              <Badge size="sm" variant="light" color={s.role === 'main' ? 'rose' : 'gray'}>
                {s.role === 'main' ? 'Main stay' : 'Elsewhere'}
              </Badge>
              <Badge size="sm" variant="light" color={s.has_lift ? 'teal' : 'orange'}>
                {s.has_lift ? 'Lift' : 'No lift'}
              </Badge>
            </Group>
          </Group>
          <Text size="sm" mt={4}>
            {(s.nights as Row[]).map((n) => `${shortDay(n.night)}: ${n.rooms} rooms`).join(' · ')}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {[s.floors, s.people_per_room ? `${s.people_per_room} people a room` : null, s.distance_note, s.booking_note, s.notes].filter(Boolean).join(' · ')}
          </Text>
          <Text size="xs" mt={4}>
            {s.placedRooms > 0 ? `${s.placedRooms} rooms placed with households` : 'No households placed here yet'}
          </Text>
        </Paper>
      ))}
      {r.placements && (r.placements as Row[]).length > 0 && (
        <Paper withBorder p="md">
          <Text fw={700} mb="xs">
            Who is staying where
          </Text>
          <Stack gap={4}>
            {(r.placements as Row[]).map((p, i) => (
              <Text key={i} size="sm">
                {p.name}: {p.site} ({p.rooms})
              </Text>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function Budget({ b }: { b: Row }) {
  if (b.hidden) return <Hidden what="amounts and money" />;
  const s = b.settings as Row | null;
  const paid = (b.payments as Row[]).reduce((a, p) => a + p.amount, 0);
  const due = (b.schedule as Row[]).filter((x) => x.status === 'pending').reduce((a, p) => a + p.amount, 0);
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {[
          ['Paid so far', formatInr(paid)],
          ['Still to pay', formatInr(due)],
          ['Funds available', s?.funds_available != null ? formatInr(Number(s.funds_available)) : 'Not set'],
          ['Added each month', s?.monthly_addition ? formatInr(Number(s.monthly_addition)) : 'None'],
        ].map(([l, v]) => (
          <Paper key={l} withBorder p="md">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              {l}
            </Text>
            <Text fz={22} fw={700}>
              {v}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper withBorder p="md">
        <Text fw={700} mb="xs">
          Payments due
        </Text>
        {(b.schedule as Row[]).length === 0 ? (
          <Text size="sm" c="dimmed">
            Nothing scheduled.
          </Text>
        ) : (
          <Stack gap="xs">
            {(b.schedule as Row[]).map((p, i) => (
              <Group key={i} justify="space-between" wrap="nowrap" gap="sm">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500}>
                    {p.payee}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {[shortDay(p.due_date), p.area, p.is_estimate ? 'estimate' : null, p.status !== 'pending' ? p.status : null].filter(Boolean).join(' · ')}
                  </Text>
                </div>
                <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                  {formatInr(p.amount)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>
      <Paper withBorder p="md">
        <Text fw={700} mb="xs">
          Payments made
        </Text>
        <Stack gap="xs">
          {(b.payments as Row[]).map((p, i) => (
            <Group key={i} justify="space-between" wrap="nowrap" gap="sm">
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={500}>
                  {p.payee}
                </Text>
                <Text size="xs" c="dimmed">
                  {[shortDay(p.paid_on), p.purpose].filter(Boolean).join(' · ')}
                </Text>
              </div>
              <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                {formatInr(p.amount)}
              </Text>
            </Group>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

function Vendors({ v }: { v: unknown }) {
  const list = v as Row[];
  return (
    <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
      <Table.ScrollContainer minWidth={480}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Who</Table.Th>
              <Table.Th>For</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Contact</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.map((x, i) => (
              <Table.Tr key={i}>
                <Table.Td fw={500}>{x.name}</Table.Td>
                <Table.Td>{x.task}</Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={OPTION_STATUS_COLOR[x.status]}>
                    {OPTION_STATUS_LABEL[x.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>{x.contact ? [x.contact.person, x.contact.phone, x.contact.email].filter(Boolean).join(' · ') : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function Honeymoon({ h }: { h: Row }) {
  if (h.hidden) return <Hidden what="the honeymoon" />;
  const items = h.items as Row[];
  return (
    <Stack gap="sm">
      {items.length === 0 && <Text c="dimmed">Nothing here yet.</Text>}
      {items.map((i, n) => (
        <Paper key={n} withBorder p="md">
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text fw={600}>{i.title}</Text>
            {i.amount != null && (
              <Text fw={600} style={{ flexShrink: 0 }}>
                {formatInr(i.amount)}
              </Text>
            )}
          </Group>
          {i.detail && (
            <Text size="sm" c="dimmed">
              {i.detail}
            </Text>
          )}
        </Paper>
      ))}
    </Stack>
  );
}

// Opened from a share link: #/s/<secret>. No planner login. The secret stays in the URL fragment, so it is never
// sent to the website's host, only to the share function. Every failure looks the same on purpose.
export function SharedView() {
  const { token } = useParams();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error('unavailable');
        const payload = (await res.json()) as Payload;
        if (active) {
          setState({ phase: 'ready', payload });
          setTab(payload.link.sections[0] ?? null);
        }
      } catch {
        if (active) setState({ phase: 'unavailable' });
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (state.phase === 'loading') {
    return (
      <Group justify="center" mt={120}>
        <Loader color="rose" />
      </Group>
    );
  }
  if (state.phase === 'unavailable') {
    return (
      <Container size="xs" mt={100}>
        <Paper withBorder p="xl" ta="center">
          <Title order={3}>This link isn't available</Title>
          <Text c="dimmed" mt="xs">
            It may have expired or been withdrawn. Please ask for a new one.
          </Text>
        </Paper>
      </Container>
    );
  }

  const { link, data } = state.payload;
  const included = SENSITIVE.filter((s) => link.show[s.key]);
  const sections = link.sections.filter((k) => data[k] !== undefined);

  const render = (k: SectionKey) => {
    const d = data[k] as Row;
    switch (k) {
      case 'home':
        return <Home d={d} />;
      case 'tasks':
        return <Tasks tasks={d} />;
      case 'functions':
        return <Functions fns={d} />;
      case 'guests':
        return <Guests g={d} />;
      case 'rooms':
        return <Rooms r={d} />;
      case 'budget':
        return <Budget b={d} />;
      case 'vendors':
        return <Vendors v={d} />;
      case 'honeymoon':
        return <Honeymoon h={d} />;
    }
  };

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>
            Pranjal <Text span c="rose.6">&amp;</Text> Paridhi
          </Title>
          <Group gap="xs" mt={4}>
            <Badge variant="light" color="gray" tt="none">
              Shared view · {link.access === 'edit' ? 'can edit' : 'view only'}
            </Badge>
            <Text size="xs" c="dimmed">
              {timeLeft(link.expiresAt)}
            </Text>
          </Group>
          {included.length > 0 && (
            <Text size="xs" c="orange" mt={4}>
              This link includes {included.map((s) => s.label.toLowerCase()).join(', ')}. Please do not forward it.
            </Text>
          )}
        </div>

        <Tabs value={tab} onChange={setTab} keepMounted={false}>
          <Tabs.List style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
            {sections.map((k) => (
              <Tabs.Tab key={k} value={k} style={{ whiteSpace: 'nowrap' }}>
                {SECTIONS.find((s) => s.key === k)?.label ?? k}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {sections.map((k) => (
            <Tabs.Panel key={k} value={k} pt="md">
              {render(k)}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
