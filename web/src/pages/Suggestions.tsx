import { useEffect, useState } from 'react';
import { Accordion, Alert, Anchor, Badge, Button, Group, Modal, NumberInput, Paper, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEditMode } from '../hooks/useEditMode';
import { supabase, type ChatMessage, type PlanningItem, type Suggestion, type SuggestionPayload, type Topic } from '../lib/supabase';
import { KIND_LABEL, STATUS_LABEL, TOPIC_EMOJI, formatInr } from '../lib/topicMeta';

const FIELD_LABEL: Record<string, string> = {
  type: 'Type',
  title: 'Title',
  detail: 'Detail',
  status: 'Status',
  amount: 'Amount',
  amount_kind: 'Kind of amount',
  amount_note: 'Where the number comes from',
};
const FIELD_ORDER = ['title', 'type', 'status', 'amount', 'amount_kind', 'amount_note', 'detail'];

function show(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'amount') return formatInr(Number(value));
  if (field === 'status') return STATUS_LABEL[String(value)] ?? String(value);
  if (field === 'amount_kind') return KIND_LABEL[String(value)] ?? String(value);
  return String(value).replace('_', ' ');
}

const CONFIDENCE_COLOR = { high: 'teal', medium: 'yellow', low: 'orange' } as const;

type CardProps = {
  s: Suggestion;
  topic?: Topic;
  item?: PlanningItem;
  sources: Record<string, ChatMessage>;
  unlocked: boolean;
  onChanged: () => void;
};

