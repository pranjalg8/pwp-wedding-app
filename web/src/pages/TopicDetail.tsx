import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Accordion, ActionIcon, Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase, type ChatMessage, type PlanningItem, type Topic } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { ItemEditor } from '../components/ItemEditor';
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, TOPIC_EMOJI, formatAsOf, formatInr } from '../lib/topicMeta';

const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, decided: 2, done: 3 };

export function TopicDetail() {
  const { topicKey } = useParams();
  const { isUnlocked } = useEditMode();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [editingItem, setEditingItem] = useState<PlanningItem | null | 'new'>(null);
  const [sources, setSources] = useState<Record<string, ChatMessage>>({});
  const [openSources, setOpenSources] = useState<Set<string>>(new Set());

  function toggleSources(id: string) {
    setOpenSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function load() {
    const { data: topicData } = await supabase.from('topics').select('*').eq('key', topicKey).single();
    if (!topicData) return;
    setTopic(topicData);

    const { data: itemsData } = await supabase
      .from('planning_items')
      .select('*')
      .eq('topic_id', topicData.id)
      .order('created_at', { ascending: false });
    setItems(itemsData ?? []);

    const ids = Array.from(new Set((itemsData ?? []).flatMap((i) => i.source_msg_ids ?? [])));
    if (ids.length) {
      const { data: srcData } = await supabase.from('messages').select('*').in('msg_id', ids);
      setSources(Object.fromEntries((srcData ?? []).map((m) => [m.msg_id, m as ChatMessage])));
    } else {
      setSources({});
    }

    if (topicData.chat_match) {
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .ilike('chat_name', `%${topicData.chat_match}%`)
        .order('timestamp', { ascending: true })
        .limit(200);
      setMessages(msgData ?? []);
    } else {
      setMessages([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey]);

  useEffect(() => {
    if (!topic) return;
    const channel = supabase
      .channel(`planning_items_topic_${topic.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planning_items', filter: `topic_id=eq.${topic.id}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  async function handleDelete(item: PlanningItem) {
    const { error } = await supabase.from('planning_items').delete().eq('id', item.id);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not delete', message: error.message });
      return;
    }
    load();
  }

  if (!topic) return null;

  const sorted = [...items].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/" size="sm" c="dimmed">
        ← All areas
      </Anchor>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Text fz={32} lh={1}>
            {TOPIC_EMOJI[topic.key] ?? '✨'}
          </Text>
          <Title order={2}>{topic.label}</Title>
        </Group>
        {isUnlocked && <Button onClick={() => setEditingItem('new')}>Add item</Button>}
      </Group>

      {sorted.length === 0 && (
        <Paper withBorder p="xl" ta="center">
          <Text c="dimmed">Nothing here yet.</Text>
        </Paper>
      )}

      <Stack gap="sm">
        {sorted.map((item) => (
          <Paper
            key={item.id}
            withBorder
            p="md"
            onClick={() => isUnlocked && setEditingItem(item)}
            style={{
              cursor: isUnlocked ? 'pointer' : 'default',
              borderLeft: `4px solid var(--mantine-color-${STATUS_COLOR[item.status]}-5)`,
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Text fw={600}>{item.title}</Text>
                {item.detail && (
                  <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                    {item.detail}
                  </Text>
                )}
                {item.amount_note && (
                  <Text size="xs" c="dimmed" fs="italic" style={{ overflowWrap: 'anywhere' }}>
                    {item.amount_note}
                  </Text>
                )}
                <Group gap={6} mt={4}>
                  <Badge color={STATUS_COLOR[item.status]} variant="light">
                    {STATUS_LABEL[item.status]}
                  </Badge>
                  <Badge color="gray" variant="outline">
                    {item.type.replace('_', ' ')}
                  </Badge>
                  {item.as_of && (
                    <Badge color="gray" variant="transparent" tt="none">
                      as of {formatAsOf(item.as_of)}
                    </Badge>
                  )}
                </Group>
                {item.source_msg_ids.length > 0 && (
                  <Anchor
                    component="button"
                    type="button"
                    size="xs"
                    c="rose.6"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      toggleSources(item.id);
                    }}
                  >
                    {openSources.has(item.id) ? 'Hide' : 'Show'} sources ({item.source_msg_ids.length})
                  </Anchor>
                )}
                {openSources.has(item.id) && (
                  <Stack gap={6} mt={4} onClick={(e) => e.stopPropagation()}>
                    {item.source_msg_ids
                      .map((id) => sources[id])
                      .filter(Boolean)
                      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                      .map((m) => (
                        <Paper key={m.id} p="xs" bg="var(--mantine-color-default-hover)" radius="md">
                          <Text size="xs" c="dimmed">
                            {m.from_me ? 'Pranjal' : (m.sender_name ?? 'Someone')} ·{' '}
                            {new Date(m.timestamp).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZone: 'Asia/Kolkata',
                            })}{' '}
                            · {m.chat_name}
                          </Text>
                          <Text size="sm" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                            {m.text || `[${m.media_type || 'media'}]`}
                          </Text>
                        </Paper>
                      ))}
                  </Stack>
                )}
              </Stack>
              <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                {item.amount != null && <Text fw={700}>{formatInr(item.amount)}</Text>}
                {item.amount != null && item.amount_kind && (
                  <Badge size="xs" color={item.amount_kind === 'paid' ? 'teal' : item.amount_kind === 'planned' ? 'blue' : 'gray'} variant="light">
                    {KIND_LABEL[item.amount_kind]}
                  </Badge>
                )}
                {isUnlocked && (
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    aria-label="Delete item"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                  >
                    ✕
                  </ActionIcon>
                )}
              </Stack>
            </Group>
          </Paper>
        ))}
      </Stack>

      {messages.length > 0 && (
        <Accordion variant="contained" radius="lg">
          <Accordion.Item value="source">
            <Accordion.Control>Source WhatsApp messages ({messages.length})</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {messages.map((m) => (
                  <Text size="sm" key={m.id} style={{ overflowWrap: 'anywhere' }}>
                    <Text span fw={600}>
                      {m.from_me ? 'You' : m.sender_name}:
                    </Text>{' '}
                    {m.text || `[${m.media_type || 'media'}]`}
                  </Text>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}

      {editingItem && (
        <ItemEditor
          topicId={topic.id}
          item={editingItem === 'new' ? null : editingItem}
          opened
          onClose={() => setEditingItem(null)}
          onSaved={load}
        />
      )}
    </Stack>
  );
}
