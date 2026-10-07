import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Badge, Box, Button, Group, Image, Paper, Progress, Select, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { OPTIONS, plannedTotal, type TravelOption } from '../data/travelOptions';
import { useDestination } from '../hooks/useDestination';
import { AlternativeHoneymoon } from './AlternativeHoneymoon';
import { useRoute } from '../hooks/useRoute';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { formatRange, nightsBetween } from '../lib/planFacts';

type Moment = { icon: string; time: string; label: string };

type TripDay = {
  day: string;
  date: string;
  place: string;
  emoji: string;
  title: string;
  note: string;
  moments: Moment[];
  dinner: string;
  image: 'samui' | 'bangkok';
};

const rupee = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(2).replace(/\.?0+$/, '')}L` : `₹${Math.round(n / 1000)}k`);

// Sunday when you arrived the night before (same-day and protected routes).
const SUN_AT_VILLA: TripDay = {
  day: 'Day 2', date: 'Sun · 21 Feb', place: 'Bophut', emoji: '🧺', title: 'Shophouses, sand, snacks.',
  note: 'A pretty village morning, then the kind of afternoon with nowhere to be.',
  moments: [{ icon: '📸', time: '10:45', label: 'Fisherman’s Village stroll' }, { icon: '🏖️', time: '14:30', label: 'Pool + nap + sketchbook' }, { icon: '✨', time: '17:15', label: 'Barefoot sunset walk' }],
  dinner: 'Market grazing if one is on; Thai dinner if not.', image: 'samui',
};

const MON: TripDay = {
  day: 'Day 3', date: 'Mon · 22 Feb', place: 'Bophut + Mae Nam', emoji: '🎨', title: 'Make a honeymoon keepsake.',
  note: 'A day that leaves you with more than photos: paint something together, then see just enough island.',
  moments: [{ icon: '🖌️', time: '11:00', label: '2-hour art / mandala session' }, { icon: '🛺', time: '15:30', label: 'Short island car loop' }, { icon: '☕', time: '17:00', label: 'Seaside coffee' }],
  dinner: 'Thai sharing plates: one veg curry, one seafood/chicken main.', image: 'samui',
};

const TUE: TripDay = {
  day: 'Day 4', date: 'Tue · 23 Feb', place: 'Koh Samui', emoji: '🥂', title: 'The view day. The nice-dinner day.',
  note: 'One gentle outing, one long lunch, then get dressed up only once—at sunset.',
  moments: [{ icon: '🗺️', time: '11:00', label: 'Driver-led viewpoint' }, { icon: '💆', time: '15:30', label: 'Pool, nap or massage' }, { icon: '🌇', time: '17:45', label: 'Sunset portraits' }],
  dinner: 'Reserved waterside celebration table. Flag vegetarian needs in advance.', image: 'samui',
};

const WED: TripDay = {
  day: 'Day 5', date: 'Wed · 24 Feb', place: 'Koh Samui', emoji: '🕯️', title: 'The slow last full day.',
  note: 'Nothing to chase: a spa afternoon, one more sunset, and packing done early so tomorrow is easy.',
  moments: [{ icon: '💆', time: '14:00', label: 'Couples spa or massage' }, { icon: '🌅', time: '17:45', label: 'Last Samui sunset' }, { icon: '🧳', time: '20:00', label: 'Pack and set the alarm' }],
  dinner: 'An easy dinner near the villa. Early night.', image: 'samui',
};

const RETURN_BKK = (arrive: string): Moment[] => [
  { icon: '🚕', time: '05:15', label: 'Villa → Samui airport' },
  { icon: '✈️', time: '07:15', label: 'Samui → Bangkok (lands 08:50)' },
  { icon: '⏳', time: '08:50', label: 'Six-hour gap at Bangkok airport: lunch, rest, re-check bags' },
  { icon: '🏠', time: '15:10', label: `Bangkok → Kolkata (lands ${arrive})` },
];

function buildDays(id: string): TripDay[] {
  switch (id) {
    case 'bkk-night':
      return [
        { day: 'Day 1', date: 'Sat · 20 Feb', place: 'Delhi → Bangkok', emoji: '🏮', title: 'Fly out, sleep near the airport.', note: 'A short first hop, then a very early start. Sleep is the whole job tonight.', moments: [{ icon: '✈️', time: '15:20', label: 'Delhi → Bangkok (lands 21:05)' }, { icon: '🚕', time: '21:45', label: 'Taxi to an airport hotel' }, { icon: '🛏️', time: 'Night', label: 'About five hours of sleep' }], dinner: 'Quick bite at the airport or the hotel.', image: 'bangkok' },
        { day: 'Day 2', date: 'Sun · 21 Feb', place: 'Bangkok → Samui', emoji: '🌅', title: 'Early flight, soft landing.', note: 'The 03:45 wake-up buys you the cheap fare. By lunchtime you are by the pool.', moments: [{ icon: '⏰', time: '03:45', label: 'Wake-up and back to the airport' }, { icon: '✈️', time: '06:00', label: 'Bangkok → Samui (lands 07:10)' }, { icon: '🏖️', time: 'Afternoon', label: 'Check in, pool, nap' }], dinner: 'Fisherman’s Village, nothing fancy.', image: 'samui' },
        MON, TUE, WED,
        { day: 'Day 6', date: 'Thu · 25 Feb', place: 'Samui → Kolkata', emoji: '🏠', title: 'Home with a long layover.', note: 'Separate tickets, so the gap in Bangkok is deliberate. Lunch there, home by mid-afternoon.', moments: RETURN_BKK('16:15'), dinner: 'Home sweet Kolkata.', image: 'bangkok' },
      ];
    case 'same-day':
      return [
        { day: 'Day 1', date: 'Sat · 20 Feb', place: 'Delhi → Bangkok → Samui', emoji: '✈️', title: 'Long day, soft evening.', note: 'Two flights on separate tickets with a generous gap in between. You reach the villa around 21:00.', moments: [{ icon: '✈️', time: '08:20', label: 'Delhi → Bangkok (lands 14:10)' }, { icon: '⏳', time: '14:10', label: 'Four and a half hours at Bangkok airport' }, { icon: '✈️', time: '18:40', label: 'Bangkok → Samui (lands 19:50)' }], dinner: 'A simple dinner at the villa. Early night.', image: 'samui' },
        SUN_AT_VILLA, MON, TUE, WED,
        { day: 'Day 6', date: 'Thu · 25 Feb', place: 'Samui → Kolkata', emoji: '🏠', title: 'Home with a long layover.', note: 'Separate tickets, so the gap in Bangkok is deliberate. Lunch there, home by mid-afternoon.', moments: RETURN_BKK('16:15'), dinner: 'Home sweet Kolkata.', image: 'bangkok' },
      ];
    case 'protected':
      return [
        { day: 'Day 1', date: 'Sat · 20 Feb', place: 'Delhi → Samui', emoji: '✈️', title: 'One ticket, one stop, one landing.', note: 'If anything runs late, the airline rebooks you. You reach the villa around 21:00.', moments: [{ icon: '✈️', time: '11:00', label: 'Delhi → Samui, one stop (lands 19:50)' }, { icon: '🚕', time: '20:15', label: 'Airport → villa' }, { icon: '🛏️', time: '21:00', label: 'Check in and settle' }], dinner: 'A simple dinner at the villa. Early night.', image: 'samui' },
        SUN_AT_VILLA, MON, TUE, WED,
        { day: 'Day 6', date: 'Thu · 25 Feb', place: 'Samui → Kolkata', emoji: '🏠', title: 'One ticket home.', note: 'One booking all the way. Bags checked through, home mid-afternoon.', moments: [{ icon: '🚕', time: '05:15', label: 'Villa → Samui airport' }, { icon: '✈️', time: '07:15', label: 'Samui → Kolkata, one stop' }, { icon: '🏠', time: '16:15', label: 'Land in Kolkata' }], dinner: 'Home sweet Kolkata.', image: 'samui' },
      ];
    case 'surat':
    default:
      return [
        { day: 'Day 1', date: 'Sat · 20 Feb', place: 'Delhi → Surat Thani', emoji: '🌙', title: 'Overnight flight, honeymoon begins.', note: 'Board the evening flight (one stop at Bangkok Don Mueang) and sleep through it. You land in Surat Thani tomorrow morning.', moments: [{ icon: '🧳', time: '18:00', label: 'Airport, eye masks, neck pillows' }, { icon: '✈️', time: '20:55', label: 'Delhi → Surat Thani, one stop' }, { icon: '😴', time: 'Overnight', label: 'Sleep on the plane' }], dinner: 'Eat before you fly. Keep it light.', image: 'samui' },
        { day: 'Day 2', date: 'Sun · 21 Feb', place: 'Surat Thani → Samui', emoji: '⛴️', title: 'Ferry across, then the pool.', note: 'A bus, a ferry, and you are on the island by early afternoon. Check in and do nothing.', moments: [{ icon: '🛬', time: '08:10', label: 'Land in Surat Thani' }, { icon: '⛴️', time: '08:45', label: 'Bus to Don Sak pier, then ferry' }, { icon: '🏨', time: 'Early afternoon', label: 'Check in, pool, nap' }], dinner: 'An easy dinner near the villa.', image: 'samui' },
        MON, TUE, WED,
        { day: 'Day 6', date: 'Thu · 25 Feb', place: 'Samui → Kolkata', emoji: '🏠', title: 'A long travel day home.', note: 'Ferry and bus to the airport, then an evening flight via Bangkok. You land at 23:55, so arrange a pick-up.', moments: [{ icon: '🚐', time: '09:30', label: 'Villa → pier' }, { icon: '⛴️', time: '10:30', label: 'Ferry and bus to Surat Thani airport' }, { icon: '✈️', time: '17:40', label: 'Surat Thani → Kolkata via Bangkok (lands 23:55)' }], dinner: 'Light dinner at the airport.', image: 'samui' },
      ];
  }
}

function lockFirst(o: TravelOption): { flights: string; stay: string } {
  const flights: Record<string, string> = {
    surat: 'Book Delhi → Surat Thani as one ticket, the return as one ticket, and pre-book the ferry combo both ways.',
    'bkk-night': 'Book Bangkok → Samui (06:00) first, since the cheap seat may go. Then Delhi → Bangkok and the return legs.',
    'same-day': 'Delhi → Bangkok and Bangkok → Samui on the same day, keeping the 4h30 gap. Return via Bangkok with a long gap.',
    protected: 'One ticket Delhi → Samui and one Samui → Kolkata. The airline covers any delay.',
  };
  const area = o.id === 'surat' ? 'West coast near the ferry pier (Lipa Noi or Taling Ngam).' : 'Bophut or Choeng Mon.';
  const extra = o.bangkokNights > 0 ? ' Plus one airport-hotel night in Bangkok.' : '';
  return { flights: flights[o.id], stay: `${area} Pool, breakfast. ${o.samuiNights} nights.${extra}` };
}

function MomentRow({ moment }: { moment: Moment }) {
  return <Group gap="sm" wrap="nowrap" align="flex-start"><ThemeIcon variant="light" color="rose" radius="xl" size="lg">{moment.icon}</ThemeIcon><div><Text size="xs" c="rose.7" fw={800} tt="uppercase">{moment.time}</Text><Text size="sm" fw={600}>{moment.label}</Text></div></Group>;
}

function SamuiView({ flipLabel, onFlip }: { flipLabel?: string; onFlip?: () => void }) {
  const { routeId, isPreview, select, budgetCap: BUDGET_CAP } = useRoute();
  const { dates } = usePlanFacts();
  const [selected, setSelected] = useState(0);
  const route = OPTIONS.find((o) => o.id === routeId) ?? OPTIONS[0];
  const days = buildDays(route.id);
  const current = days[selected] ?? days[0];
  const planned = plannedTotal(route);
  const flex = BUDGET_CAP - planned;
  const lock = lockFirst(route);
  const costs: [string, string, string][] = [
    ['✈️', 'Flights', rupee(route.budget.flights)],
    ['🏨', 'Stays', rupee(route.budget.stays)],
    ['🍜', 'Food', rupee(route.budget.food)],
    ['🎨', 'Activities', rupee(route.budget.activities)],
    ['🚕', 'Local', rupee(route.budget.local)],
    ['✨', 'Flex', rupee(flex)],
  ];
  const isBangkok = current.image === 'bangkok';
  const image = isBangkok ? '/pwp-wedding-app/honeymoon/bangkok-lanterns.png' : '/pwp-wedding-app/honeymoon/samui-sunset.png';

  function chooseRoute(id: string | null) {
    if (!id) return;
    void select(id);
    setSelected(0);
  }

  return (
    <Stack gap="xl" maw={1120} mx="auto" pb="xl">
      <Paper className="honeymoon-hero honeymoon-reveal" radius="xl" style={{ overflow: 'hidden' }} shadow="lg"><Image src="/pwp-wedding-app/honeymoon/samui-sunset.png" alt="Golden-hour Koh Samui beach" h={{ base: 410, sm: 470 }} fit="cover" /><Box className="honeymoon-hero-copy"><Badge color="dark" variant="filled" size="lg">{formatRange(dates.honeymoon, { upper: true })} · {nightsBetween(dates.honeymoon)} NIGHTS</Badge><Title c="white" fz={{ base: 42, sm: 68 }} lh={0.96} mt="md">Honeymoon,<br />but make it easy. 🌴</Title><Text c="white" fz={{ base: 'md', sm: 'lg' }} mt="md" maw={520}>Koh Samui: sunsets, sketchbooks, markets, Thai food and zero pressure to “do it all”.</Text><Group mt="lg" gap="xs"><Badge variant="white" color="dark" size="lg">🏝️ {route.samuiNights} nights Samui</Badge>{route.bangkokNights > 0 && <Badge variant="white" color="dark" size="lg">🏮 {route.bangkokNights} night Bangkok</Badge>}{route.id === 'surat' && <Badge variant="white" color="dark" size="lg">🌙 Overnight flight</Badge>}</Group></Box></Paper>

      <Paper withBorder p="md" radius="xl" className="honeymoon-reveal honeymoon-delay-1">
        <Group justify="space-between" align="flex-end" gap="md">
          <Select label="Which way are we getting there?" description={isPreview ? 'Previewing only. Unlock edit mode to make this the plan for both of you.' : 'The shared plan. Fares are Google Flights quotes from 4 Oct 2026.'} value={route.id} onChange={chooseRoute} allowDeselect={false} data={OPTIONS.map((o) => ({ value: o.id, label: `${o.name} · ${rupee(o.budget.flights)} flights` }))} style={{ flex: 1, minWidth: 260 }} />
          <Group gap="xs">{onFlip && <Button variant="filled" color="dark" radius="xl" onClick={onFlip}>🔄 Flip to {flipLabel}</Button>}<Button component={Link} to="/travel" variant="light" color="rose" radius="xl">Flight timeline →</Button></Group>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="honeymoon-reveal honeymoon-delay-1">
        <Paper withBorder p="lg" className="honeymoon-fact"><Text fz={30}>🧭</Text><Text fw={800} mt={4}>The route</Text><Text size="sm" c="dimmed">{route.routeLine}</Text></Paper>
        <Paper withBorder p="lg" className="honeymoon-fact"><Text fz={30}>🫶</Text><Text fw={800} mt={4}>The pace</Text><Text size="sm" c="dimmed">One lovely thing a day. Afternoons stay free.</Text></Paper>
        <Paper withBorder p="lg" className="honeymoon-fact"><Text fz={30}>💸</Text><Text fw={800} mt={4}>The plan</Text><Text size="sm" c="dimmed">{rupee(planned)} planned of {rupee(BUDGET_CAP)} · {rupee(flex)} breathing room</Text></Paper>
      </SimpleGrid>

      <div className="honeymoon-reveal honeymoon-delay-2"><Group justify="space-between" align="flex-end" mb="sm"><div><Title order={2}>Pick a day 👇</Title><Text c="dimmed">The whole trip at a glance. Tap for the tiny details.</Text></div><Badge color="rose" size="lg" variant="light">{selected + 1} / {days.length}</Badge></Group><div className="honeymoon-day-rail">{days.map((day, index) => <UnstyledButton key={day.day} onClick={() => setSelected(index)} className={`honeymoon-day-chip ${selected === index ? 'is-selected' : ''}`} aria-pressed={selected === index}><Text fz={24}>{day.emoji}</Text><Text size="xs" fw={800}>{day.day}</Text><Text size="xs" c={selected === index ? 'rose.8' : 'dimmed'}>{day.place}</Text></UnstyledButton>)}</div></div>

      <Paper withBorder radius="xl" style={{ overflow: 'hidden' }} className="honeymoon-day-detail honeymoon-reveal honeymoon-delay-3"><SimpleGrid cols={{ base: 1, md: 2 }} spacing={0}><Box className="honeymoon-day-image"><Image src={image} alt={isBangkok ? 'Bangkok lantern-lit riverfront' : 'Koh Samui sunset'} h={{ base: 260, md: 390 }} fit="cover" /></Box><Stack p={{ base: 'lg', sm: 'xl' }} gap="lg"><Group justify="space-between"><Badge color={isBangkok ? 'orange' : 'teal'} size="lg" variant="light">{current.date}</Badge><Text fz={32}>{current.emoji}</Text></Group><div><Title order={2} fz={{ base: 30, sm: 38 }}>{current.title}</Title><Text c="dimmed" mt="xs">{current.note}</Text></div><Stack gap="md">{current.moments.map((moment) => <MomentRow key={`${current.day}-${moment.time}-${moment.label}`} moment={moment} />)}</Stack><Paper bg="var(--mantine-color-rose-0)" p="sm" radius="md"><Text size="sm">🍽️ <Text span fw={700}>Tonight:</Text> {current.dinner}</Text></Paper></Stack></SimpleGrid></Paper>
      <Group justify="center" className="honeymoon-reveal honeymoon-delay-3"><Button variant="light" color="rose" radius="xl" disabled={selected === 0} onClick={() => setSelected((value) => value - 1)}>← Previous</Button><Button color="rose" radius="xl" disabled={selected === days.length - 1} onClick={() => setSelected((value) => value + 1)}>Next day ✨</Button></Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="honeymoon-moment-gallery honeymoon-reveal honeymoon-delay-4"><Paper radius="xl" style={{ overflow: 'hidden' }}><Image src="/pwp-wedding-app/honeymoon/art-date.png" alt="Painting date in Koh Samui" h={230} fit="cover" /><Text fw={800} p="sm">🎨 Make a keepsake</Text></Paper><Paper radius="xl" style={{ overflow: 'hidden' }}><Image src="/pwp-wedding-app/honeymoon/samui-sunset.png" alt="Samui sunset" h={230} fit="cover" /><Text fw={800} p="sm">🌅 Chase the soft light</Text></Paper><Paper radius="xl" style={{ overflow: 'hidden' }}><Image src="/pwp-wedding-app/honeymoon/bangkok-lanterns.png" alt="Bangkok food evening" h={230} fit="cover" /><Text fw={800} p="sm">🏮 Eat well, every day</Text></Paper></SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" className="honeymoon-reveal honeymoon-delay-4"><Paper withBorder p="xl" radius="xl"><Group justify="space-between"><div><Text size="xs" fw={800} c="rose.7" tt="uppercase">Easy budget · {rupee(BUDGET_CAP)} cap</Text><Title order={2}>{rupee(planned)} planned</Title></div><Text fz={40}>💸</Text></Group><Progress value={(planned / BUDGET_CAP) * 100} color="rose" size="lg" radius="xl" mt="lg" /><Text size="sm" c="dimmed" mt={6}>{Math.round((planned / BUDGET_CAP) * 100)}% assigned · {rupee(flex)} still free for a dreamier room, a better flight time, or a little splurge. Flights are quotes; the rest are estimates.</Text><SimpleGrid cols={2} spacing="xs" mt="lg">{costs.map(([icon, label, amount]) => <Paper key={label} bg="var(--mantine-color-default-hover)" p="sm" radius="md"><Text size="sm">{icon} {label}</Text><Text fw={800}>{amount}</Text></Paper>)}</SimpleGrid></Paper><Paper className="honeymoon-booking-card" p="xl" radius="xl" c="white"><Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: 1 }}>Three things to lock first</Text><Stack mt="lg" gap="md"><Text><Text span fw={800}>1. ✈️ Flights</Text><br /><Text span size="sm">{lock.flights}</Text></Text><Text><Text span fw={800}>2. 🏨 Samui stay</Text><br /><Text span size="sm">{lock.stay}</Text></Text><Text><Text span fw={800}>3. 🥂 Celebration dinner</Text><br /><Text span size="sm">Reserve the 23 Feb waterside table after flights are fixed.</Text></Text></Stack><Button component="a" href="https://newdelhi.thaiembassy.org/en/page/visa" target="_blank" rel="noreferrer" variant="white" color="dark" radius="xl" mt="xl">Check Thailand entry rules ↗</Button></Paper></SimpleGrid>

      <Paper withBorder p="lg" radius="xl" className="honeymoon-reveal honeymoon-delay-4"><Group justify="space-between" gap="lg" align="center"><div><Title order={3}>The food rule: both of you eat well. 🍜</Title><Text c="dimmed" mt={4}>One veg curry/noodle + one seafood/chicken dish is the default. Ask for no fish sauce or oyster sauce where needed.</Text></div><Group gap="xs"><Badge size="lg" color="green" variant="light">🥬 Veg-friendly</Badge><Badge size="lg" color="orange" variant="light">🦐 Seafood</Badge><Badge size="lg" color="rose" variant="light">🥭 Dessert</Badge></Group></Group></Paper>
      <Group justify="center" gap="md"><Anchor href="https://kasetartstudio.com/" target="_blank" rel="noreferrer">🎨 Art studio</Anchor><Anchor href="https://emuseum-taladnoi.treasury.go.th/en/" target="_blank" rel="noreferrer">🏮 Talat Noi</Anchor></Group>
    </Stack>
  );
}

// The Samui plan is the default. If the signed-in person has been granted access to alternative plans
// (enforced in the database), the flip button cycles through them: Samui, then each alternative, then back.
// The chosen destination is shared with the Getting there and Swipe tabs.
export function HoneymoonItinerary() {
  const { plan, ready, hasAlternatives, nextLabel, flip } = useDestination();
  if (!ready) return null;
  if (plan) {
    return (
      <Box key={`alt-${plan.key}`} className="honeymoon-flip">
        <AlternativeHoneymoon key={plan.key} planKey={plan.key} plan={plan.data} nextLabel={nextLabel} onFlip={flip} />
      </Box>
    );
  }
  return (
    <Box key="home" className={hasAlternatives ? 'honeymoon-flip' : undefined}>
      <SamuiView flipLabel={hasAlternatives ? nextLabel : undefined} onFlip={hasAlternatives ? flip : undefined} />
    </Box>
  );
}
