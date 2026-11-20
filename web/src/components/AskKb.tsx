import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ActionIcon, Badge, Box, Button, CopyButton, Drawer, Group, Loader, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { useHotkeys, useMediaQuery } from '@mantine/hooks';
import { supabase } from '../lib/supabase';
import { searchKb, sourcesIn, type KbPage } from '../lib/kbSearch';
import { Body } from '../pages/Knowledge';
import { QuoteUpload } from './QuoteUpload';

type Source = { slug: string; title: string };
type Proposed = { kind: string; label: string };
type Message = { role: 'user' | 'assistant'; text: string; note?: string; sources?: Source[]; proposed?: Proposed[] };

const STORE_KEY = 'pwp-ask-kb';

// A few starting questions that fit the page you are on.
const GENERAL = ['What is due this week?', 'When is the photographer advance due?', 'How many rooms at Shri Kanth?', 'Add a task: confirm the dhol wala by Friday'];
const BY_PAGE: Record<string, string[]> = {
  '/budget': ['Which payments are due next?', 'How much do we still have to pay in total?', 'How is the photographer paid?', 'What is already paid?', 'What is not in our budget and why?'],
  '/guests': ['How many guests are invited?', 'Which families may skip because of exams?', 'How do the rooms work?'],
  '/functions': ['What happens on 13 Feb?', 'What is the plan for 15 Feb?', 'Which decor themes are chosen?'],
  '/vendors': ['Which photographers are shortlisted?', 'What is the status of the jewellery?', 'What do the Shri Kanth meals cost?'],
  '/honeymoon': ['Where are we going on the honeymoon?', 'What is the honeymoon budget?'],
  '/tasks': ['What is due this week?', 'What deadlines are coming up?', 'Add a task: call the caterer next Monday'],
};
function startersFor(path: string): string[] {
  const key = Object.keys(BY_PAGE).find((k) => path.startsWith(k));
  return key ? BY_PAGE[key] : GENERAL;
}

