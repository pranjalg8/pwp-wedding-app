import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Group, Loader, Progress, SegmentedControl, Stack, Tabs, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SwipeDeck } from '../components/SwipeDeck';
import { useProfile } from '../hooks/useProfile';
import {
  supabase,
  type Swipe,
  type SwipeCard,
  type SwipeChoice,
  type SwipeDeck as Deck,
} from '../lib/supabase';

type Person = { id: string; display_name: string };

function ResultRow({ card, mine, theirs }: { card: SwipeCard; mine?: SwipeChoice; theirs?: SwipeChoice }) {
  const color = (c?: SwipeChoice) => (c === 'yes' ? 'teal' : c === 'no' ? 'red' : 'gray');
  const label = (c?: SwipeChoice) => (c === 'yes' ? 'Yes' : c === 'no' ? 'No' : '-');
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text fw={600}>
            {card.emoji} {card.title}
          </Text>
          {card.subtitle && (
            <Text size="sm" c="dimmed">
              {card.subtitle}
            </Text>
          )}
        </div>
        <Group gap={6} wrap="nowrap">
          <Badge color={color(mine)} variant="light">
            You: {label(mine)}
          </Badge>
          <Badge color={color(theirs)} variant="light">
            Them: {label(theirs)}
          </Badge>
        </Group>
      </Group>
    </Card>
  );
}

