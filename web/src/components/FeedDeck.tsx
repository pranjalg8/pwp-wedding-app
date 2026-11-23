import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import {
  DOMAIN_LABEL,
  KIND_META,
  ageLabel,
  dueLabel,
  type FeedCard,
  type SwipeDir,
} from '../lib/feed';

const THRESHOLD = 90;
const EXIT_MS = 220;

const STAMP: Record<SwipeDir, { text: string; cls: string }> = {
  right: { text: 'DONE', cls: 'feed-stamp-done' },
  left: { text: 'LATER', cls: 'feed-stamp-later' },
  up: { text: 'FOCUS', cls: 'feed-stamp-focus' },
  down: { text: 'WAITING', cls: 'feed-stamp-waiting' },
};

function dirOf(dx: number, dy: number): SwipeDir {
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

function CardFace({ card }: { card: FeedCard }) {
  const kind = KIND_META[card.kind];
  const due = dueLabel(card.due_date);
  return (
    <Stack gap={10} h="100%">
      <Group gap={6}>
        <Badge color={kind.color} variant="light">
          {kind.label}
        </Badge>
        {due && (
          <Badge color={due.color} variant="filled">
            {due.text}
          </Badge>
        )}
        {card.domain && (
          <Badge color="gray" variant="outline">
            {DOMAIN_LABEL[card.domain] ?? card.domain}
          </Badge>
        )}
      </Group>
      <Text fw={600} fz={22} lh={1.3} style={{ fontFamily: 'var(--mantine-font-family-headings)', flex: 1 }}>
        {card.title}
      </Text>
      {card.body && (
        <Text size="sm" c="dimmed" lineClamp={4}>
          {card.body}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {card.chat_name}
        {card.source_ts ? ` · ${ageLabel(card.source_ts)}` : ''}
        {card.msg_ref ? ` · ${card.msg_ref}` : ''}
      </Text>
    </Stack>
  );
}

function TopCard({ card, exit, onCommit }: { card: FeedCard; exit: SwipeDir | null; onCommit: (d: SwipeDir) => void }) {
  const [d, setD] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0 });

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (exit) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // best-effort
    }
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging) setD({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function up() {
    if (!dragging) return;
    setDragging(false);
    if (Math.max(Math.abs(d.x), Math.abs(d.y)) > THRESHOLD) onCommit(dirOf(d.x, d.y));
    else setD({ x: 0, y: 0 });
  }

  const fly = exit ? { right: [700, 0], left: [-700, 0], up: [0, -800], down: [0, 800] }[exit] : [d.x, d.y];
  const shown = exit ?? (Math.max(Math.abs(d.x), Math.abs(d.y)) > 12 ? dirOf(d.x, d.y) : null);
  const strength = exit ? 1 : Math.min(1, Math.max(Math.abs(d.x), Math.abs(d.y)) / THRESHOLD);

  return (
    <div
      className="feed-card"
      style={{
        transform: `translate(${fly[0]}px, ${fly[1]}px) rotate(${fly[0] / 22}deg)`,
        transition: dragging ? 'none' : `transform ${EXIT_MS}ms ease-out`,
        zIndex: 3,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {shown && (
        <div className={`feed-stamp ${STAMP[shown].cls}`} style={{ opacity: strength }}>
          {STAMP[shown].text}
        </div>
      )}
      <CardFace card={card} />
    </div>
  );
}

// A stack of cards you swipe four ways: right done, left later, up focus time, down waiting on someone.
export function FeedDeck({
  cards,
  canUndo,
  onSwipe,
  onUndo,
  onDrop,
}: {
  cards: FeedCard[];
  canUndo: boolean;
  onSwipe: (card: FeedCard, dir: SwipeDir) => void;
  onUndo: () => void;
  onDrop: (card: FeedCard) => void;
}) {
  const [exit, setExit] = useState<SwipeDir | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = cards[0];

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function commit(dir: SwipeDir) {
    if (!top || exit) return;
    setExit(dir);
    if ('vibrate' in navigator) navigator.vibrate?.(12);
    timer.current = setTimeout(() => {
      setExit(null);
      onSwipe(top, dir);
    }, EXIT_MS);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const map: Record<string, SwipeDir> = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) {
        e.preventDefault();
        commit(map[e.key]);
      } else if (e.key === 'Backspace' && canUndo) onUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const btn = (dir: SwipeDir, icon: string, label: string, color: string, size = 52) => (
    <Tooltip label={label} withArrow>
      <ActionIcon size={size} radius="xl" variant="light" color={color} aria-label={label} onClick={() => commit(dir)} disabled={!top}>
        <Text fz={size > 50 ? 24 : 18}>{icon}</Text>
      </ActionIcon>
    </Tooltip>
  );

  return (
    <div>
      <div className="feed-stage" aria-live="polite">
        {cards[2] && <div className="feed-card" style={{ transform: 'scale(0.9) translateY(26px)', zIndex: 1, opacity: 0.5 }} />}
        {cards[1] && (
          <div className="feed-card" style={{ transform: 'scale(0.95) translateY(13px)', zIndex: 2, opacity: 0.8 }}>
            <CardFace card={cards[1]} />
          </div>
        )}
        {top && <TopCard key={top.id} card={top} exit={exit} onCommit={commit} />}
      </div>

      <Group justify="center" gap="md" mt="lg" wrap="nowrap">
        {btn('left', '⏰', 'Later', 'yellow')}
        {btn('down', '⏳', 'Waiting on someone', 'gray', 44)}
        <Tooltip label="Undo" withArrow>
          <ActionIcon size={36} radius="xl" variant="subtle" color="gray" aria-label="Undo last swipe" onClick={onUndo} disabled={!canUndo}>
            <Text fz={16}>↩</Text>
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Drop, not a task" withArrow>
          <ActionIcon size={36} radius="xl" variant="subtle" color="red" aria-label="Drop card" onClick={() => top && onDrop(top)} disabled={!top}>
            <Text fz={16}>🗑</Text>
          </ActionIcon>
        </Tooltip>
        {btn('up', '🎯', 'Focus time', 'blue', 44)}
        {btn('right', '✓', 'Done', 'teal')}
      </Group>
      <Text ta="center" size="xs" c="dimmed" mt="sm">
        Swipe right done · left later · up focus · down waiting
      </Text>
    </div>
  );
}