function SuggestionCard({ s, topic, item, sources, unlocked, onChanged }: CardProps) {
  const [showSources, setShowSources] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const isUpdate = s.kind === 'update_item';
  const payload = s.payload as Record<string, unknown>;
  const before = (item ?? {}) as unknown as Record<string, unknown>;
  const fields = FIELD_ORDER.filter((f) => f in payload && (!isUpdate || payload[f] !== before[f]));
  const title = (payload.title as string) ?? item?.title ?? 'Item';

  // values the editor starts from: what the suggestion would result in
  const merged = { ...before, ...payload } as Record<string, unknown>;
  const [draft, setDraft] = useState({
    title: String(merged.title ?? ''),
    detail: String(merged.detail ?? ''),
    status: String(merged.status ?? 'open'),
    type: String(merged.type ?? 'note'),
    amount: merged.amount == null ? ('' as number | '') : Number(merged.amount),
    amount_kind: String(merged.amount_kind ?? 'quote'),
    amount_note: String(merged.amount_note ?? ''),
  });

  async function accept(overrides: SuggestionPayload = {}, force = false) {
    setBusy(true);
    const { error } = await supabase.rpc('accept_suggestion', { p_id: s.id, p_overrides: overrides, p_force: force });
    setBusy(false);
    if (error) {
      if (error.message.includes('stale')) setStale(true);
      else notifications.show({ color: 'red', title: 'Could not apply', message: error.message });
      return;
    }
    setStale(false);
    setEditing(false);
    notifications.show({ color: 'teal', title: 'Applied', message: title });
    onChanged();
  }

  async function reject() {
    setBusy(true);
    const { error } = await supabase.rpc('reject_suggestion', { p_id: s.id, p_note: note || null });
    setBusy(false);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not reject', message: error.message });
      return;
    }
    setRejecting(false);
    onChanged();
  }

  const srcRows = s.source_msg_ids
    .map((id) => sources[id])
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <Paper withBorder p="md" style={{ borderLeft: `4px solid var(--mantine-color-${s.involves_money ? 'orange' : 'rose'}-5)` }}>
      <Stack gap="sm">
        <Group gap={6}>
          <Badge variant="light" color={isUpdate ? 'blue' : 'teal'}>
            {isUpdate ? 'Change to an item' : 'New item'}
          </Badge>
          {s.involves_money && <Badge color="orange">Money</Badge>}
          <Badge variant="outline" color={CONFIDENCE_COLOR[s.confidence]}>
            {s.confidence} confidence
          </Badge>
        </Group>

        <Text fw={700} fz="lg">
          {title}
        </Text>

        <Stack gap={8}>
          {fields.map((f) => (
            <div key={f}>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: 0.4 }}>
                {FIELD_LABEL[f]}
              </Text>
              {isUpdate && f in before && before[f] !== payload[f] && (
                <Text size="sm" c="dimmed" td="line-through" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                  {show(f, before[f])}
                </Text>
              )}
              <Text size="sm" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                {show(f, payload[f])}
              </Text>
            </div>
          ))}
        </Stack>

        {s.rationale && (
          <Text size="sm" c="dimmed" fs="italic">
            Why: {s.rationale}
          </Text>
        )}

        {srcRows.length > 0 && (
          <Stack gap={6}>
            <Anchor component="button" type="button" size="xs" c="rose.6" ta="left" onClick={() => setShowSources((v) => !v)}>
              {showSources ? 'Hide' : 'Show'} sources ({srcRows.length})
            </Anchor>
            {showSources &&
              srcRows.map((m) => (
                <Paper key={m.id} p="xs" bg="var(--mantine-color-default-hover)">
                  <Text size="xs" c="dimmed">
                    {m.from_me ? 'Pranjal' : (m.sender_name ?? 'Someone')} ·{' '}
                    {new Date(m.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · {m.chat_name}
                  </Text>
                  <Text size="sm" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                    {m.text || `[${m.media_type || 'media'}]`}
                  </Text>
                </Paper>
              ))}
          </Stack>
        )}

        {stale && (
          <Alert color="yellow" title="This item changed after the suggestion was made">
            <Group justify="space-between">
              <Text size="sm">Applying will overwrite those newer changes with the suggestion.</Text>
              <Button size="xs" color="yellow" loading={busy} onClick={() => accept({}, true)}>
                Apply anyway
              </Button>
            </Group>
          </Alert>
        )}

        <Group gap="xs">
          <Button disabled={!unlocked} loading={busy} onClick={() => accept()}>
            Accept
          </Button>
          <Button variant="light" disabled={!unlocked} onClick={() => setEditing(true)}>
            Edit &amp; accept
          </Button>
          <Button variant="subtle" color="gray" disabled={!unlocked} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          {!unlocked && (
            <Text size="xs" c="dimmed">
              Unlock edit mode to approve
            </Text>
          )}
        </Group>
        {topic && <Text size="xs" c="dimmed">{TOPIC_EMOJI[topic.key]} {topic.label}</Text>}
      </Stack>

      <Modal opened={editing} onClose={() => setEditing(false)} title="Edit before accepting" centered>
        <Stack>
          <TextInput label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })} />
          <Textarea label="Detail" minRows={4} autosize value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.currentTarget.value })} />
          <Group grow>
            <Select label="Status" data={['open', 'in_progress', 'decided', 'done']} value={draft.status} onChange={(v) => v && setDraft({ ...draft, status: v })} allowDeselect={false} />
            <Select label="Type" data={['decision', 'todo', 'vendor', 'budget_line', 'note']} value={draft.type} onChange={(v) => v && setDraft({ ...draft, type: v })} allowDeselect={false} />
          </Group>
          <NumberInput label="Amount (optional)" prefix="₹" thousandSeparator="," value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: typeof v === 'number' ? v : '' })} />
          {draft.amount !== '' && (
            <>
              <Select
                label="Kind of amount"
                data={[
                  { value: 'quote', label: 'Quote (an option being compared)' },
                  { value: 'planned', label: 'Planned budget' },
                  { value: 'paid', label: 'Paid already' },
                ]}
                value={draft.amount_kind}
                onChange={(v) => v && setDraft({ ...draft, amount_kind: v })}
                allowDeselect={false}
              />
              <TextInput label="Where does this number come from?" value={draft.amount_note} onChange={(e) => setDraft({ ...draft, amount_note: e.currentTarget.value })} />
            </>
          )}
          <Button
            loading={busy}
            disabled={!draft.title}
            onClick={() =>
              accept({
                title: draft.title,
                detail: draft.detail || null,
                status: draft.status as PlanningItem['status'],
                type: draft.type as PlanningItem['type'],
                amount: draft.amount === '' ? null : draft.amount,
                amount_kind: draft.amount === '' ? null : (draft.amount_kind as PlanningItem['amount_kind']),
                amount_note: draft.amount === '' ? null : draft.amount_note || null,
              })
            }
          >
            Save and accept
          </Button>
        </Stack>
      </Modal>

      <Modal opened={rejecting} onClose={() => setRejecting(false)} title="Reject this suggestion" centered>
        <Stack>
          <TextInput label="Reason (optional)" placeholder="e.g. already handled, or not relevant" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Button color="red" loading={busy} onClick={reject}>
            Reject
          </Button>
        </Stack>
      </Modal>
    </Paper>
  );
}

