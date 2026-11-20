import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion, Alert, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import type { StoredFlag } from '../hooks/useBudgetFlags';
import { fingerprint, reviewBudget, SEVERITY_LABEL, type Flag, type ReviewInput, type Severity } from '../../../supabase/functions/budget-review/checks';

const COLOR: Record<Severity, string> = { error: 'red', warning: 'orange', info: 'blue' };

type Shown = { flag: Flag; print: string; stored: StoredFlag | undefined };

// The budget review agent on the Budget page. The rule-based checks run here on every change, so the numbers are
// always reviewed; the stored flags add the AI's question and remember what you decided. Nothing on this panel
// changes a payment by itself: Fix opens the normal editor, and Fix, Confirm and Dismiss all ask for the PIN first.
export function BudgetReview({ input, stored, onFix }: { input: ReviewInput; stored: StoredFlag[]; onFix: (f: Flag) => void }) {
  const { requestUnlock } = useEditMode();
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const autoRan = useRef(false);

  const live = useMemo(() => reviewBudget(input), [input]);
  const byPrint = useMemo(() => new Map(stored.map((s) => [s.fingerprint, s])), [stored]);
  const all: Shown[] = useMemo(() => live.map((flag) => ({ flag, print: fingerprint(flag), stored: undefined })).map((x) => ({ ...x, stored: byPrint.get(x.print) })), [live, byPrint]);
  const decided = all.filter((x) => x.stored && (x.stored.status === 'confirmed' || x.stored.status === 'dismissed'));
  const open = all.filter((x) => !decided.includes(x));
  const loud = open.filter((x) => x.flag.severity !== 'info');
  const quiet = open.filter((x) => x.flag.severity === 'info');
  const unrecorded = open.filter((x) => !x.stored).length;

  async function reviewNow(silent = false) {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('budget-review', { body: {} });
    setRunning(false);
    if (error || !data) {
      if (!silent) notifications.show({ color: 'red', title: 'The review could not run', message: 'The checks above are still live. The reviewer service may not be set up yet.' });
      return;
    }
    if (!silent) notifications.show({ color: 'teal', message: `Reviewed: ${data.count} finding${data.count === 1 ? '' : 's'}, ${data.new} new${data.ai === 'not_configured' ? '. The AI is not set up, so there are no questions yet.' : ''}.` });
  }

  // Record new findings once per visit, so each one has a row to confirm or dismiss and gets its question.
  useEffect(() => {
    if (unrecorded > 0 && !autoRan.current) {
      autoRan.current = true;
      void reviewNow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unrecorded]);

  function decide(x: Shown, status: 'confirmed' | 'dismissed' | 'open') {
    if (!x.stored) return;
    const id = x.stored.id;
    requestUnlock(async () => {
      setBusy(id);
      const { error } = await supabase.rpc('decide_budget_flag', { p_id: id, p_status: status, p_note: null });
      setBusy(null);
      if (error) notifications.show({ color: 'red', title: 'Could not save', message: error.message });
    });
  }

  const row = (x: Shown) => (
    <Group key={x.print} justify="space-between" align="flex-start" wrap="wrap" gap="xs">
      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" color={COLOR[x.flag.severity]} variant="light">
            {SEVERITY_LABEL[x.flag.severity]}
          </Badge>
          <Text size="sm" fw={600}>
            {x.stored?.question ?? x.flag.message}
          </Text>
        </Group>
        {x.stored?.question && (
          <Text size="xs" c="dimmed" mt={2}>
            {x.flag.message}
          </Text>
        )}
        {!x.stored && (
          <Text size="xs" c="dimmed" mt={2}>
            Not recorded yet. Press Review now to ask about it.
          </Text>
        )}
      </div>
      <Group gap={4} wrap="nowrap">
        {x.flag.table !== 'budget' && (
          <Button size="compact-sm" variant="light" color={COLOR[x.flag.severity]} onClick={() => requestUnlock(() => onFix(x.flag))}>
            Fix
          </Button>
        )}
        {x.stored && (
          <>
            <Button size="compact-sm" variant="subtle" color="teal" loading={busy === x.stored.id} onClick={() => decide(x, 'confirmed')}>
              It is right
            </Button>
            <Button size="compact-sm" variant="subtle" color="gray" loading={busy === x.stored.id} onClick={() => decide(x, 'dismissed')}>
              Dismiss
            </Button>
          </>
        )}
      </Group>
    </Group>
  );

  const reviewButton = (
    <Button size="compact-sm" variant="light" loading={running} onClick={() => void reviewNow()}>
      Review now
    </Button>
  );

  if (open.length === 0) {
    return (
      <Alert color="teal" variant="light" title="Budget review: nothing to ask">
        <Group justify="space-between" gap="sm">
          <Text size="sm">
            The figures add up and every check passed{decided.length ? `, apart from ${decided.length} you already looked at` : ''}.
          </Text>
          {reviewButton}
        </Group>
        {decided.length > 0 && <Reviewed items={decided} onReopen={(x) => decide(x, 'open')} />}
      </Alert>
    );
  }

  return (
    <Alert color={loud.some((x) => x.flag.severity === 'error') ? 'red' : loud.length ? 'orange' : 'blue'} variant="light" title={`Budget review: ${loud.length} thing${loud.length === 1 ? '' : 's'} to check${quiet.length ? `, ${quiet.length} more for your information` : ''}`}>
      <Stack gap="sm">
        <Group justify="space-between" gap="sm">
          <Text size="sm">Nothing has been changed. Each line asks you before anything is touched.</Text>
          {reviewButton}
        </Group>
        {loud.map(row)}
        {quiet.length > 0 && (
          <Accordion variant="contained" radius="md">
            <Accordion.Item value="info">
              <Accordion.Control>
                <Text size="sm">For your information ({quiet.length})</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">{quiet.map(row)}</Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
        {decided.length > 0 && <Reviewed items={decided} onReopen={(x) => decide(x, 'open')} />}
      </Stack>
    </Alert>
  );
}

function Reviewed({ items, onReopen }: { items: Shown[]; onReopen: (x: Shown) => void }) {
  return (
    <Accordion variant="contained" radius="md" mt="xs">
      <Accordion.Item value="reviewed">
        <Accordion.Control>
          <Text size="sm">Already looked at ({items.length})</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap={6}>
            {items.map((x) => (
              <Group key={x.print} justify="space-between" wrap="nowrap" gap="xs">
                <Text size="xs" style={{ minWidth: 0 }}>
                  <Text span fw={600}>
                    {x.stored?.status === 'confirmed' ? 'Confirmed' : 'Dismissed'}:
                  </Text>{' '}
                  {x.flag.message}
                </Text>
                <Button size="compact-xs" variant="subtle" onClick={() => onReopen(x)}>
                  Reopen
                </Button>
              </Group>
            ))}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
