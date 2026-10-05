import { useState } from 'react';
import { Accordion, Anchor, Badge, Box, Button, Card, Group, Image, List, Paper, Progress, Select, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { altImageUrl, altTotal, type AltMoment, type AltPlan } from '../data/alternativePlan';

const rupee = (n: number) => {
  const abs = Math.abs(n);
  return abs >= 100000 ? `₹${(abs / 100000).toFixed(2).replace(/\.?0+$/, '')}L` : `₹${Math.round(abs / 1000)}k`;
};

const optionStorageKey = (planKey: string) => `pwp-alt-option-${planKey}`;

function storedOption(plan: AltPlan, planKey: string): string {
  try {
    const v = localStorage.getItem(optionStorageKey(planKey));
    if (v && plan.options.some((o) => o.id === v)) return v;
  } catch {
    // storage unavailable: use the default
  }
  return plan.defaultOption;
}

function MomentRow({ moment }: { moment: AltMoment }) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" color="rose" radius="xl" size="lg">
        {moment.icon}
      </ThemeIcon>
      <div>
        <Text size="xs" c="rose.7" fw={800} tt="uppercase">
          {moment.time}
        </Text>
        <Text size="sm" fw={600}>
          {moment.label}
        </Text>
      </div>
    </Group>
  );
}

