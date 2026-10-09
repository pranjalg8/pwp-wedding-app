import { useState } from 'react';
import { Anchor, Badge, Button, Collapse, Group, Paper, Select, Stack, Text } from '@mantine/core';
import { supabase, type ChatMessage, type PlanningItem, type TaskOption } from '../lib/supabase';
import {
  KIND_LABEL,
  OPTION_STATUS_COLOR,
  OPTION_STATUS_LABEL,
  OPTION_STATUS_ORDER,
  formatInr,
  summarizeMoney,
} from '../lib/topicMeta';
import { whatsappUrl } from '../lib/whatsapp';
import { MessageThread } from './MessageThread';

function meta(option: TaskOption, key: string) {
  const v = option.metadata?.[key];
  return typeof v === 'string' && v ? v : null;
}

export function OptionCard({
  option,
  items,
  messages,
  editMode,
  onChanged,
  onEdit,
}: {
  option: TaskOption;
  items: PlanningItem[];
  messages: Record<string, ChatMessage>;
  editMode: boolean;
  onChanged: () => void;
  onEdit: (o: TaskOption) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const phone = meta(option, 'phone');
  const email = meta(option, 'email');
  const person = meta(option, 'contact_person');
  const money = summarizeMoney(items.map((i) => ({ amount: i.amount, status: i.status, amount_kind: i.amount_kind })));
  const parked = option.status === 'on_hold' || option.status === 'rejected';

  async function setStatus(status: string | null) {
    if (!status) return;
    await supabase.from('task_options').update({ status }).eq('id', option.id);
    onChanged();
  }

  return (
    <Paper
      withBorder
      p="md"
      style={{
        borderLeft: `4px solid var(--mantine-color-${OPTION_STATUS_COLOR[option.status]}-5)`,
        opacity: parked ? 0.85 : 1,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <Text fw={600} style={{ minWidth: 0 }}>
            {option.name}
          </Text>
          {editMode ? (
            <Select
              size="xs"
              w={130}
              allowDeselect={false}
              data={OPTION_STATUS_ORDER.map((s) => ({ value: s, label: OPTION_STATUS_LABEL[s] }))}
              value={option.status}
              onChange={setStatus}
              aria-label="Option status"
            />
          ) : (
            <Badge color={OPTION_STATUS_COLOR[option.status]} variant="light">
              {OPTION_STATUS_LABEL[option.status]}
            </Badge>
          )}
        </Group>

        {option.summary && (
          <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
            {option.summary}
          </Text>
        )}
        {option.why_note && (
          <Text size="xs" c="dimmed" fs="italic">
            {option.why_note}
          </Text>
        )}

        {(money.paid > 0 || money.planned > 0 || money.openCount > 0) && (
          <Group gap="md">
            {money.paid > 0 && (
              <Text size="sm" fw={600} c="teal">
                Paid {formatInr(money.paid)}
              </Text>
            )}
            {money.planned > 0 && (
              <Text size="sm" fw={600}>
                {formatInr(money.planned)}
              </Text>
            )}
            {money.openCount > 0 && (
              <Text size="sm" c="dimmed">
                {money.openCount} quote{money.openCount === 1 ? '' : 's'}
              </Text>
            )}
          </Group>
        )}

        {(person || phone || email) && (
          <Group gap="xs">
            {person && <Text size="sm">{person}</Text>}
            {phone && (
              <Anchor size="sm" href={`tel:${phone}`}>
                {phone}
              </Anchor>
            )}
            {email && (
              <Anchor size="sm" href={`mailto:${email}`}>
                {email}
              </Anchor>
            )}
            {phone && whatsappUrl(phone) && (
              <Button
                component="a"
                href={whatsappUrl(phone) as string}
                target="_blank"
                rel="noopener noreferrer"
                color="green"
                variant="light"
                size="compact-xs"
              >
                WhatsApp
              </Button>
            )}
          </Group>
        )}

        {items.length > 0 && (
          <>
            <Anchor component="button" type="button" size="xs" c="rose.6" ta="left" onClick={() => setShowDetails((o) => !o)}>
              {showDetails ? 'Hide' : 'Show'} details ({items.length})
            </Anchor>
            <Collapse expanded={showDetails}>
              <Stack gap={6}>
                {items.map((i) => (
                  <Paper key={i.id} p="xs" bg="var(--mantine-color-default-hover)" radius="md">
                    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500}>
                          {i.title}
                        </Text>
                        {i.detail && (
                          <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                            {i.detail}
                          </Text>
                        )}
                        {i.amount_note && (
                          <Text size="xs" c="dimmed" fs="italic">
                            {i.amount_note}
                          </Text>
                        )}
                      </div>
                      {i.amount != null && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <Text size="sm" fw={600}>
                            {formatInr(i.amount)}
                          </Text>
                          {i.amount_kind && (
                            <Text size="xs" c="dimmed">
                              {KIND_LABEL[i.amount_kind]}
                            </Text>
                          )}
                        </div>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Collapse>
          </>
        )}

        <MessageThread label="messages" msgIds={option.source_msg_ids} messages={messages} editMode={editMode} onChanged={onChanged} />

        {editMode && (
          <Anchor component="button" type="button" size="xs" c="dimmed" ta="left" onClick={() => onEdit(option)}>
            Edit option
          </Anchor>
        )}
      </Stack>
    </Paper>
  );
}
