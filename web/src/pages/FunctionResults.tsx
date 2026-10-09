import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, Badge, Button, Card, Group, Loader, Progress, Stack, Text, Title } from '@mantine/core';
import { CardDetails } from '../components/CardDetails';
import { useProfile } from '../hooks/useProfile';
import { supabase, type Swipe, type SwipeCard, type SwipeChoice, type SwipeDeck } from '../lib/supabase';

// Decks are keyed wedding-<function>-<part>, for example wedding-sangeet-colours.
const FUNCTIONS: { key: string; label: string }[] = [
  { key: 'sangeet', label: 'Sangeet' },
  { key: 'mehndi', label: 'Mehndi' },
  { key: 'haldi', label: 'Haldi' },
  { key: 'shaadi', label: 'Wedding day' },
  { key: 'dance', label: 'Dance' },
  { key: 'photography', label: 'Photography and video' },
  { key: 'gifts', label: 'Gifts' },
];
const functionOf = (deckKey: string) => deckKey.split('-')[1] ?? '';

type Person = { id: string; display_name: string };
type Bucket = { yes: SwipeCard[]; mixed: SwipeCard[]; no: SwipeCard[]; waiting: SwipeCard[] };

function Chips({ cards, color, onOpen }: { cards: SwipeCard[]; color: string; onOpen: (c: SwipeCard) => void }) {
  return (
    <Group gap={6}>
      {cards.map((c) => (
        <Badge key={c.id} color={color} variant="light" size="lg" tt="none" style={{ cursor: 'pointer' }} onClick={() => onOpen(c)}>
          {c.emoji} {c.title}
        </Badge>
      ))}
    </Group>
  );
}

