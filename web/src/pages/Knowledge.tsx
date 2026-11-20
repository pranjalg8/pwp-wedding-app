import { Fragment, useMemo, useState, type ReactElement } from 'react';
import { useRealtime } from '../hooks/useRealtime';
import { LoadError } from '../components/PageSkeleton';
import { Card, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

export function Knowledge() {
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const openPage = useSearchParams()[0].get('page'); // set by the Ask panel's source links

  async function load() {
    const { data, error } = await supabase.from('kb_entries').select('slug, title, body, sort_order, updated_at').order('sort_order');
    // A failed load must not look like an empty knowledge base: keep what is on screen and say so.
    setLoadError(error?.message ?? null);
    setLoaded(true);
    if (!error) setEntries((data ?? []) as KbEntry[]);
  }

  useRealtime(['kb_entries'], load, { immediate: true });

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => (q ? entries.filter((e) => (e.title + '\n' + e.body).toLowerCase().includes(q)) : []), [entries, q]);

  return (
    <Stack gap="md" maw={820} mx="auto">
      <PageHeader
        title="Knowledge"
        subtitle="A short reference for the wedding: dates, stay and food, money rules and the home move. The planner is the source of truth; if a page here disagrees with it, trust the planner."
      />
      <TextInput placeholder="Search the knowledge base" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      {loadError && <LoadError message={loadError} onRetry={() => void load()} />}
      {loaded && !loadError && !q && entries.length === 0 && (
        <EmptyState emoji="📚" title="Nothing here yet" hint="Reference pages for the wedding will show up here once they're written." />
      )}
      {q ? (
        <Stack gap="sm">
          {loaded && !loadError && hits.length === 0 && (
            <EmptyState compact emoji="🔍" title="No page mentions that" hint="Try a shorter word, or check the spelling." />
          )}
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
