import { Accordion, Anchor, Badge, Box, Divider, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Timeline, Title } from '@mantine/core';

type DayPlan = {
  date: string;
  place: string;
  title: string;
  mood: string;
  times: Array<{ time: string; plan: string }>;
  dinner: string;
};

const DAYS: DayPlan[] = [
  {
    date: 'Sat, 20 Feb',
    place: 'Koh Samui',
    title: 'Arrive and exhale',
    mood: 'Sunset, dinner, an early night',
    times: [
      { time: 'Morning / afternoon', plan: 'Delhi → Koh Samui via a protected Bangkok connection. Check bags through to USM.' },
      { time: 'Arrival', plan: 'Hotel transfer, check-in, shower, and a phone-light first two hours.' },
      { time: 'Golden hour', plan: 'Hotel beach or pool only — the first portraits without chasing a landmark.' },
    ],
    dinner: 'Relaxed Bophut dinner, then back by 22:00.',
  },
  {
    date: 'Sun, 21 Feb',
    place: 'Bophut',
    title: 'Village, beach, and no rush',
    mood: 'Fisherman’s Village + a beach afternoon',
    times: [
      { time: '09:00', plan: 'Long hotel breakfast; no early alarm.' },
      { time: '10:45–12:30', plan: 'Fisherman’s Village: shophouses, small galleries, and a slow browse.' },
      { time: '14:30–17:00', plan: 'Pool, book, nap, or loose sketching back at the hotel.' },
      { time: '17:15', plan: 'Barefoot Bophut beach walk and golden-hour portraits.' },
    ],
    dinner: 'Market grazing if a current Sunday market is on; otherwise, an easy Thai sit-down dinner.',
  },
  {
    date: 'Mon, 22 Feb',
    place: 'Bophut + Mae Nam',
    title: 'Make something',
    mood: 'A painting keepsake + a calm island loop',
    times: [
      { time: '09:30', plan: 'Late breakfast and a slow start.' },
      { time: '11:00–13:00', plan: 'Reserve a two-hour watercolour, acrylic, or mandala session. Materials included.' },
      { time: '15:30–17:30', plan: 'Short car-led loop: Wat Plai Laem for colour and geometry, then a seaside coffee.' },
    ],
    dinner: 'Thai sharing meal: one vegetarian curry/noodle, one seafood or chicken main, greens and rice.',
  },
  {
    date: 'Tue, 23 Feb',
    place: 'Koh Samui',
    title: 'Views and a proper celebration',
    mood: 'One gentle outing + sunset dinner',
    times: [
      { time: '09:30', plan: 'Breakfast and an easy pack for tomorrow.' },
      { time: '11:00–13:00', plan: 'A driver-led viewpoint and southern-beach lunch, paced to the day’s weather and light.' },
      { time: '15:30–17:15', plan: 'Return for a pool, nap, or massage — no second excursion.' },
      { time: '17:45', plan: 'Sunset portraits at the hotel or a nearby west-facing beach.' },
    ],
    dinner: 'Celebration dinner with a reserved waterside/sunset table and vegetarian requirements flagged in advance.',
  },
  {
    date: 'Wed, 24 Feb',
    place: 'Bangkok',
    title: 'Texture, street food, and a city night',
    mood: 'Samui breakfast → Talat Noi → Chinatown',
    times: [
      { time: 'Morning', plan: 'Breakfast, final beach walk, checkout, then an afternoon USM → BKK flight.' },
      { time: '17:30–19:00', plan: 'Talat Noi photo walk: old Chinese-Thai streets, riverside details, and workshops.' },
      { time: '19:15–21:00', plan: 'Yaowarat / Chinatown food walk, with a vegetarian choice identified in advance.' },
    ],
    dinner: 'Share a few small plates and dessert; keep the night gentle rather than turning it into nightlife.',
  },
  {
    date: 'Thu, 25 Feb',
    place: 'Bangkok → Kolkata',
    title: 'Finish deliciously',
    mood: 'Food market breakfast, then home',
    times: [
      { time: '08:00', plan: 'Checkout and store luggage.' },
      { time: '09:00–10:30', plan: 'Or Tor Kor Market for fruit, snacks, Thai ingredients, and one last market wander.' },
      { time: 'Airport buffer', plan: 'Collect bags and leave central Bangkok at least 3.5–4 hours before the international flight.' },
    ],
    dinner: 'BKK → CCU, with enough margin to end the trip feeling easy.',
  },
];

const budget = [
  ['Flights with bags', '₹1.25L'],
  ['Hotels', '₹99k'],
  ['Food & cafés', '₹42k'],
  ['Transfers', '₹18k'],
  ['Art, massage & contingency', '₹36k'],
];

