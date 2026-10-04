import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Badge, Group, Text } from '@mantine/core';
import { cardImageUrl } from '../lib/cardImage';
import type { SwipeCard, SwipeChoice } from '../lib/supabase';

const THRESHOLD = 100;
const TAP_SLOP = 6;
const EXIT_MS = 220;
const BG_COUNT = 6;

function bgClass(card: SwipeCard) {
  let hash = 0;
  for (const ch of card.category ?? card.title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `swipe-bg-${hash % BG_COUNT}`;
}

// A photo gets a dark gradient on top so the text stays readable; no photo falls back to the colour gradient.
function photoStyle(card: SwipeCard): React.CSSProperties {
  const img = cardImageUrl(card);
  if (!img) return {};
  return {
    backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 42%, rgba(0,0,0,0) 68%), url("${img}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 35%',
  };
}

function CardFace({ card }: { card: SwipeCard }) {
  const hasPhoto = Boolean(card.image_url);
  return (
    <>
      {!hasPhoto && (
        <div className="swipe-emoji" aria-hidden>
          {card.emoji}
        </div>
      )}
      <Group gap="xs" mb={6}>
        {card.category && (
          <Badge variant="white" color="dark" size="sm">
            {card.category}
          </Badge>
        )}
      </Group>
      <Text fw={700} size="xl" lh={1.2} style={{ fontFamily: 'var(--mantine-font-family-headings)' }}>
        {hasPhoto && card.emoji ? `${card.emoji} ` : ''}
        {card.title}
      </Text>
      {card.subtitle && (
        <Text size="md" mt={4} style={{ opacity: 0.95 }}>
          {card.subtitle}
        </Text>
      )}
      {card.detail && (
        <Text size="sm" mt={8} lineClamp={2} style={{ opacity: 0.85 }}>
          {card.detail}
        </Text>
      )}
      <Text size="xs" mt={8} style={{ opacity: 0.8 }}>
        Tap for details, photos and links
      </Text>
    </>
  );
}

function TopCard({
  card,
  exit,
  onCommit,
  onTap,
}: {
  card: SwipeCard;
  exit: SwipeChoice | null;
  onCommit: (choice: SwipeChoice) => void;
  onTap: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (exit) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort; dragging still works without it
    }
    startX.current = e.clientX;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDx(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dx) > THRESHOLD) {
      onCommit(dx > 0 ? 'yes' : 'no');
    } else {
      if (Math.abs(dx) < TAP_SLOP) onTap();
      setDx(0);
    }
  }

  const flying = exit ? (exit === 'yes' ? 1 : -1) * 700 : dx;
  const rotate = flying / 18;
  const yesOpacity = exit === 'yes' ? 1 : Math.max(0, Math.min(1, dx / THRESHOLD));
  const noOpacity = exit === 'no' ? 1 : Math.max(0, Math.min(1, -dx / THRESHOLD));

  return (
    <div
      className={`swipe-card ${bgClass(card)}`}
      style={{
        ...photoStyle(card),
        transform: `translateX(${flying}px) rotate(${rotate}deg)`,
        transition: dragging ? 'none' : `transform ${EXIT_MS}ms ease-out`,
        zIndex: 3,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="swipe-stamp yes" style={{ opacity: yesOpacity }}>
        YES
      </div>
      <div className="swipe-stamp no" style={{ opacity: noOpacity }}>
        NOPE
      </div>
      <CardFace card={card} />
    </div>
  );
}

export function SwipeDeck({
  cards,
  canUndo,
  onSwipe,
  onUndo,
  onDetails,
}: {
  cards: SwipeCard[];
  canUndo: boolean;
  onSwipe: (card: SwipeCard, choice: SwipeChoice) => void;
  onUndo: () => void;
  onDetails: (card: SwipeCard) => void;
}) {
  const [exit, setExit] = useState<SwipeChoice | null>(null);
  const top = cards[0];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Warm the cache for the next few photos so the next card is never blank.
  useEffect(() => {
    for (const c of cards.slice(1, 4)) {
      const url = cardImageUrl(c);
      if (url) new Image().src = url;
    }
  }, [cards]);

  function commit(choice: SwipeChoice) {
    if (!top || exit) return;
    setExit(choice);
    timer.current = setTimeout(() => {
      setExit(null);
      onSwipe(top, choice);
    }, EXIT_MS);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') commit('yes');
      else if (e.key === 'ArrowLeft') commit('no');
      else if (e.key === 'ArrowUp' && top) onDetails(top);
      else if (e.key === 'Backspace' && canUndo) onUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      <div className="swipe-stage" aria-live="polite">
        {cards[2] && (
          <div
            className={`swipe-card ${bgClass(cards[2])}`}
            style={{ ...photoStyle(cards[2]), transform: 'scale(0.9) translateY(24px)', zIndex: 1, opacity: 0.6 }}
          />
        )}
        {cards[1] && (
          <div
            className={`swipe-card ${bgClass(cards[1])}`}
            style={{ ...photoStyle(cards[1]), transform: 'scale(0.95) translateY(12px)', zIndex: 2, opacity: 0.85 }}
          />
        )}
        {top && <TopCard key={top.id} card={top} exit={exit} onCommit={commit} onTap={() => onDetails(top)} />}
      </div>

      <Group justify="center" gap="xl" mt="xl">
        <ActionIcon
          size={64}
          radius="xl"
          variant="light"
          color="red"
          aria-label="No"
          onClick={() => commit('no')}
          disabled={!top}
        >
          <Text size="28px">✕</Text>
        </ActionIcon>
        <ActionIcon
          size={44}
          radius="xl"
          variant="subtle"
          color="gray"
          aria-label="Undo last swipe"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Text size="20px">↩</Text>
        </ActionIcon>
        <ActionIcon
          size={44}
          radius="xl"
          variant="subtle"
          color="gray"
          aria-label="Card details"
          onClick={() => top && onDetails(top)}
          disabled={!top}
        >
          <Text size="20px">ⓘ</Text>
        </ActionIcon>
        <ActionIcon
          size={64}
          radius="xl"
          variant="light"
          color="teal"
          aria-label="Yes"
          onClick={() => commit('yes')}
          disabled={!top}
        >
          <Text size="28px">♥</Text>
        </ActionIcon>
      </Group>
      <Text ta="center" size="xs" c="dimmed" mt="sm">
        Drag or tap the card for details. Arrow keys swipe, Backspace undoes.
      </Text>
    </div>
  );
}