export function Suggestions() {
  const { isUnlocked } = useEditMode();
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [decided, setDecided] = useState<Suggestion[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [items, setItems] = useState<Record<string, PlanningItem>>({});
  const [sources, setSources] = useState<Record<string, ChatMessage>>({});
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [{ data: p }, { data: d }, { data: t }] = await Promise.all([
      supabase.from('suggestions').select('*').eq('status', 'pending').order('created_at'),
      supabase.from('suggestions').select('*').neq('status', 'pending').order('decided_at', { ascending: false }).limit(15),
      supabase.from('topics').select('*').order('sort_order'),
    ]);
    const pend = (p ?? []) as Suggestion[];
    setPending(pend);
    setDecided((d ?? []) as Suggestion[]);
    setTopics((t ?? []) as Topic[]);

    const targets = [...new Set(pend.map((s) => s.target_item_id).filter(Boolean))] as string[];
    if (targets.length) {
      const { data } = await supabase.from('planning_items').select('*').in('id', targets);
      setItems(Object.fromEntries((data ?? []).map((i) => [i.id, i as PlanningItem])));
    } else setItems({});

    const ids = [...new Set(pend.flatMap((s) => s.source_msg_ids))];
    if (ids.length) {
      const { data } = await supabase.from('messages').select('*').in('msg_id', ids);
      setSources(Object.fromEntries((data ?? []).map((m) => [m.msg_id, m as ChatMessage])));
    } else setSources({});
    setLoaded(true);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('suggestions_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestions' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const byTopic = topics.map((t) => ({ topic: t, list: pending.filter((s) => s.topic_id === t.id) })).filter((g) => g.list.length);
  const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Suggestions</Title>
        <Text c="dimmed" size="sm">
          Claude reads new chat messages and bill photos and proposes planner changes here. Nothing changes until one of you accepts it.
        </Text>
      </div>

      {loaded && pending.length === 0 && (
        <Paper withBorder p="xl" ta="center">
          <Text fw={600}>All caught up</Text>
          <Text c="dimmed" size="sm">
            No suggestions waiting. Ask Claude to "update the planner" after new chat activity.
          </Text>
        </Paper>
      )}

      {byTopic.map(({ topic, list }) => (
        <Stack key={topic.id} gap="sm">
          <Title order={4}>
            {TOPIC_EMOJI[topic.key]} {topic.label}
          </Title>
          {list.map((s) => (
            <SuggestionCard key={s.id} s={s} topic={topicById[s.topic_id]} item={s.target_item_id ? items[s.target_item_id] : undefined} sources={sources} unlocked={isUnlocked} onChanged={load} />
          ))}
        </Stack>
      ))}

      {decided.length > 0 && (
        <Accordion variant="contained">
          <Accordion.Item value="decided">
            <Accordion.Control>Recently decided ({decided.length})</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {decided.map((s) => (
                  <Group key={s.id} gap="xs" wrap="nowrap" align="flex-start">
                    <Badge color={s.status === 'accepted' ? 'teal' : 'gray'} variant="light">
                      {s.status}
                    </Badge>
                    <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {(s.payload as SuggestionPayload).title ?? 'Change to an item'}
                      {s.decision_note ? ` · ${s.decision_note}` : ''}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Stack>
  );
}
