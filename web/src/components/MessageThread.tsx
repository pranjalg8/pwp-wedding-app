import { useState } from 'react';
import { Anchor, Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import { supabase, type ChatMessage } from '../lib/supabase';

// A collapsed list of the WhatsApp messages behind a task or option. In edit mode each
// message can be marked as chatter, which removes it from every task and from "unsorted".
export function MessageThread({
  label,
  msgIds,
  messages,
  editMode,
  onChanged,
}: {
  label: string;
  msgIds: string[];
  messages: Record<string, ChatMessage>;
  editMode: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = msgIds
    .map((id) => messages[id])
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (rows.length === 0) return null;

  async function markNoise(id: string) {
    await supabase.rpc('set_messages_noise', { p_msg_ids: [id], p_flag: true });
    onChanged();
  }

  return (
    <Stack gap={6}>
      <Anchor component="button" type="button" size="xs" c="rose.6" ta="left" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'Show'} {label} ({rows.length})
      </Anchor>
      <Collapse expanded={open}>
        <Stack gap={6}>
          {rows.map((m) => (
            <Paper key={m.id} p="xs" bg="var(--mantine-color-default-hover)" radius="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
                <div style={{ minWidth: 0 }}>
                  <Text size="xs" c="dimmed">
                    {m.from_me ? 'Pranjal' : (m.sender_name ?? 'Someone')} ·{' '}
                    {new Date(m.timestamp).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </Text>
                  <Text size="sm" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                    {m.text || `[${m.media_type || 'media'}]`}
                  </Text>
                </div>
                {editMode && (
                  <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => markNoise(m.msg_id)}>
                    Not relevant
                  </Anchor>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );
}
