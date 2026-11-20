import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CloseButton, Group, Paper, Progress, Stack, Text } from '@mantine/core';
import { TourContext } from '../hooks/useTour';

// A guided tour of the planner for someone new. Each stop opens a page and a card explains what it is for and how
// it connects to the rest, in the order work flows: decide (tasks), organise (areas, functions, guests), pay
// (budget), look things up (knowledge), then share and review. It is offered once per device; after that it can be
// started again from the menu.

type Stop = { to: string; icon: string; title: string; body: string };

const TOUR_STOPS: Stop[] = [
  {
    to: '/',
    icon: '👋',
    title: 'Welcome to the planner',
    body: 'This is where Pranjal and Paridhi keep the whole wedding in one place: what to decide, what to pay, who is coming and where they stay. The tour opens each page in the order things flow. It takes about two minutes, and you can leave at any time.',
  },
  {
    to: '/',
    icon: '🏠',
    title: 'Home: today at a glance',
    body: 'The countdown, what is due next, what still needs a decision, alerts and money so far. Further down, the Timeline lays out every dated task, payment and function up to the honeymoon. Tap any line on it to jump to where that thing is handled.',
  },
  {
    to: '/tasks',
    icon: '✅',
    title: 'Tasks: deciding things',
    body: 'Every job is a task with an owner, a priority and a due date. Open one to compare its options (a venue, a photographer, an outfit), read the chat messages it came from, and mark the option you chose.',
  },
  {
    to: '/areas',
    icon: '🗂️',
    title: 'Areas: the same work by topic',
    body: 'Tasks, options and notes grouped by topic, such as stay, food, outfits, jewellery and the new home. Use it when you want everything about one subject together.',
  },
  {
    to: '/functions',
    icon: '🎉',
    title: 'Functions: the wedding days',
    body: 'Each event with its date, part of the day, colours and replies. "Pick looks together" lets you both swipe on colours and outfits, and "Results" shows where you agree.',
  },
  {
    to: '/guests',
    icon: '👥',
    title: 'Guests: who is coming and where they sleep',
    body: 'Households, who is invited to which day, and their replies. The rooms view places each household in a hotel room for each night.',
  },
  {
    to: '/budget',
    icon: '💰',
    title: 'Budget: paying for it',
    body: 'What is paid, what is still to pay and when, how it splits between Pranjal and Paridhi, and whether each month is covered.',
  },
  {
    to: '/knowledge',
    icon: '📚',
    title: 'Knowledge: quick answers',
    body: 'A short reference for dates, stay and food, money rules and the home move. The "Ask" button in the corner answers questions from these pages. Vendors, next to it in the menu, lists everyone being paid.',
  },
  {
    to: '/honeymoon',
    icon: '🏝️',
    title: 'Honeymoon',
    body: 'The trip after the wedding: the day-by-day itinerary, "Getting there" for flights and routes, and a swipe deck for places and stays.',
  },
  {
    to: '/activity',
    icon: '🔔',
    title: 'Activity: what changed and what is waiting',
    body: 'History records every edit. Suggestions holds changes Claude proposes from new chat messages and bill photos; nothing changes until one of you accepts. "What\'s new" lists each version of the planner.',
  },
  {
    to: '/share',
    icon: '🔗',
    title: 'Share: show family a part of it',
    body: 'Make a link to just the sections you choose. Family and vendors open it without signing in, links expire within 3 days, and you can revoke one at any time.',
  },
  {
    to: '/',
    icon: '🔒',
    title: 'Reading is open, editing needs the PIN',
    body: 'Anyone signed in can read everything. To add or change something, press an Add or Edit button or the lock in the header and enter the PIN. Editing locks itself after 30 minutes without activity. That is the tour; you can take it again from the menu.',
  },
];

const SEEN_KEY = 'pwp.tour.seen';

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // storage blocked: do not nag on every load
  }
}

function writeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked: nothing to remember
  }
}

const cardStyle = {
  position: 'fixed',
  right: 16,
  // Above the "Ask" button and, on phones, above the tab bar (--bottom-nav-height is 0 on desktop).
  bottom: 'calc(76px + max(var(--bottom-nav-height, 0px), env(safe-area-inset-bottom)))',
  width: 'min(380px, calc(100vw - 32px))',
  zIndex: 200,
} as const;

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<number | null>(null);
  const [offer, setOffer] = useState(() => !readSeen());

  const go = useCallback(
    (i: number) => {
      setStep(i);
      navigate(TOUR_STOPS[i].to);
      window.scrollTo({ top: 0 });
    },
    [navigate]
  );

  const start = useCallback(() => {
    setOffer(false);
    go(0);
  }, [go]);

  const end = useCallback(() => {
    writeSeen();
    setOffer(false);
    setStep(null);
  }, []);

  // Escape leaves the tour; the arrow keys move between stops (ignored while typing in a field).
  useEffect(() => {
    if (step === null) return;
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.key === 'Escape') end();
      else if (ev.key === 'ArrowRight' && step !== null && step < TOUR_STOPS.length - 1) go(step + 1);
      else if (ev.key === 'ArrowLeft' && step !== null && step > 0) go(step - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, go, end]);

  const value = useMemo(() => ({ start, active: step !== null }), [start, step]);
  const stop = step === null ? null : TOUR_STOPS[step];
  const last = step === TOUR_STOPS.length - 1;

  return (
    <TourContext.Provider value={value}>
      {children}

      {offer && step === null && (
        <Paper shadow="lg" radius="md" p="md" withBorder style={cardStyle} role="dialog" aria-label="Take the tour">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Text fw={700}>New here? 👋</Text>
            <CloseButton size="sm" onClick={end} aria-label="Not now" />
          </Group>
          <Text size="sm" mt={4}>
            A two-minute tour shows what each page is for and how they connect.
          </Text>
          <Group mt="sm" gap="xs">
            <Button size="xs" color="rose" onClick={start}>
              Take the tour
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={end}>
              Not now
            </Button>
          </Group>
        </Paper>
      )}

      {stop && step !== null && (
        <Paper shadow="xl" radius="md" p="md" withBorder style={cardStyle} role="dialog" aria-live="polite" aria-label={`Tour, stop ${step + 1} of ${TOUR_STOPS.length}`}>
          <Stack gap="xs">
            <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
              <Text size="xs" c="dimmed" fw={600}>
                Tour · {step + 1} of {TOUR_STOPS.length}
              </Text>
              <CloseButton size="sm" onClick={end} aria-label="End the tour" />
            </Group>
            <Progress value={((step + 1) / TOUR_STOPS.length) * 100} size="xs" color="rose" />
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <Text fz={22} lh={1.2} aria-hidden>
                {stop.icon}
              </Text>
              <Box style={{ minWidth: 0 }}>
                <Text fw={700} lh={1.3}>
                  {stop.title}
                </Text>
                <Text size="sm" mt={4}>
                  {stop.body}
                </Text>
              </Box>
            </Group>
            <Group justify="space-between" mt={4}>
              <Button size="xs" variant="subtle" color="gray" onClick={() => go(step - 1)} disabled={step === 0}>
                Back
              </Button>
              <Button size="xs" color="rose" onClick={() => (last ? end() : go(step + 1))}>
                {last ? 'Finish' : 'Next'}
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </TourContext.Provider>
  );
}
