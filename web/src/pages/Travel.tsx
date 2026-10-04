import { useMemo, useState } from 'react';
import { Alert, Badge, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Timeline, Title, UnstyledButton } from '@mantine/core';
import { KIND_ICON, OPTIONS, getStoredRouteId, storeRouteId, type TravelEvent } from '../data/travelOptions';

function groupByDay(events: TravelEvent[]) {
  const days: { day: string; items: TravelEvent[] }[] = [];
  for (const e of events) {
    const last = days[days.length - 1];
    if (last && last.day === e.day) last.items.push(e);
    else days.push({ day: e.day, items: [e] });
  }
  return days;
}

export function Travel() {
  const [selectedId, setSelectedId] = useState(getStoredRouteId);
  const choose = (id: string) => {
    setSelectedId(id);
    storeRouteId(id);
  };
  const option = OPTIONS.find((o) => o.id === selectedId) ?? OPTIONS[0];
  const days = useMemo(() => groupByDay(option.events), [option]);

  return (
    <Stack gap="lg" maw={900} mx="auto" pb="xl">
      <div>
        <Title order={2}>Getting there</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Delhi to Koh Samui to Kolkata, 20-25 Feb 2027. Fares are Google Flights quotes for two adults with taxes, taken on 4 Oct 2026.
          They will move, so re-check before booking.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
        {OPTIONS.map((o) => {
          const active = o.id === option.id;
          return (
            <UnstyledButton key={o.id} onClick={() => choose(o.id)} aria-pressed={active}>
              <Card
                withBorder
                p="md"
                h="100%"
                style={{
                  borderColor: active ? 'var(--mantine-color-rose-6)' : undefined,
                  borderWidth: active ? 2 : 1,
                  background: active ? 'var(--mantine-color-rose-0)' : undefined,
                }}
              >
                {o.tag && (
                  <Badge size="sm" color={o.tag === 'Cheapest' ? 'teal' : 'blue'} variant="light" mb={6}>
                    {o.tag}
                  </Badge>
                )}
                <Text fw={700} size="sm" lh={1.25}>
                  {o.name}
                </Text>
                <Text fz={22} fw={800} mt={6} c={active ? 'rose.7' : undefined}>
                  {o.total}
                </Text>
              </Card>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      <Card withBorder p="lg">
        <Title order={3}>{option.name}</Title>
        <Text mt={6}>{option.summary}</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mt="md">
          {option.stats.map((s) => (
            <div key={s.label}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {s.label}
              </Text>
              <Text fw={700}>{s.value}</Text>
            </div>
          ))}
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Card withBorder p="md">
          <Text fw={700} mb={6}>
            What works
          </Text>
          <List
            size="sm"
            spacing={4}
            icon={
              <ThemeIcon color="teal" size={18} radius="xl">
                ✓
              </ThemeIcon>
            }
          >
            {option.pros.map((p) => (
              <List.Item key={p}>{p}</List.Item>
            ))}
          </List>
        </Card>
        <Card withBorder p="md">
          <Text fw={700} mb={6}>
            Watch out for
          </Text>
          <List
            size="sm"
            spacing={4}
            icon={
              <ThemeIcon color="orange" size={18} radius="xl">
                !
              </ThemeIcon>
            }
          >
            {option.cons.map((c) => (
              <List.Item key={c}>{c}</List.Item>
            ))}
          </List>
        </Card>
      </SimpleGrid>

      <Title order={3} mt="sm">
        Timeline
      </Title>
      <Text size="sm" c="dimmed" mt={-8}>
        Local time at each place. Thailand is 1h30 ahead of India.
      </Text>

      <Stack gap="xl">
        {days.map((d) => (
          <div key={d.day}>
            <Badge size="lg" variant="filled" color="rose" mb="sm">
              {d.day}
            </Badge>
            <Timeline active={d.items.length - 1} bulletSize={32} lineWidth={2} color="rose">
              {d.items.map((e, i) => (
                <Timeline.Item
                  key={`${d.day}-${i}`}
                  bullet={<span style={{ fontSize: 16 }}>{KIND_ICON[e.kind]}</span>}
                  title={
                    <Group gap="xs" wrap="wrap">
                      {e.time && (
                        <Badge size="sm" variant="light" color="gray">
                          {e.time}
                        </Badge>
                      )}
                      <Text fw={600} span>
                        {e.title}
                      </Text>
                    </Group>
                  }
                >
                  {e.detail && (
                    <Text size="sm" c="dimmed" mt={4}>
                      {e.detail}
                    </Text>
                  )}
                  {e.cost && (
                    <Badge size="sm" color="teal" variant="light" mt={6}>
                      {e.cost}
                    </Badge>
                  )}
                  {e.warn && (
                    <Alert color="orange" variant="light" mt={6} p="xs" radius="md">
                      <Text size="xs">{e.warn}</Text>
                    </Alert>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        ))}
      </Stack>

      <Card withBorder p="lg">
        <Text fw={700} mb={6}>
          Before you book this one
        </Text>
        <List size="sm" spacing={4} type="ordered">
          {option.checklist.map((c) => (
            <List.Item key={c}>{c}</List.Item>
          ))}
        </List>
      </Card>
    </Stack>
  );
}
