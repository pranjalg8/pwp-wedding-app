import { Fragment, useMemo, useState, type ReactElement } from 'react';
import { Card, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { rowsOf } from '../lib/liveData';
import { useLiveData } from '../hooks/useLiveData';
import { LoadError } from '../components/LoadError';

type KbEntry = { slug: string; title: string; body: string; sort_order: number; updated_at: string };

// Bold text between ** pairs; everything else stays plain.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

// A small renderer for the markdown the knowledge base uses: headings, bullet lists and paragraphs.
export function Body({ text }: { text: string }) {
  const blocks: ReactElement[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`ul${blocks.length}`} style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((b, i) => (
          <li key={i}>
            <Text size="sm">{inline(b)}</Text>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  text.split('\n').forEach((raw) => {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) {
      bullets.push(line.replace(/^\s*[-*] /, ''));
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      blocks.push(
        <Title key={`h${blocks.length}`} order={h[1].length === 1 ? 3 : 4} mt="sm">
          {h[2]}
        </Title>,
      );
    } else {
      blocks.push(
        <Text key={`p${blocks.length}`} size="sm">
          {inline(line)}
        </Text>,
      );
    }
  });
  flush();
  return <Stack gap={6}>{blocks}</Stack>;
}

const NO_ENTRIES: KbEntry[] = [];

async function loadEntries() {
  return rowsOf<KbEntry>(await supabase.from('kb_entries').select('slug, title, body, sort_order, updated_at').order('sort_order'));
}

export function Knowledge() {
  const { data: entries, loaded, loadError, reload } = useLiveData({ tables: ['kb_entries'], load: loadEntries, initial: NO_ENTRIES });
  const [query, setQuery] = useState('');
  const openPage = useSearchParams()[0].get('page'); // set by the Ask panel's source links

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => (q ? entries.filter((e) => (e.title + '\n' + e.body).toLowerCase().includes(q)) : []), [entries, q]);

  return (
    <Stack gap="md" maw={820} mx="auto">
      <LoadError error={loadError} what="The knowledge base" onRetry={() => void reload()} />
      <Title order={2}>Knowledge</Title>
      <Text size="sm" c="dimmed">
        A short reference for the wedding: dates, stay and food, money rules and the home move. The planner is the source of
        truth; if a page here disagrees with it, trust the planner.
      </Text>
      <TextInput placeholder="Search the knowledge base" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      {loaded && entries.length === 0 && <Text c="dimmed">Nothing here yet.</Text>}
      {q ? (
        <Stack gap="sm">
          {hits.length === 0 && <Text c="dimmed">No page mentions that.</Text>}
          {hits.map((e) => (
            <Card key={e.slug} withBorder p="md">
              <Text fw={700} mb={6}>{e.title}</Text>
              <Body
                text={e.body
                  .split('\n')
                  .filter((l) => l.toLowerCase().includes(q))
                  .join('\n')}
              />
            </Card>
          ))}
        </Stack>
      ) : (
        entries.length > 0 && (
          <Tabs key={openPage ?? ''} defaultValue={entries.some((e) => e.slug === openPage) ? openPage! : entries[0].slug} keepMounted={false}>
            <Tabs.List style={{ flexWrap: 'wrap' }}>
              {entries.map((e) => (
                <Tabs.Tab key={e.slug} value={e.slug}>
                  {e.title}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {entries.map((e) => (
              <Tabs.Panel key={e.slug} value={e.slug} pt="md">
                <Card withBorder p="lg">
                  <Body text={e.body} />
                  <Text size="xs" c="dimmed" mt="md">
                    Updated {new Date(e.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </Card>
              </Tabs.Panel>
            ))}
          </Tabs>
        )
      )}
    </Stack>
  );
}
