import { useState } from 'react';
import { Anchor, Badge, Button, Checkbox, Group, Modal, NumberInput, Paper, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase, type Suggestion, type SuggestionPayload, type Topic } from '../lib/supabase';
import { TOPIC_EMOJI, formatInr } from '../lib/topicMeta';

const fmtDate = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

async function openSource(documentId: string) {
  const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', documentId).maybeSingle();
  const { data } = doc ? await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 120) : { data: null };
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  else notifications.show({ color: 'red', title: 'Could not open the file', message: 'It may have been removed.' });
}

// A proposed payment or task read from an uploaded document. Accepting files it in the planner.
export function ProposalCard({ s, topic, unlocked, onChanged }: { s: Suggestion; topic?: Topic; unlocked: boolean; onChanged: () => void }) {
  const isPay = s.kind === 'new_payment';
  const p = s.payload as SuggestionPayload;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [d, setD] = useState({
    title: String(p.title ?? ''),
    payee: String(p.payee ?? ''),
    amount: p.amount == null ? ('' as number | '') : Number(p.amount),
    due_date: p.due_date ?? '',
    note: String(p.note ?? ''),
    is_estimate: !!p.is_estimate,
    paridhi_amount: Number(p.paridhi_amount ?? 0),
    priority: String(p.priority ?? 'normal'),
  });
  const title = isPay ? p.payee : p.title;

  async function accept(overrides: SuggestionPayload = {}) {
    setBusy(true);
    const { error } = await supabase.rpc('accept_suggestion', { p_id: s.id, p_overrides: overrides, p_force: false });
    setBusy(false);
    if (error) return notifications.show({ color: 'red', title: 'Could not apply', message: error.message });
    setEditing(false);
    notifications.show({ color: 'teal', title: isPay ? 'Added to the payment schedule' : 'Task added', message: title });
    onChanged();
  }

  async function reject() {
    setBusy(true);
    const { error } = await supabase.rpc('reject_suggestion', { p_id: s.id, p_note: note || null });
    setBusy(false);
    if (error) return notifications.show({ color: 'red', title: 'Could not reject', message: error.message });
    setRejecting(false);
    onChanged();
  }

  const valid = isPay ? d.payee.trim() && d.amount !== '' && d.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.due_date) : d.title.trim();

  return (
    <Paper withBorder p="md" style={{ borderLeft: `4px solid var(--mantine-color-${isPay ? 'orange' : 'rose'}-5)` }}>
      <Stack gap="sm">
        <Group gap={6}>
          <Badge variant="light" color="grape">{isPay ? 'Payment from a document' : 'Task from a document'}</Badge>
          {isPay && <Badge color="orange">Money</Badge>}
          {isPay && p.is_estimate && <Badge variant="outline" color="yellow">Estimate</Badge>}
        </Group>
        <Text fw={700} fz="lg" style={{ overflowWrap: 'anywhere' }}>{title}</Text>
        {isPay ? (
          <Group gap="xl">
            <div><Text size="xs" tt="uppercase" fw={600} c="dimmed">Amount</Text><Text size="sm">{formatInr(Number(p.amount))}</Text></div>
            <div><Text size="xs" tt="uppercase" fw={600} c="dimmed">Due</Text><Text size="sm">{fmtDate(p.due_date)}</Text></div>
          </Group>
        ) : (
          <Group gap="xl">
            <div><Text size="xs" tt="uppercase" fw={600} c="dimmed">Due</Text><Text size="sm">{fmtDate(p.due_date)}</Text></div>
            <div><Text size="xs" tt="uppercase" fw={600} c="dimmed">Priority</Text><Text size="sm">{p.priority ?? 'normal'}</Text></div>
          </Group>
        )}
        {isPay && p.note && <Text size="sm" c="orange.8" style={{ overflowWrap: 'anywhere' }}>{p.note}</Text>}
        {s.rationale && <Text size="sm" c="dimmed" fs="italic" style={{ overflowWrap: 'anywhere' }}>Why: {s.rationale}</Text>}
        {s.document_id && (
          <Anchor component="button" type="button" size="xs" c="rose.6" ta="left" onClick={() => openSource(s.document_id!)}>Open the source file ↗</Anchor>
        )}
        {isPay && <Text size="xs" c="dimmed">Paridhi's share starts at ₹0; use Edit &amp; accept if she pays part of it.</Text>}
        <Group gap="xs">
          <Button disabled={!unlocked} loading={busy} onClick={() => accept()}>Accept</Button>
          <Button variant="light" disabled={!unlocked} onClick={() => setEditing(true)}>Edit &amp; accept</Button>
          <Button variant="subtle" color="gray" disabled={!unlocked} onClick={() => setRejecting(true)}>Reject</Button>
          {!unlocked && <Text size="xs" c="dimmed">Unlock edit mode to approve</Text>}
        </Group>
        {topic && <Text size="xs" c="dimmed">{TOPIC_EMOJI[topic.key]} {topic.label}</Text>}
      </Stack>

      <Modal opened={editing} onClose={() => setEditing(false)} title="Edit before accepting" centered>
        <Stack>
          {isPay ? (
            <>
              <TextInput label="Payee" value={d.payee} onChange={(e) => setD({ ...d, payee: e.currentTarget.value })} />
              <NumberInput label="Amount" prefix="₹" thousandSeparator="," min={1} value={d.amount} onChange={(v) => setD({ ...d, amount: typeof v === 'number' ? v : '' })} />
              <TextInput label="Due date" type="date" value={d.due_date} onChange={(e) => setD({ ...d, due_date: e.currentTarget.value })} />
              <NumberInput label="Paridhi's share" prefix="₹" thousandSeparator="," min={0} value={d.paridhi_amount} onChange={(v) => setD({ ...d, paridhi_amount: typeof v === 'number' ? v : 0 })} />
              <TextInput label="Note" value={d.note} onChange={(e) => setD({ ...d, note: e.currentTarget.value })} />
              <Checkbox label="This is an estimate" checked={d.is_estimate} onChange={(e) => setD({ ...d, is_estimate: e.currentTarget.checked })} />
              <Button loading={busy} disabled={!valid || d.paridhi_amount > Number(d.amount || 0)} onClick={() => accept({ payee: d.payee, amount: Number(d.amount), due_date: d.due_date, paridhi_amount: d.paridhi_amount, note: d.note || null, is_estimate: d.is_estimate })}>
                Save and accept
              </Button>
            </>
          ) : (
            <>
              <TextInput label="Task" value={d.title} onChange={(e) => setD({ ...d, title: e.currentTarget.value })} />
              <TextInput label="Due date (optional)" type="date" value={d.due_date} onChange={(e) => setD({ ...d, due_date: e.currentTarget.value })} />
              <Select label="Priority" data={['high', 'normal', 'low']} value={d.priority} onChange={(v) => v && setD({ ...d, priority: v })} allowDeselect={false} />
              <Button loading={busy} disabled={!valid} onClick={() => accept({ title: d.title, due_date: d.due_date || null, priority: d.priority as SuggestionPayload['priority'] })}>
                Save and accept
              </Button>
            </>
          )}
        </Stack>
      </Modal>

      <Modal opened={rejecting} onClose={() => setRejecting(false)} title="Reject this suggestion" centered>
        <Stack>
          <TextInput label="Reason (optional)" placeholder="e.g. already handled, or not relevant" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Button color="red" loading={busy} onClick={reject}>Reject</Button>
        </Stack>
      </Modal>
    </Paper>
  );
}
