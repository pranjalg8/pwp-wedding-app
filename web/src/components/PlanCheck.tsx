import { useState } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import type { PlanChange } from '../lib/lineBasis';
import { formatInr } from '../lib/topicMeta';

// Hotel and meal lines whose amount no longer matches the rooms or the people. Nothing changes until Update is pressed.
export function PlanCheck({ changes, isUnlocked, onSaved }: { changes: PlanChange[]; isUnlocked: boolean; onSaved: () => Promise<void> | void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (changes.length === 0) return null;

  async function update(c: PlanChange) {
    setBusy(c.line.id);
    const { error } = await supabase
      .from('payment_schedule')
      .update({ quantity: c.quantity, amount: c.amount, paridhi_amount: Math.min(c.line.paridhi_amount, c.amount) })
      .eq('id', c.line.id);
    setBusy(null);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not update', message: error.message });
      return;
    }
    notifications.show({ color: 'teal', message: `${c.line.payee} is now ${formatInr(c.amount)}.` });
    await onSaved();
  }

  return (
    <Alert color="orange" variant="light" title={`${changes.length} line${changes.length === 1 ? '' : 's'} no longer match${changes.length === 1 ? 'es' : ''} the plan`}>
      <Stack gap="xs">
        {changes.map((c) => (
          <Group key={c.line.id} justify="space-between" wrap="wrap" gap="xs">
            <div style={{ minWidth: 0, flex: '1 1 240px' }}>
              <Text size="sm" fw={500}>
                {c.line.payee}
              </Text>
              <Text size="xs" c="dimmed">
                {c.line.quantity} → {c.quantity} {c.line.unit}. {formatInr(c.line.amount)} → {formatInr(c.amount)} ({c.difference > 0 ? '+' : '−'}
                {formatInr(Math.abs(c.difference))})
              </Text>
            </div>
            {isUnlocked && (
              <Button size="compact-sm" variant="light" color="orange" loading={busy === c.line.id} onClick={() => void update(c)}>
                Update
              </Button>
            )}
          </Group>
        ))}
      </Stack>
    </Alert>
  );
}