export function HoneymoonItinerary() {
  return (
    <Stack gap="lg" maw={1040} mx="auto">
      <Box className="honeymoon-hero" c="white" p={{ base: 'lg', sm: 'xl' }}>
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={6} maw={650}>
            <Text size="sm" fw={700} tt="uppercase" style={{ letterSpacing: 1.1, opacity: 0.9 }}>
              20–25 February 2027
            </Text>
            <Title order={1} c="white" fz={{ base: 38, sm: 54 }} lh={1.05}>
              Koh Samui + Bangkok
            </Title>
            <Text fz={{ base: 'md', sm: 'lg' }} style={{ opacity: 0.95 }}>
              A soft landing after the wedding: views, painting, markets, Thai food, and room to do absolutely nothing.
            </Text>
          </Stack>
          <Badge color="dark" variant="white" size="lg">
            ₹4L all-in cap
          </Badge>
        </Group>
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder p="lg">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Route</Text>
          <Text fw={700} mt={6}>Delhi → Samui → Bangkok → Kolkata</Text>
          <Text size="sm" c="dimmed" mt={4}>Protected connections only; no tight self-transfer.</Text>
        </Paper>
        <Paper withBorder p="lg">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Stay</Text>
          <Text fw={700} mt={6}>4 nights Bophut + 1 night Bangkok</Text>
          <Text size="sm" c="dimmed" mt={4}>Boutique, walkable, pool and breakfast first.</Text>
        </Paper>
        <Paper withBorder p="lg">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Pace</Text>
          <Text fw={700} mt={6}>One beautiful anchor per day</Text>
          <Text size="sm" c="dimmed" mt={4}>No watersports, no rushed sightseeing, no guilt.</Text>
        </Paper>
      </SimpleGrid>

      <div>
        <Title order={2}>The plan</Title>
        <Text c="dimmed" mt={4}>Open a day for the exact rhythm. Every afternoon has protected unstructured time.</Text>
      </div>

      <Accordion variant="separated" radius="lg" defaultValue="Sat, 20 Feb">
        {DAYS.map((day) => (
          <Accordion.Item key={day.date} value={day.date}>
            <Accordion.Control>
              <Group justify="space-between" gap="sm" wrap="nowrap" pr="sm">
                <div>
                  <Text fw={700}>{day.date} · {day.title}</Text>
                  <Text size="sm" c="dimmed">{day.place} · {day.mood}</Text>
                </div>
                <ThemeIcon variant="light" color="rose" radius="xl" size="lg" aria-hidden="true">♥</ThemeIcon>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Timeline bulletSize={18} lineWidth={2} color="rose" active={day.times.length} mb="md">
                {day.times.map((item) => (
                  <Timeline.Item key={item.time} title={item.time}>
                    <Text size="sm" c="dimmed">{item.plan}</Text>
                  </Timeline.Item>
                ))}
              </Timeline>
              <Paper bg="var(--mantine-color-rose-0)" p="md" radius="md">
                <Text size="xs" tt="uppercase" fw={700} c="rose.7">Evening note</Text>
                <Text size="sm" mt={4}>{day.dinner}</Text>
              </Paper>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper withBorder p="lg">
          <Title order={3}>Food, for both of you</Title>
          <Stack gap="sm" mt="md">
            <Text size="sm"><Text span fw={700}>Vegetarian confidence:</Text> choose a dedicated vegetarian/Jay restaurant once, and ask for no fish sauce or oyster sauce in Thai dishes.</Text>
            <Text size="sm"><Text span fw={700}>Shared meals:</Text> one vegetarian curry or noodles plus one seafood/chicken main makes Thai food easy without compromise.</Text>
            <Text size="sm"><Text span fw={700}>Not to miss:</Text> mango sticky rice, coconut ice cream, curries, fruit, and an unplanned market snack.</Text>
          </Stack>
        </Paper>
        <Paper withBorder p="lg">
          <Title order={3}>Budget guardrail</Title>
          <Stack gap={7} mt="md">
            {budget.map(([label, amount]) => (
              <Group key={label} justify="space-between">
                <Text size="sm" c="dimmed">{label}</Text>
                <Text size="sm" fw={700}>{amount}</Text>
              </Group>
            ))}
            <Divider my="xs" />
            <Group justify="space-between">
              <Text fw={700}>Planned total</Text>
              <Text fw={800}>₹3.20L</Text>
            </Group>
            <Text size="sm" c="teal.7" fw={600}>₹80k buffer for a better hotel, flight timing, or a splurge.</Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="lg">
        <Title order={3}>Book in this order</Title>
        <Timeline bulletSize={22} lineWidth={2} color="rose" active={5} mt="md">
          <Timeline.Item title="Flights">Book DEL→USM, USM→BKK and BKK→CCU as a protected multi-city itinerary.</Timeline.Item>
          <Timeline.Item title="Samui stay">Four refundable Bophut nights: breakfast, pool, easy beach access, no steep or isolated location.</Timeline.Item>
          <Timeline.Item title="Bangkok stay">One refundable Charoenkrung/Riverside night for Talat Noi and Chinatown.</Timeline.Item>
          <Timeline.Item title="Transfers">Add airport transfers and a short 23 Feb car only after flights are fixed.</Timeline.Item>
          <Timeline.Item title="Keep the flex">Confirm the art session and sunset dinner 2–4 weeks out, once schedules are live.</Timeline.Item>
        </Timeline>
      </Paper>

      <Paper p="lg" bg="var(--mantine-color-default-hover)">
        <Group justify="space-between" align="flex-end" gap="md">
          <div>
            <Title order={3}>Helpful live references</Title>
            <Text size="sm" c="dimmed" mt={4}>Check entry rules, hours, menus, and weather again before paying.</Text>
          </div>
          <Group gap="md">
            <Anchor href="https://newdelhi.thaiembassy.org/en/page/visa" target="_blank" rel="noreferrer">Thai entry rules</Anchor>
            <Anchor href="https://kasetartstudio.com/" target="_blank" rel="noreferrer">Art studio</Anchor>
            <Anchor href="https://emuseum-taladnoi.treasury.go.th/en/" target="_blank" rel="noreferrer">Talat Noi</Anchor>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}
