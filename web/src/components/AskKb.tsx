import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Card, Drawer, Group, Loader, Stack, Text, Textarea } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { searchKb, type KbPage } from '../lib/kbSearch';
import { Body } from '../pages/Knowledge';

type Message = { role: 'user' | 'assistant'; text: string; note?: string };

const EXAMPLES = ['When is the photographer advance due?', 'Who pays for Royal Pepper?', 'How many rooms at Shri Kanth?', 'What is still open for the home move?'];

// Why the AI answer was not available, in words the couple can act on.
async function failureNote(error: unknown): Promise<string> {
  let code = '';
  try {
    const ctx = (error as { context?: Response }).context;
    code = ctx ? ((await ctx.clone().json()) as { error?: string }).error ?? '' : '';
  } catch {
    // not a JSON error body: treat as unreachable
  }
  if (code === 'not_configured') return 'AI answers are not switched on yet, so this is a keyword search of the knowledge base.';
  if (code === 'rate_limited') return 'The AI is busy right now (free limit). Here is a keyword search instead.';
  return 'The AI could not be reached. Here is a keyword search instead.';
}

export function AskKb() {
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const pages = useRef<KbPage[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

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
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('kb-chat', { body: { question: q, history } });
      if (error || !data?.answer) throw error ?? new Error('empty');
      setMessages((m) => [...m, { role: 'assistant', text: data.answer as string }]);
    } catch (e) {
      const note = await failureNote(e);
      const hits = searchKb(await knowledge(), q);
      const text = hits.length
        ? hits.map((h) => `- **${h.title}** (${h.heading}): ${h.line}`).join('\n')
        : 'Nothing in the knowledge base matches that. Try fewer or different words, or look in Tasks, Budget or Guests.';
      setMessages((m) => [...m, { role: 'assistant', text, note }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpened(true)}
        color="rose"
        radius="xl"
        size="md"
        leftSection={<span aria-hidden>💬</span>}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 150, boxShadow: 'var(--mantine-shadow-md)' }}
        aria-label="Ask the knowledge base"
      >
        Ask
      </Button>
      <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size="md" title="Ask the wedding knowledge base">
        <Stack gap="sm" style={{ minHeight: 'calc(100dvh - 110px)' }} justify="space-between">
          <Stack gap="sm">
            {messages.length === 0 && (
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Ask about dates, stay and food, money rules, the home move or vendors. Answers come only from the Knowledge page; the
                  planner stays the source of truth.
                </Text>
                {EXAMPLES.map((ex) => (
                  <Button key={ex} variant="light" color="gray" size="xs" justify="flex-start" onClick={() => ask(ex)}>
                    {ex}
                  </Button>
                ))}
              </Stack>
            )}
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <Group key={i} justify="flex-end">
                  <Card p="xs" bg="rose.1" maw="85%">
                    <Text size="sm">{m.text}</Text>
                  </Card>
                </Group>
              ) : (
                <Card key={i} withBorder p="sm">
                  {m.note && (
                    <Text size="xs" c="dimmed" mb={6}>
                      {m.note}
                    </Text>
                  )}
                  <Body text={m.text} />
                </Card>
              ),
            )}
            {busy && <Loader size="sm" color="rose" />}
            <div ref={bottom} />
          </Stack>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Textarea
                style={{ flex: 1 }}
                autosize
                minRows={1}
                maxRows={4}
                maxLength={600}
                placeholder="Ask a question"
                value={question}
                onChange={(e) => setQuestion(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(question);
                  }
                }}
              />
              <ActionIcon type="submit" size="lg" color="rose" variant="filled" disabled={busy || !question.trim()} aria-label="Send">
                ➤
              </ActionIcon>
            </Group>
          </form>
        </Stack>
      </Drawer>
    </>
  );
}