function loadSaved(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

// Why the AI answer was not available, in words the couple can act on.
async function failureNote(error: unknown): Promise<string> {
  let code = '';
  try {
    const ctx = (error as { context?: Response }).context;
    code = ctx ? ((await ctx.clone().json()) as { error?: string }).error ?? '' : '';
  } catch {
    // not a JSON error body: treat as unreachable
  }
  if (code === 'not_configured') return 'AI answers are not switched on, so this is a keyword search of the Knowledge page.';
  if (code === 'rate_limited') return 'The AI is busy (free limit). This is a keyword search of the Knowledge page.';
  return 'The AI could not be reached. This is a keyword search of the Knowledge page.';
}

function Thinking() {
  return (
    <Group gap={8} px="xs" aria-live="polite">
      <Loader type="dots" size="sm" color="rose" />
      <Text size="sm" c="dimmed">Reading the knowledge base…</Text>
    </Group>
  );
}

export function AskKb() {
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadSaved);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const pages = useRef<KbPage[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const isPhone = useMediaQuery('(max-width: 36em)');
  const { pathname } = useLocation();

  useHotkeys([['mod+K', () => setOpened((o) => !o)]], []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      // storage unavailable: the chat just is not remembered
    }
  }, [messages]);

  useEffect(() => {
    if (opened) bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, opened]);

  async function knowledge(): Promise<KbPage[]> {
    if (!pages.current) {
      const { data } = await supabase.from('kb_entries').select('slug, title, body').order('sort_order');
      pages.current = (data ?? []) as KbPage[];
    }
    return pages.current;
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages.filter((m) => !m.note).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    setLastFailed(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('kb-chat', { body: { question: q, history } });
      if (error || !data?.answer) throw error ?? new Error('empty');
      const answer = data.answer as string;
      const sources = sourcesIn(await knowledge(), answer);
      const proposed = (data.proposed ?? []) as Proposed[];
      setMessages((m) => [...m, { role: 'assistant', text: answer, sources, proposed }]);
    } catch (e) {
      const note = await failureNote(e);
      const hits = searchKb(await knowledge(), q);
      const found = hits.length
        ? hits.map((h) => `- **${h.title}** (${h.heading}): ${h.line}`).join('\n')
        : 'Nothing in the knowledge base matches that. Try fewer or different words, or look in Tasks, Budget or Guests.';
      const seen = new Set<string>();
      const sources = hits.filter((h) => !seen.has(h.slug) && seen.add(h.slug)).map((h) => ({ slug: h.slug, title: h.title }));
      setMessages((m) => [...m, { role: 'assistant', text: found, note, sources }]);
      setLastFailed(q);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setMessages([]);
    setLastFailed(null);
    input.current?.focus();
  }

  const starters = startersFor(pathname);

  return (
    <>
      {!opened && (
        <Tooltip label="Ask the knowledge base (Ctrl/⌘ K)" position="left" visibleFrom="sm">
          <Button
            onClick={() => setOpened(true)}
            color="rose"
            radius="xl"
            size={isPhone ? 'lg' : 'md'}
            px={isPhone ? 'md' : 'lg'}
            leftSection={<span aria-hidden>💬</span>}
            style={{
              position: 'fixed',
              right: 16,
              // Sits above the phone tab bar (--bottom-nav-height is 0 on desktop).
              bottom: 'calc(16px + max(var(--bottom-nav-height, 0px), env(safe-area-inset-bottom)))',
              zIndex: 150,
              boxShadow: 'var(--mantine-shadow-md)',
            }}
            aria-label="Ask the knowledge base"
          >
            Ask
          </Button>
        </Tooltip>
      )}
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position={isPhone ? 'bottom' : 'right'}
        size={isPhone ? '88%' : 440}
        padding={0}
        radius={isPhone ? 'lg' : 0}
        withCloseButton={false}
        trapFocus
        returnFocus
        transitionProps={{ duration: 150 }}
        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
        aria-label="Ask the wedding knowledge base"
      >
        <Group justify="space-between" wrap="nowrap" px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <div>
            <Text fw={700} lh={1.2}>Ask about the wedding</Text>
            <Text size="xs" c="dimmed">Answers use the Knowledge page and live planner numbers</Text>
          </div>
          <Group gap={4} wrap="nowrap">
            <QuoteUpload label="Quote" variant="subtle" />
            {messages.length > 0 && (
              <Tooltip label="Start over">
                <Button variant="subtle" color="gray" size="compact-sm" onClick={clear}>
                  New chat
                </Button>
              </Tooltip>
            )}
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setOpened(false)} aria-label="Close">
              ✕
            </ActionIcon>
          </Group>
        </Group>

        <Box style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }} px="md" py="md">
          <Stack gap="md">
            {messages.length === 0 && (
              <Stack gap="sm" align="stretch" pt="sm">
                <Text size="xl" ta="center" aria-hidden>💬</Text>
                <Text size="sm" ta="center" c="dimmed">
                  Ask about dates, money, rooms or what is due. You can also say “add a task: …” and it will be proposed for you to accept. The planner stays the source of truth.
                </Text>
                <Stack gap={6}>
                  {starters.map((ex) => (
                    <Button key={ex} variant="light" color="rose" size="sm" justify="flex-start" onClick={() => ask(ex)} styles={{ label: { whiteSpace: 'normal', textAlign: 'left' } }} h="auto" py={8}>
                      {ex}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <Group key={i} justify="flex-end">
                  <Box bg="rose.6" c="white" px="sm" py={8} maw="85%" style={{ borderRadius: 14, borderBottomRightRadius: 4 }}>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</Text>
                  </Box>
                </Group>
              ) : (
                <Box key={i} maw="95%">
                  <Box bg="var(--mantine-color-default-hover)" px="sm" py="sm" style={{ borderRadius: 14, borderBottomLeftRadius: 4 }}>
                    {m.note && (
                      <Badge variant="light" color="gray" size="sm" mb={6} tt="none" fw={500} styles={{ label: { whiteSpace: 'normal' } }} h="auto" py={3}>
                        {m.note}
                      </Badge>
                    )}
                    <Body text={m.sources?.length ? m.text.replace(/\s*\[[^\]]+\]\s*$/, '') : m.text} />
                  </Box>
                  {(m.proposed ?? []).length > 0 && (
                    <Box mt={6} p="xs" style={{ border: '1px solid var(--mantine-color-rose-3)', borderRadius: 10 }}>
                      <Text size="xs" fw={700} c="rose.7" tt="uppercase" style={{ letterSpacing: 0.4 }}>Proposed, waiting for your OK</Text>
                      {m.proposed!.map((p, k) => (
                        <Text key={k} size="sm" style={{ overflowWrap: 'anywhere' }}>• {p.label}</Text>
                      ))}
                      <Button component={Link} to="/activity/suggestions" onClick={() => setOpened(false)} size="compact-sm" variant="light" color="rose" mt={6}>
                        Review in Suggestions
                      </Button>
                    </Box>
                  )}
                  <Group gap={6} mt={6} px={4} wrap="wrap">
                    {(m.sources ?? []).map((s) => (
                      <Badge key={s.slug} component={Link} to={`/knowledge?page=${s.slug}`} onClick={() => setOpened(false)} variant="outline" color="rose" size="md" tt="none" fw={600} style={{ cursor: 'pointer' }}>
                        {s.title} ↗
                      </Badge>
                    ))}
                    <CopyButton value={m.text}>
                      {({ copied, copy }) => (
                        <Button variant="subtle" color="gray" size="compact-xs" onClick={copy}>
                          {copied ? 'Copied' : 'Copy'}
                        </Button>
                      )}
                    </CopyButton>
                    {i === messages.length - 1 && lastFailed && !busy && (
                      <Button variant="subtle" color="rose" size="compact-xs" onClick={() => ask(lastFailed)}>
                        Try AI again
                      </Button>
                    )}
                  </Group>
                </Box>
              ),
            )}
            {busy && <Thinking />}
            <div ref={bottom} />
          </Stack>
        </Box>

        <Box px="md" pt="xs" pb="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Textarea
                ref={input}
                data-autofocus
                style={{ flex: 1 }}
                autosize
                minRows={1}
                maxRows={4}
                maxLength={600}
                placeholder="Ask a question…"
                aria-label="Your question"
                enterKeyHint="send"
                value={question}
                onChange={(e) => setQuestion(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    ask(question);
                  }
                }}
              />
              <ActionIcon type="submit" size={36} radius="xl" color="rose" variant="filled" disabled={busy || !question.trim()} aria-label="Send">
                ➤
              </ActionIcon>
            </Group>
            <Text size="xs" c="dimmed" mt={6} visibleFrom="sm">
              Enter to send, Shift+Enter for a new line
            </Text>
          </form>
        </Box>
      </Drawer>
    </>
  );
}
