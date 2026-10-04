import { useState } from 'react';
import { Anchor, Badge, Box, Button, Group, Image, Paper, Progress, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';

type TripDay = {
  day: string;
  date: string;
  place: string;
  emoji: string;
  title: string;
  note: string;
  moments: Array<{ icon: string; time: string; label: string }>;
  dinner: string;
};

const DAYS: TripDay[] = [
  { day: 'Day 1', date: 'Sat · 20 Feb', place: 'Koh Samui', emoji: '✈️', title: 'Land, breathe, sunset.', note: 'No itinerary to chase. Just check in, dip in, and let the wedding disappear for a minute.', moments: [{ icon: '🧳', time: 'Arrive', label: 'Hotel transfer & check-in' }, { icon: '🌅', time: 'Golden hour', label: 'Beach / pool portraits' }, { icon: '🍜', time: 'Dinner', label: 'Easy Bophut table' }], dinner: 'Sleep early. Tomorrow starts slow.' },
  { day: 'Day 2', date: 'Sun · 21 Feb', place: 'Bophut', emoji: '🧺', title: 'Shophouses, sand, snacks.', note: 'A pretty village morning, then the kind of afternoon with nowhere to be.', moments: [{ icon: '📸', time: '10:45', label: 'Fisherman’s Village stroll' }, { icon: '🏖️', time: '14:30', label: 'Pool + nap + sketchbook' }, { icon: '✨', time: '17:15', label: 'Barefoot sunset walk' }], dinner: 'Market grazing if one is on; Thai dinner if not.' },
  { day: 'Day 3', date: 'Mon · 22 Feb', place: 'Bophut + Mae Nam', emoji: '🎨', title: 'Make a honeymoon keepsake.', note: 'A day that leaves you with more than photos: paint something together, then see just enough island.', moments: [{ icon: '🖌️', time: '11:00', label: '2-hour art / mandala session' }, { icon: '🛺', time: '15:30', label: 'Short island car loop' }, { icon: '☕', time: '17:00', label: 'Seaside coffee' }], dinner: 'Thai sharing plates: one veg curry, one seafood/chicken main.' },
  { day: 'Day 4', date: 'Tue · 23 Feb', place: 'Koh Samui', emoji: '🥂', title: 'The view day. The nice-dinner day.', note: 'One gentle outing, one long lunch, then get dressed up only once—at sunset.', moments: [{ icon: '🗺️', time: '11:00', label: 'Driver-led viewpoint' }, { icon: '💆', time: '15:30', label: 'Pool, nap or massage' }, { icon: '🌇', time: '17:45', label: 'Sunset portraits' }], dinner: 'Reserved waterside celebration table. Flag vegetarian needs in advance.' },
  { day: 'Day 5', date: 'Wed · 24 Feb', place: 'Bangkok', emoji: '🏮', title: 'A city night with crunch.', note: 'The connection becomes a bonus: old lanes, lanterns, small plates and a completely different set of photos.', moments: [{ icon: '✈️', time: 'Afternoon', label: 'Samui → Bangkok' }, { icon: '🏮', time: '17:30', label: 'Talat Noi photo stroll' }, { icon: '🥭', time: '19:15', label: 'Chinatown food walk' }], dinner: 'Order small, share everything, save room for dessert.' },
  { day: 'Day 6', date: 'Thu · 25 Feb', place: 'Bangkok → Kolkata', emoji: '🛍️', title: 'One last delicious morning.', note: 'Market breakfast, gifts that fit in a carry-on, then home with enough energy for family.', moments: [{ icon: '🍍', time: '09:00', label: 'Or Tor Kor Market' }, { icon: '🎁', time: '10:45', label: 'Tiny edible gifts' }, { icon: '🏠', time: 'Flight', label: 'BKK → CCU' }], dinner: 'Home sweet Kolkata.' },
];

const COSTS = [['✈️', 'Flights', '₹1.25L'], ['🏨', 'Stays', '₹99k'], ['🍜', 'Food', '₹42k'], ['🚕', 'Local', '₹18k'], ['✨', 'Flex', '₹36k']];

function Moment({ moment }: { moment: TripDay['moments'][number] }) {
  return <Group gap="sm" wrap="nowrap" align="flex-start"><ThemeIcon variant="light" color="rose" radius="xl" size="lg">{moment.icon}</ThemeIcon><div><Text size="xs" c="rose.7" fw={800} tt="uppercase">{moment.time}</Text><Text size="sm" fw={600}>{moment.label}</Text></div></Group>;
}

export function HoneymoonItinerary() {
  const [selected, setSelected] = useState(0);
  const current = DAYS[selected];
  const isBangkok = selected >= 4;
  const image = isBangkok ? '/pwp-wedding-app/honeymoon/bangkok-lanterns.png' : '/pwp-wedding-app/honeymoon/samui-sunset.png';

  return (
    <Stack gap="xl" maw={1120} mx="auto" pb="xl">
      <Paper className="honeymoon-hero honeymoon-reveal" radius="xl" style={{ overflow: 'hidden' }} shadow="lg"><Image src="/pwp-wedding-app/honeymoon/samui-sunset.png" alt="Golden-hour Koh Samui beach" h={{ base: 410, sm: 470 }} fit="cover" /><Box className="honeymoon-hero-copy"><Badge color="dark" variant="filled" size="lg">20–25 FEB 2027 · 5 NIGHTS</Badge><Title c="white" fz={{ base: 42, sm: 68 }} lh={0.96} mt="md">Honeymoon,<br />but make it easy. 🌴</Title><Text c="white" fz={{ base: 'md', sm: 'lg' }} mt="md" maw={520}>Koh Samui + Bangkok: sunsets, sketchbooks, markets, Thai food and zero pressure to “do it all”.</Text><Group mt="lg" gap="xs"><Badge variant="white" color="dark" size="lg">🏝️ 4 nights Samui</Badge><Badge variant="white" color="dark" size="lg">🏮 1 night Bangkok</Badge></Group></Box></Paper>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="honeymoon-reveal honeymoon-delay-1">
        <Paper withBorder p="lg" className="honeymoon-fact"><Text fz={30}>🧭</Text><Text fw={800} mt={4}>The route</Text><Text size="sm" c="dimmed">Delhi → Samui → Bangkok → Kolkata</Text></Paper>
        <Paper withBorder p="lg" className="honeymoon-fact"><Text fz={30}>🫶</Text><Text fw={800} mt={4}>The pace</Text><Text size="sm" c="dimmed">One lovely thing a day. Afternoons stay free.</Text></Paper>
        <Paper withBorder p="lg" className="honeymoon-fact"><Text fz={30}>💸</Text><Text fw={800} mt={4}>The plan</Text><Text size="sm" c="dimmed">₹3.20L planned · ₹80k breathing room</Text></Paper>
      </SimpleGrid>

      <div className="honeymoon-reveal honeymoon-delay-2"><Group justify="space-between" align="flex-end" mb="sm"><div><Title order={2}>Pick a day 👇</Title><Text c="dimmed">The whole trip at a glance. Tap for the tiny details.</Text></div><Badge color="rose" size="lg" variant="light">{selected + 1} / {DAYS.length}</Badge></Group><div className="honeymoon-day-rail">{DAYS.map((day, index) => <UnstyledButton key={day.day} onClick={() => setSelected(index)} className={`honeymoon-day-chip ${selected === index ? 'is-selected' : ''}`} aria-pressed={selected === index}><Text fz={24}>{day.emoji}</Text><Text size="xs" fw={800}>{day.day}</Text><Text size="xs" c={selected === index ? 'rose.8' : 'dimmed'}>{day.place}</Text></UnstyledButton>)}</div></div>

      <Paper withBorder radius="xl" style={{ overflow: 'hidden' }} className="honeymoon-day-detail honeymoon-reveal honeymoon-delay-3"><SimpleGrid cols={{ base: 1, md: 2 }} spacing={0}><Box className="honeymoon-day-image"><Image src={image} alt={isBangkok ? 'Bangkok lantern-lit riverfront' : 'Koh Samui sunset'} h={{ base: 260, md: 390 }} fit="cover" /></Box><Stack p={{ base: 'lg', sm: 'xl' }} gap="lg"><Group justify="space-between"><Badge color={isBangkok ? 'orange' : 'teal'} size="lg" variant="light">{current.date}</Badge><Text fz={32}>{current.emoji}</Text></Group><div><Title order={2} fz={{ base: 30, sm: 38 }}>{current.title}</Title><Text c="dimmed" mt="xs">{current.note}</Text></div><Stack gap="md">{current.moments.map((moment) => <Moment key={`${current.day}-${moment.time}`} moment={moment} />)}</Stack><Paper bg="var(--mantine-color-rose-0)" p="sm" radius="md"><Text size="sm">🍽️ <Text span fw={700}>Tonight:</Text> {current.dinner}</Text></Paper></Stack></SimpleGrid></Paper>
      <Group justify="center" className="honeymoon-reveal honeymoon-delay-3"><Button variant="light" color="rose" radius="xl" disabled={selected === 0} onClick={() => setSelected((value) => value - 1)}>← Previous</Button><Button color="rose" radius="xl" disabled={selected === DAYS.length - 1} onClick={() => setSelected((value) => value + 1)}>Next day ✨</Button></Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="honeymoon-moment-gallery honeymoon-reveal honeymoon-delay-4"><Paper radius="xl" style={{ overflow: 'hidden' }}><Image src="/pwp-wedding-app/honeymoon/art-date.png" alt="Painting date in Koh Samui" h={230} fit="cover" /><Text fw={800} p="sm">🎨 Make a keepsake</Text></Paper><Paper radius="xl" style={{ overflow: 'hidden' }}><Image src="/pwp-wedding-app/honeymoon/samui-sunset.png" alt="Samui sunset" h={230} fit="cover" /><Text fw={800} p="sm">🌅 Chase the soft light</Text></Paper><Paper radius="xl" style={{ overflow: 'hidden' }}><Image src="/pwp-wedding-app/honeymoon/bangkok-lanterns.png" alt="Bangkok food evening" h={230} fit="cover" /><Text fw={800} p="sm">🏮 Eat your way through Bangkok</Text></Paper></SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" className="honeymoon-reveal honeymoon-delay-4"><Paper withBorder p="xl" radius="xl"><Group justify="space-between"><div><Text size="xs" fw={800} c="rose.7" tt="uppercase">Easy budget</Text><Title order={2}>₹3.20L planned</Title></div><Text fz={40}>💸</Text></Group><Progress value={80} color="rose" size="lg" radius="xl" mt="lg" /><Text size="sm" c="dimmed" mt={6}>80% assigned · ₹80k still free for a dreamy room, a better flight time, or a little splurge.</Text><SimpleGrid cols={2} spacing="xs" mt="lg">{COSTS.map(([icon, label, amount]) => <Paper key={label} bg="var(--mantine-color-default-hover)" p="sm" radius="md"><Text size="sm">{icon} {label}</Text><Text fw={800}>{amount}</Text></Paper>)}</SimpleGrid></Paper><Paper className="honeymoon-booking-card" p="xl" radius="xl" c="white"><Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: 1 }}>Three things to lock first</Text><Stack mt="lg" gap="md"><Text><Text span fw={800}>1. ✈️ Flights</Text><br /><Text span size="sm">Protected multi-city: DEL→USM, USM→BKK, BKK→CCU.</Text></Text><Text><Text span fw={800}>2. 🏨 Samui stay</Text><br /><Text span size="sm">Bophut. Pool, breakfast, walkable beach. Four nights.</Text></Text><Text><Text span fw={800}>3. 🥂 Celebration dinner</Text><br /><Text span size="sm">Reserve the 23 Feb waterside table after flights are fixed.</Text></Text></Stack><Button component="a" href="https://newdelhi.thaiembassy.org/en/page/visa" target="_blank" rel="noreferrer" variant="white" color="dark" radius="xl" mt="xl">Check Thailand entry rules ↗</Button></Paper></SimpleGrid>

      <Paper withBorder p="lg" radius="xl" className="honeymoon-reveal honeymoon-delay-4"><Group justify="space-between" gap="lg" align="center"><div><Title order={3}>The food rule: both of you eat well. 🍜</Title><Text c="dimmed" mt={4}>One veg curry/noodle + one seafood/chicken dish is the default. Ask for no fish sauce or oyster sauce where needed.</Text></div><Group gap="xs"><Badge size="lg" color="green" variant="light">🥬 Veg-friendly</Badge><Badge size="lg" color="orange" variant="light">🦐 Seafood</Badge><Badge size="lg" color="rose" variant="light">🥭 Dessert</Badge></Group></Group></Paper>
      <Group justify="center" gap="md"><Anchor href="https://kasetartstudio.com/" target="_blank" rel="noreferrer">🎨 Art studio</Anchor><Anchor href="https://emuseum-taladnoi.treasury.go.th/en/" target="_blank" rel="noreferrer">🏮 Talat Noi</Anchor></Group>
    </Stack>
  );
}
