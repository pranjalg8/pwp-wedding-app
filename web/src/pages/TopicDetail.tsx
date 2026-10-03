import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { supabase, type ChatMessage, type PlanningItem, type Topic } from '../lib/supabase';
import { recordManualChange } from '../lib/audit';
import { useProfile } from '../hooks/useProfile';
import { useEditMode } from '../hooks/useEditMode';
import { ItemEditor } from '../components/ItemEditor';

const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  in_progress: 'blue',
  decided: 'teal',
  done: 'gray',
};

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

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{topic.label}</Title>
        {isUnlocked && <Button onClick={() => setEditingItem('new')}>Add item</Button>}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Amount</Table.Th>
            {isUnlocked && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id} onClick={() => isUnlocked && setEditingItem(item)} style={{ cursor: isUnlocked ? 'pointer' : 'default' }}>
              <Table.Td>
                <Text fw={500}>{item.title}</Text>
                {item.detail && (
                  <Text size="sm" c="dimmed">
                    {item.detail}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{item.type}</Table.Td>
              <Table.Td>
                <Badge color={STATUS_COLOR[item.status]}>{item.status}</Badge>
              </Table.Td>
              <Table.Td>{item.amount ? `₹${item.amount.toLocaleString('en-IN')}` : '—'}</Table.Td>
              {isUnlocked && (
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                  >
                    ✕
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {items.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed">No items yet.</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {messages.length > 0 && (
        <Accordion variant="contained">
          <Accordion.Item value="source">
            <Accordion.Control>Source WhatsApp messages ({messages.length})</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {messages.map((m) => (
                  <Text size="sm" key={m.id}>
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