export function Swipe() {
  const { profile } = useProfile();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckKey, setDeckKey] = useState<string | null>(null);
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [partner, setPartner] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  const deck = decks.find((d) => d.key === deckKey) ?? null;

  useEffect(() => {
    (async () => {
      const [{ data: deckRows }, { data: people }] = await Promise.all([
        supabase.from('swipe_decks').select('*').order('sort_order'),
        supabase.from('profiles').select('id, display_name'),
      ]);
      const list = (deckRows ?? []) as Deck[];
      setDecks(list);
      setDeckKey((k) => k ?? list[0]?.key ?? null);
      setPartner(((people ?? []) as Person[]).find((p) => p.id !== profile?.id) ?? null);
      setLoading(false);
    })();
  }, [profile?.id]);

  const loadDeck = useCallback(async () => {
    if (!deck) return;
    const { data: cardRows } = await supabase
      .from('swipe_cards')
      .select('*')
      .eq('deck_id', deck.id)
      .order('sort_order');
    const cardList = (cardRows ?? []) as SwipeCard[];
    setCards(cardList);
    const ids = cardList.map((c) => c.id);
    if (ids.length === 0) {
      setSwipes([]);
      return;
    }
    const { data: swipeRows } = await supabase.from('swipes').select('id, card_id, profile_id, choice').in('card_id', ids);
    setSwipes((swipeRows ?? []) as Swipe[]);
    setHistory([]);
  }, [deck]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const mineByCard = useMemo(() => {
    const m = new Map<string, SwipeChoice>();
    for (const s of swipes) if (s.profile_id === profile?.id) m.set(s.card_id, s.choice);
    return m;
  }, [swipes, profile?.id]);

  const theirsByCard = useMemo(() => {
    const m = new Map<string, SwipeChoice>();
    for (const s of swipes) if (s.profile_id !== profile?.id) m.set(s.card_id, s.choice);
    return m;
  }, [swipes, profile?.id]);

  const queue = useMemo(() => cards.filter((c) => !mineByCard.has(c.id)), [cards, mineByCard]);
  const answered = cards.length - queue.length;
  const partnerName = partner?.display_name ?? 'Partner';

  async function handleSwipe(card: SwipeCard, choice: SwipeChoice) {
    if (!profile) return;
    const optimistic: Swipe = { id: `tmp-${card.id}`, card_id: card.id, profile_id: profile.id, choice };
    setSwipes((prev) => [...prev.filter((s) => !(s.card_id === card.id && s.profile_id === profile.id)), optimistic]);
    setHistory((h) => [...h, card.id]);
    const { error } = await supabase
      .from('swipes')
      .upsert({ card_id: card.id, profile_id: profile.id, choice }, { onConflict: 'card_id,profile_id' });
    if (error) {
      setSwipes((prev) => prev.filter((s) => s.id !== optimistic.id));
      setHistory((h) => h.filter((id) => id !== card.id));
      notifications.show({ color: 'red', title: 'Could not save that swipe', message: error.message });
    }
  }

  async function handleUndo() {
    const cardId = history[history.length - 1];
    if (!cardId || !profile) return;
    const { error } = await supabase.from('swipes').delete().eq('card_id', cardId).eq('profile_id', profile.id);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not undo', message: error.message });
      return;
    }
    setSwipes((prev) => prev.filter((s) => !(s.card_id === cardId && s.profile_id === profile.id)));
    setHistory((h) => h.slice(0, -1));
  }

  const buckets = useMemo(() => {
    const out = { bothYes: [] as SwipeCard[], mixed: [] as SwipeCard[], bothNo: [] as SwipeCard[], waiting: [] as SwipeCard[] };
    for (const c of cards) {
      const mine = mineByCard.get(c.id);
      const theirs = theirsByCard.get(c.id);
      if (!mine || !theirs) out.waiting.push(c);
      else if (mine === 'yes' && theirs === 'yes') out.bothYes.push(c);
      else if (mine === 'no' && theirs === 'no') out.bothNo.push(c);
      else out.mixed.push(c);
    }
    return out;
  }, [cards, mineByCard, theirsByCard]);

  if (loading) {
    return (
      <Group justify="center" mt={80}>
        <Loader color="rose" />
      </Group>
    );
  }

  if (decks.length === 0) {
    return <Text c="dimmed">No swipe decks yet.</Text>;
  }

  const section = (title: string, rows: SwipeCard[], hint?: string) =>
    rows.length > 0 && (
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={4}>{title}</Title>
          <Badge variant="light">{rows.length}</Badge>
        </Group>
        {hint && (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        )}
        {rows.map((c) => (
          <ResultRow key={c.id} card={c} mine={mineByCard.get(c.id)} theirs={theirsByCard.get(c.id)} />
        ))}
      </Stack>
    );

  return (
    <Stack gap="md" maw={720} mx="auto">
      <Title order={2}>Swipe</Title>
      {decks.length > 1 && (
        <SegmentedControl
          value={deckKey ?? ''}
          onChange={setDeckKey}
          data={decks.map((d) => ({ value: d.key, label: d.label }))}
          fullWidth
        />
      )}
      {deck && (
        <Text size="sm" c="dimmed">
          {deck.label}. {deck.description}
        </Text>
      )}

      <Tabs defaultValue="swipe" keepMounted={false}>
        <Tabs.List grow>
          <Tabs.Tab value="swipe">Swipe</Tabs.Tab>
          <Tabs.Tab value="results">
            Results <Badge ml={6} variant="light">{buckets.bothYes.length} matches</Badge>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="swipe" pt="lg">
          <Progress value={cards.length ? (answered / cards.length) * 100 : 0} mb="xs" />
          <Text size="xs" c="dimmed" ta="center" mb="md">
            {answered} of {cards.length} answered
          </Text>
          {queue.length > 0 ? (
            <SwipeDeck cards={queue} canUndo={history.length > 0} onSwipe={handleSwipe} onUndo={handleUndo} />
          ) : (
            <Stack align="center" gap="xs" py="xl">
              <Text size="48px">🎉</Text>
              <Title order={4}>You're done with this deck</Title>
              <Text c="dimmed" ta="center">
                {buckets.waiting.length > 0
                  ? `Waiting on ${partnerName} for ${buckets.waiting.length} cards. Check Results for matches.`
                  : 'Both of you have answered everything. See the Results tab.'}
              </Text>
              {history.length > 0 && (
                <Text size="sm" c="blue" style={{ cursor: 'pointer' }} onClick={handleUndo}>
                  Undo last swipe
                </Text>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="results" pt="lg">
          <Stack gap="xl">
            {section('Both said yes', buckets.bothYes, 'These are your matches.')}
            {section('Worth a chat', buckets.mixed, 'One yes, one no.')}
            {section('Both said no', buckets.bothNo)}
            {section(`Waiting on ${partnerName}`, buckets.waiting, 'Not both answered yet.')}
            {cards.length === 0 && <Text c="dimmed">This deck has no cards.</Text>}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