export function FunctionResults() {
  const { profile } = useProfile();
  const [decks, setDecks] = useState<SwipeDeck[]>([]);
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [partner, setPartner] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SwipeCard | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: deckRows }, { data: people }] = await Promise.all([
        supabase.from('swipe_decks').select('*').eq('destination', 'wedding').order('sort_order'),
        supabase.from('profiles').select('id, display_name'),
      ]);
      const deckList = (deckRows ?? []) as SwipeDeck[];
      setDecks(deckList);
      setPartner(((people ?? []) as Person[]).find((p) => p.id !== profile.id) ?? null);
      const ids = deckList.map((d) => d.id);
      if (ids.length) {
        const { data: cardRows } = await supabase.from('swipe_cards').select('*').in('deck_id', ids).order('sort_order');
        const cardList = (cardRows ?? []) as SwipeCard[];
        setCards(cardList);
        const { data: swipeRows } = await supabase
          .from('swipes')
          .select('id, card_id, profile_id, choice')
          .in('card_id', cardList.map((c) => c.id));
        setSwipes((swipeRows ?? []) as Swipe[]);
      }
      setLoading(false);
    })();
  }, [profile]);

  const view = useMemo(() => {
    const mine = new Map<string, SwipeChoice>();
    const theirs = new Map<string, SwipeChoice>();
    for (const s of swipes) (s.profile_id === profile?.id ? mine : theirs).set(s.card_id, s.choice);
    return decks.map((deck) => {
      const list = cards.filter((c) => c.deck_id === deck.id);
      const b: Bucket = { yes: [], mixed: [], no: [], waiting: [] };
      for (const c of list) {
        const m = mine.get(c.id);
        const t = theirs.get(c.id);
        if (!m || !t) b.waiting.push(c);
        else if (m === 'yes' && t === 'yes') b.yes.push(c);
        else if (m === 'no' && t === 'no') b.no.push(c);
        else b.mixed.push(c);
      }
      return {
        deck,
        total: list.length,
        mine: list.filter((c) => mine.has(c.id)).length,
        theirs: list.filter((c) => theirs.has(c.id)).length,
        b,
      };
    });
  }, [decks, cards, swipes, profile?.id]);

  if (loading) {
    return (
      <Group justify="center" mt={80}>
        <Loader color="rose" />
      </Group>
    );
  }

  const partnerName = partner?.display_name ?? 'Partner';
  const totals = view.reduce((a, v) => ({ yes: a.yes + v.b.yes.length, mixed: a.mixed + v.b.mixed.length, mine: a.mine + v.mine, theirs: a.theirs + v.theirs, all: a.all + v.total }), { yes: 0, mixed: 0, mine: 0, theirs: 0, all: 0 });

  return (
    <Stack gap="md" maw={820} mx="auto">
      <Group justify="space-between" align="center">
        <Title order={2}>Results</Title>
        <Button component={Link} to="/functions/swipe" color="rose" size="sm">Keep swiping</Button>
      </Group>
      <Text c="dimmed" size="sm">
        Where you both said yes, where you disagree, and what is still waiting, for every function.
      </Text>

      <Card withBorder p="md">
        <Group justify="space-between" wrap="wrap" gap="md">
          <div>
            <Text fz={28} fw={700} lh={1}>{totals.yes}</Text>
            <Text size="xs" c="dimmed">matches</Text>
          </div>
          <div>
            <Text fz={28} fw={700} lh={1}>{totals.mixed}</Text>
            <Text size="xs" c="dimmed">worth a chat</Text>
          </div>
          <div style={{ minWidth: 160 }}>
            <Text size="xs" c="dimmed">You answered {totals.mine} of {totals.all}</Text>
            <Progress value={totals.all ? (totals.mine / totals.all) * 100 : 0} mt={4} />
          </div>
          <div style={{ minWidth: 160 }}>
            <Text size="xs" c="dimmed">{partnerName} answered {totals.theirs} of {totals.all}</Text>
            <Progress value={totals.all ? (totals.theirs / totals.all) * 100 : 0} color="teal" mt={4} />
          </div>
        </Group>
      </Card>

      <Accordion multiple variant="separated" radius="md">
        {FUNCTIONS.map((fn) => {
          const parts = view.filter((v) => functionOf(v.deck.key) === fn.key);
          if (parts.length === 0) return null;
          const yes = parts.reduce((n, p) => n + p.b.yes.length, 0);
          const mixed = parts.reduce((n, p) => n + p.b.mixed.length, 0);
          const waiting = parts.reduce((n, p) => n + p.b.waiting.length, 0);
          return (
            <Accordion.Item key={fn.key} value={fn.key}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap" pr="sm">
                  <Text fw={600}>{fn.label}</Text>
                  <Group gap={6}>
                    <Badge color="teal" variant="light">{yes} matches</Badge>
                    {mixed > 0 && <Badge color="orange" variant="light">{mixed} to talk about</Badge>}
                    {waiting > 0 && <Badge color="gray" variant="light">{waiting} waiting</Badge>}
                  </Group>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="lg">
                  {parts.map(({ deck, total, mine, theirs, b }) => (
                    <Stack key={deck.id} gap="xs">
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={600}>{deck.label}</Text>
                        <Text size="xs" c="dimmed">
                          You {mine}/{total} · {partnerName} {theirs}/{total}
                        </Text>
                      </Group>
                      {b.yes.length > 0 && (
                        <div>
                          <Text size="xs" fw={600} c="teal.7" mb={4}>BOTH SAID YES</Text>
                          <Chips cards={b.yes} color="teal" onOpen={setDetail} />
                        </div>
                      )}
                      {b.mixed.length > 0 && (
                        <div>
                          <Text size="xs" fw={600} c="orange.7" mb={4}>WORTH A CHAT (ONE YES, ONE NO)</Text>
                          <Chips cards={b.mixed} color="orange" onOpen={setDetail} />
                        </div>
                      )}
                      {b.no.length > 0 && (
                        <div>
                          <Text size="xs" fw={600} c="red.7" mb={4}>BOTH SAID NO</Text>
                          <Chips cards={b.no} color="red" onOpen={setDetail} />
                        </div>
                      )}
                      {b.yes.length === 0 && b.mixed.length === 0 && b.no.length === 0 && (
                        <Text size="sm" c="dimmed">
                          Nothing to compare yet. {total - mine > 0 ? `You have ${total - mine} cards left. ` : ''}
                          {total - theirs > 0 ? `${partnerName} has ${total - theirs} left.` : ''}
                        </Text>
                      )}
                      {(mine < total || theirs < total) && (
                        <Button component={Link} to={`/functions/swipe?deck=${deck.key}`} variant="subtle" size="xs" style={{ alignSelf: 'flex-start' }}>
                          Swipe this deck
                        </Button>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
      <CardDetails card={detail} onClose={() => setDetail(null)} />
    </Stack>
  );
}