export function AlternativeHoneymoon({ plan, planKey, nextLabel, onFlip }: { plan: AltPlan; planKey: string; nextLabel: string; onFlip: () => void }) {
  const [optionId, setOptionId] = useState(() => storedOption(plan, planKey));
  const [selected, setSelected] = useState(0);
  const option = plan.options.find((o) => o.id === optionId) ?? plan.options[0];
  const days = option.days;
  const current = days[selected] ?? days[0];
  const planned = altTotal(option.budget);
  const flex = plan.cap - planned;
  const over = flex < 0;
  const heroUrl = altImageUrl(plan, plan.heroImage);
  const dayImage = altImageUrl(plan, current.image) ?? heroUrl;

  const costs: [string, string, string][] = [
    ['✈️', 'Flights', rupee(option.budget.flights)],
    ['🏨', 'Stays', rupee(option.budget.stays)],
    ['🍜', 'Food', rupee(option.budget.food)],
    ['🎨', 'Activities', rupee(option.budget.activities)],
    ['🚤', 'Transfers', rupee(option.budget.local)],
    [over ? '⚠️' : '✨', over ? 'Over cap' : 'Flex', rupee(flex)],
  ];

  function chooseOption(id: string | null) {
    if (!id) return;
    setOptionId(id);
    setSelected(0);
    try {
      localStorage.setItem(optionStorageKey(planKey), id);
    } catch {
      // ignore: the choice just will not persist
    }
  }

  return (
    <Stack gap="xl" maw={1120} mx="auto" pb="xl">
      <Paper className="honeymoon-hero honeymoon-reveal" radius="xl" style={{ overflow: 'hidden' }} shadow="lg">
        {heroUrl && <Image src={heroUrl} alt={`${plan.label} lagoon`} h={{ base: 410, sm: 470 }} fit="cover" />}
        <Box className="honeymoon-hero-copy">
          <Badge color="dark" variant="filled" size="lg">
            20–25 FEB 2027 · 5 NIGHTS
          </Badge>
          <Title c="white" fz={{ base: 42, sm: 68 }} lh={0.96} mt="md">
            {plan.title}
          </Title>
          <Text c="white" fz={{ base: 'md', sm: 'lg' }} mt="md" maw={520}>
            {plan.tagline}
          </Text>
          <Group mt="lg" gap="xs">
            {option.badges.map((b) => (
              <Badge key={b} variant="white" color="dark" size="lg">
                {b}
              </Badge>
            ))}
          </Group>
        </Box>
      </Paper>

      <Paper withBorder p="md" radius="xl" className="honeymoon-reveal honeymoon-delay-1">
        <Group justify="space-between" align="flex-end" gap="md">
          <Select
            label={`Which version of ${plan.label}?`}
            description={plan.priceNote ?? 'Flights are Google Flights quotes from 4 Oct 2026'}
            value={option.id}
            onChange={chooseOption}
            allowDeselect={false}
            data={plan.options.map((o) => ({ value: o.id, label: `${o.name} · ${rupee(altTotal(o.budget))} planned` }))}
            style={{ flex: 1, minWidth: 260 }}
          />
          <Button variant="filled" color="dark" radius="xl" onClick={onFlip}>
            🔄 Flip to {nextLabel}
          </Button>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="honeymoon-reveal honeymoon-delay-1">
        <Paper withBorder p="lg" className="honeymoon-fact">
          <Text fz={30}>🧭</Text>
          <Text fw={800} mt={4}>
            The route
          </Text>
          <Text size="sm" c="dimmed">
            {option.routeLine}
          </Text>
        </Paper>
        <Paper withBorder p="lg" className="honeymoon-fact">
          <Text fz={30}>🫶</Text>
          <Text fw={800} mt={4}>
            The pace
          </Text>
          <Text size="sm" c="dimmed">
            One lovely thing a day. Afternoons stay free.
          </Text>
        </Paper>
        <Paper withBorder p="lg" className="honeymoon-fact">
          <Text fz={30}>💸</Text>
          <Text fw={800} mt={4}>
            The plan
          </Text>
          <Text size="sm" c="dimmed">
            {rupee(planned)} planned of {rupee(plan.cap)} · {over ? `${rupee(flex)} over` : `${rupee(flex)} breathing room`}
          </Text>
        </Paper>
      </SimpleGrid>

      <Card withBorder p="lg" radius="xl" className="honeymoon-reveal honeymoon-delay-2">
        <Group gap="xs" mb={6}>
          <Title order={3}>{option.name}</Title>
          {option.tag && (
            <Badge color={option.tag === 'Cheapest' ? 'teal' : option.tag === 'Stretch' ? 'orange' : 'blue'} variant="light">
              {option.tag}
            </Badge>
          )}
        </Group>
        <Text>{option.summary}</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
          <div>
            <Text fw={700} mb={6}>
              What works
            </Text>
            <List size="sm" spacing={4} icon={<ThemeIcon color="teal" size={18} radius="xl">✓</ThemeIcon>}>
              {option.pros.map((p) => (
                <List.Item key={p}>{p}</List.Item>
              ))}
            </List>
          </div>
          <div>
            <Text fw={700} mb={6}>
              Watch out for
            </Text>
            <List size="sm" spacing={4} icon={<ThemeIcon color="orange" size={18} radius="xl">!</ThemeIcon>}>
              {option.cons.map((c) => (
                <List.Item key={c}>{c}</List.Item>
              ))}
            </List>
          </div>
        </SimpleGrid>
        <Stack gap={6} mt="md">
          <Text fw={700}>Getting there</Text>
          {option.travel.map((t) => (
            <Group key={t.label} gap="xs" wrap="nowrap" align="flex-start">
              <Text size="sm" fw={600} style={{ minWidth: 130 }}>
                {t.label}
              </Text>
              <Text size="sm" c="dimmed">
                {t.value}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>

      <div className="honeymoon-reveal honeymoon-delay-2">
        <Group justify="space-between" align="flex-end" mb="sm">
          <div>
            <Title order={2}>Pick a day 👇</Title>
            <Text c="dimmed">The whole trip at a glance. Tap for the tiny details.</Text>
          </div>
          <Badge color="rose" size="lg" variant="light">
            {selected + 1} / {days.length}
          </Badge>
        </Group>
        <div className="honeymoon-day-rail">
          {days.map((day, index) => (
            <UnstyledButton key={day.day} onClick={() => setSelected(index)} className={`honeymoon-day-chip ${selected === index ? 'is-selected' : ''}`} aria-pressed={selected === index}>
              <Text fz={24}>{day.emoji}</Text>
              <Text size="xs" fw={800}>
                {day.day}
              </Text>
              <Text size="xs" c={selected === index ? 'rose.8' : 'dimmed'}>
                {day.place}
              </Text>
            </UnstyledButton>
          ))}
        </div>
      </div>

      <Paper withBorder radius="xl" style={{ overflow: 'hidden' }} className="honeymoon-day-detail honeymoon-reveal honeymoon-delay-3">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0}>
          <Box className="honeymoon-day-image">{dayImage && <Image src={dayImage} alt={current.title} h={{ base: 260, md: 390 }} fit="cover" />}</Box>
          <Stack p={{ base: 'lg', sm: 'xl' }} gap="lg">
            <Group justify="space-between">
              <Badge color="teal" size="lg" variant="light">
                {current.date}
              </Badge>
              <Text fz={32}>{current.emoji}</Text>
            </Group>
            <div>
              <Title order={2} fz={{ base: 30, sm: 38 }}>
                {current.title}
              </Title>
              <Text c="dimmed" mt="xs">
                {current.note}
              </Text>
            </div>
            <Stack gap="md">
              {current.moments.map((m) => (
                <MomentRow key={`${current.day}-${m.time}-${m.label}`} moment={m} />
              ))}
            </Stack>
            <Paper bg="var(--mantine-color-rose-0)" p="sm" radius="md">
              <Text size="sm">
                🍽️ <Text span fw={700}>Tonight:</Text> {current.dinner}
              </Text>
            </Paper>
          </Stack>
        </SimpleGrid>
      </Paper>
      <Group justify="center" className="honeymoon-reveal honeymoon-delay-3">
        <Button variant="light" color="rose" radius="xl" disabled={selected === 0} onClick={() => setSelected((v) => v - 1)}>
          ← Previous
        </Button>
        <Button color="rose" radius="xl" disabled={selected === days.length - 1} onClick={() => setSelected((v) => v + 1)}>
          Next day ✨
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" className="honeymoon-reveal honeymoon-delay-4">
        <Paper withBorder p="xl" radius="xl">
          <Group justify="space-between">
            <div>
              <Text size="xs" fw={800} c="rose.7" tt="uppercase">
                Easy budget · {rupee(plan.cap)} cap
              </Text>
              <Title order={2}>{rupee(planned)} planned</Title>
            </div>
            <Text fz={40}>💸</Text>
          </Group>
          <Progress value={Math.min(100, (planned / plan.cap) * 100)} color={over ? 'red' : 'rose'} size="lg" radius="xl" mt="lg" />
          <Text size="sm" c="dimmed" mt={6}>
            {over
              ? `${rupee(flex)} over the cap. This only works if the package lands at the low end or you shorten the stay.`
              : `${Math.round((planned / plan.cap) * 100)}% assigned · ${rupee(flex)} still free for a dreamier room, a better flight time, or a little splurge.`}{' '}
            {plan.budgetNote ?? 'Flights are quotes; the rest are estimates.'}
          </Text>
          <SimpleGrid cols={2} spacing="xs" mt="lg">
            {costs.map(([icon, label, amount]) => (
              <Paper key={label} bg="var(--mantine-color-default-hover)" p="sm" radius="md">
                <Text size="sm">
                  {icon} {label}
                </Text>
                <Text fw={800} c={label === 'Over cap' ? 'red' : undefined}>
                  {amount}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Paper>
        <Paper className="honeymoon-booking-card" p="xl" radius="xl" c="white">
          <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: 1 }}>
            Three things to lock first
          </Text>
          <Stack mt="lg" gap="md">
            <Text>
              <Text span fw={800}>1. ✈️ Flights</Text>
              <br />
              <Text span size="sm">{option.lockFirst.flights}</Text>
            </Text>
            <Text>
              <Text span fw={800}>2. 🏨 The stay</Text>
              <br />
              <Text span size="sm">{option.lockFirst.stay}</Text>
            </Text>
            <Text>
              <Text span fw={800}>3. 🥂 Celebration dinner</Text>
              <br />
              <Text span size="sm">{option.lockFirst.dinner}</Text>
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="honeymoon-reveal honeymoon-delay-4">
        {plan.facts.map((f) => (
          <Paper key={f.label} withBorder p="md" radius="lg">
            <Text fw={800}>
              {f.icon} {f.label}
            </Text>
            <Text size="sm" c="dimmed" mt={2}>
              {f.value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Paper withBorder p="lg" radius="xl">
        <Text fw={700} mb={6}>
          Read more
        </Text>
        <Group gap="md">
          {plan.links.map((l) => (
            <Anchor key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" size="sm">
              {l.label} ↗
            </Anchor>
          ))}
        </Group>
        <List size="xs" c="dimmed" mt="md" spacing={2}>
          {plan.notes.map((n) => (
            <List.Item key={n}>{n}</List.Item>
          ))}
        </List>
        <Accordion variant="subtle" mt="sm">
          <Accordion.Item value="credits">
            <Accordion.Control>Photo credits</Accordion.Control>
            <Accordion.Panel>
              <Stack gap={2}>
                {Object.values(plan.images).map((img) => (
                  <Anchor key={img.file} href={img.source} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed">
                    {img.credit}
                  </Anchor>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Paper>
    </Stack>
  );
}
