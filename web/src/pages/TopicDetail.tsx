import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Accordion, ActionIcon, Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { supabase, type ChatMessage, type PlanningItem, type Topic } from '../lib/supabase';
import { recordManualChange } from '../lib/audit';
import { useProfile } from '../hooks/useProfile';
import { useEditMode } from '../hooks/useEditMode';
import { ItemEditor } from '../components/ItemEditor';
import { STATUS_COLOR, STATUS_LABEL, TOPIC_EMOJI, formatInr } from '../lib/topicMeta';

const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, decided: 2, done: 3 };

export function TopicDetail() {
  const { topicKey } = useParams();
  const { profile } = useProfile();
  const { isUnlocked } = useEditMode();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [editingItem, setEditingItem] = useState<PlanningItem | null | 'new'>(null);

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
    if (!error) {
      await recordManualChange({
        actorName: profile?.display_name ?? 'unknown',
        tableName: 'planning_items',
        recordId: item.id,
        action: 'delete',
        before: item,
      });
      load();
    }
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
                <Group gap={6} mt={4}>
                  <Badge color={STATUS_COLOR[item.status]} variant="light">
                    {STATUS_LABEL[item.status]}
                  </Badge>
                  <Badge color="gray" variant="outline">
                    {item.type.replace('_', ' ')}
                  </Badge>
                </Group>
              </Stack>
              <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                {item.amount != null && <Text fw={700}>{formatInr(item.amount)}</Text>}
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
