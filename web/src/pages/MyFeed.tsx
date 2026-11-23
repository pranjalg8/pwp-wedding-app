import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoad } from '../hooks/useLoad';
import { Badge, Button, Card, Chip, Group, Loader, Paper, SegmentedControl, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../components/PageHeader';
import { FeedDeck } from '../components/FeedDeck';
import { useProfile } from '../hooks/useProfile';
import {
  ACTION_LABEL,
  DIR_ACTION,
  DOMAIN_LABEL,
  KIND_META,
  applyAction,
  dueLabel,
  isLive,
  loadActionDays,
  loadFeed,
  nextQuietSlot,
  slotLabel,
  type FeedAction,
  type FeedCard,
  type FeedStatus,
  type SwipeDir,
} from '../lib/feed';

type Undo = { card: FeedCard; action: FeedAction };
type Shelf = 'focus' | 'waiting' | 'snoozed';

const SHELF_LABEL: Record<Shelf, string> = { focus: 'Focus', waiting: 'Waiting', snoozed: 'Later' };

function ShelfRow({ card, onBack, onDone }: { card: FeedCard; onBack: () => void; onDone: () => void }) {
  const due = dueLabel(card.due_date);
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} lineClamp={2}>
            {card.title}
          </Text>
          <Group gap={6} mt={4}>
            <Badge size="xs" color={KIND_META[card.kind].color} variant="light">
              {KIND_META[card.kind].label}
            </Badge>
            {due && (
              <Badge size="xs" color={due.color} variant="light">
                {due.text}
              </Badge>
            )}
            {card.status === 'snoozed' && card.snooze_until && (
              <Text size="xs" c="dimmed">
                back {slotLabel(new Date(card.snooze_until))}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {card.chat_name}
            </Text>
          </Group>
        </div>
        <Group gap={4} wrap="nowrap">
          <Button size="compact-xs" variant="subtle" color="gray" onClick={onBack}>
            To feed
          </Button>
          <Button size="compact-xs" variant="light" color="teal" onClick={onDone}>
            Done
          </Button>
        </Group>
      </Group>
    </Card>
  );
}

export function MyFeed() {
  const { profile } = useProfile();
  const [cards, setCards] = useState<FeedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>('all');
  const [undo, setUndo] = useState<Undo[]>([]);
  const [stats, setStats] = useState({ today: 0, streak: 0 });
  const [shelf, setShelf] = useState<Shelf>('focus');
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setCards(await loadFeed());
      if (profile) setStats(await loadActionDays(profile.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [profile]);

  useLoad(() => refresh(), profile?.id ?? null);

  useEffect(() => {
    // New cards arrive every 15 minutes from the Mac; reload when the app comes back to the front.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(() => setNow(Date.now()), 60000); // wake snoozed cards on time
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, [refresh]);

  const live = useMemo(
    () => (cards ?? []).filter((c) => isLive(c, now) && (domain === 'all' || c.domain === domain)),
    [cards, domain, now],
  );

  const domains = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of cards ?? []) if (isLive(c, now)) n.set(c.domain ?? 'other', (n.get(c.domain ?? 'other') ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards, now]);

  const shelves = useMemo(() => {
    const pick = (s: FeedStatus) => (cards ?? []).filter((c) => c.status === s && !(s === 'snoozed' && isLive(c, now)));
    return { focus: pick('focus'), waiting: pick('waiting'), snoozed: pick('snoozed') };
  }, [cards, now]);

  async function act(card: FeedCard, action: FeedAction, prev?: FeedStatus) {
    const before = cards;
    try {
      const optimistic: FeedCard = {
        ...card,
        status: action === 'undo' ? (prev ?? 'open') : ({ done: 'done', snooze: 'snoozed', focus: 'focus', waiting: 'waiting', drop: 'dropped' } as const)[action],
        snooze_until: action === 'snooze' ? nextQuietSlot().toISOString() : null,
      };
      setCards((cs) => (cs ?? []).map((c) => (c.id === card.id ? optimistic : c)));
      await applyAction(card, action, prev);
      if (action !== 'undo') {
        setUndo((u) => [...u.slice(-19), { card, action }]);
        setStats((s) => ({ today: s.today + 1, streak: s.streak || 1 }));
      }
    } catch (e) {
      setCards(before);
      notifications.show({ color: 'red', title: "Couldn't save that swipe", message: e instanceof Error ? e.message : String(e) });
    }
  }

  function onSwipe(card: FeedCard, dir: SwipeDir) {
    const action = DIR_ACTION[dir];
    void act(card, action);
    notifications.show({
      message: action === 'snooze' ? `Back ${slotLabel(nextQuietSlot())}` : ACTION_LABEL[action],
      autoClose: 1200,
      withCloseButton: false,
    });
  }

  function onDrop(card: FeedCard) {
    void act(card, 'drop');
    notifications.show({ message: ACTION_LABEL.drop, autoClose: 1200, withCloseButton: false });
  }

  function onUndo() {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo((u) => u.slice(0, -1));
    const current = (cards ?? []).find((c) => c.id === last.card.id) ?? last.card;
    void act(current, 'undo', last.card.status);
  }

  if (error) {
    return (
      <Stack>
        <PageHeader title="My feed" icon="⚡" />
        <Text c="red">{error}</Text>
        <Button variant="light" onClick={() => void refresh()} w="fit-content">
          Try again
        </Button>
      </Stack>
    );
  }
  if (!cards) {
    return (
      <Group justify="center" mt={100}>
        <Loader color="rose" />
      </Group>
    );
  }

  return (
    <Stack gap="md" maw={520} mx="auto">
      <PageHeader
        title="My feed"
        icon="⚡"
        subtitle="Everything WhatsApp says is on you, most urgent first. Private to you."
      />

      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Badge size="lg" variant="light" color="orange">
            🔥 {stats.streak}-day streak
          </Badge>
          <Badge size="lg" variant="light" color="teal">
            {stats.today} cleared today
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {live.length} left
        </Text>
      </Group>

      <Chip.Group value={domain} onChange={(v) => setDomain(v as string)}>
        <Group gap={6}>
          <Chip value="all" size="xs">
            All
          </Chip>
          {domains.map(([d, n]) => (
            <Chip key={d} value={d} size="xs">
              {DOMAIN_LABEL[d] ?? d} {n}
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      {live.length > 0 ? (
        <FeedDeck cards={live} canUndo={undo.length > 0} onSwipe={onSwipe} onUndo={onUndo} onDrop={onDrop} />
      ) : (
        <Paper withBorder p="xl" ta="center" radius="lg">
          <Text fz={36}>✨</Text>
          <Text fw={600} mt="xs">
            All clear
          </Text>
          <Text size="sm" c="dimmed">
            New cards arrive from WhatsApp every 15 minutes.
          </Text>
          {undo.length > 0 && (
            <Button variant="subtle" mt="sm" onClick={onUndo}>
              Undo last swipe
            </Button>
          )}
        </Paper>
      )}

      <Stack gap="xs" mt="lg">
        <SegmentedControl
          fullWidth
          value={shelf}
          onChange={(v) => setShelf(v as Shelf)}
          data={(Object.keys(SHELF_LABEL) as Shelf[]).map((s) => ({ value: s, label: `${SHELF_LABEL[s]} ${shelves[s].length}` }))}
        />
        {shelves[shelf].length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="sm">
            {shelf === 'focus'
              ? 'Swipe up on anything that needs real thinking; it waits here for your next focus block.'
              : shelf === 'waiting'
                ? 'Swipe down when the ball is in someone else’s court.'
                : 'Swipe left to push a card to your next quiet slot (8am or 5pm).'}
          </Text>
        ) : (
          shelves[shelf].map((c) => (
            <ShelfRow key={c.id} card={c} onBack={() => void act(c, 'undo', 'open')} onDone={() => void act(c, 'done')} />
          ))
        )}
      </Stack>
    </Stack>
  );
}
