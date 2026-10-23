import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, Badge, Button, Group, Paper, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase, type PlanningItem, type Topic } from '../lib/supabase';
import { PaymentsLedger } from '../components/PaymentsLedger';
import { PaymentEditor } from '../components/PaymentEditor';
import { ItemEditor } from '../components/ItemEditor';
import { Section } from '../components/Section';
import { BudgetSummary } from '../components/BudgetSummary';
import { MonthPlan } from '../components/MonthPlan';
import { AreaBudget } from '../components/AreaBudget';
import { AreaBudgetEditor, ScheduleEditor, SettingsEditor } from '../components/BudgetEditors';
import { useBudgetPlan } from '../hooks/useBudgetPlan';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { useEditMode } from '../hooks/useEditMode';
import { SideBySide } from '../components/SideBySide';
import { SIDE_LABEL, buildAreas, buildPlan, forSide, scheduleForSide, settingsForSide, sum, type Plan, type Scheduled, type Side } from '../lib/budgetPlan';
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, formatAsOf, formatInr } from '../lib/topicMeta';

type BudgetRow = Pick<PlanningItem, 'id' | 'title' | 'type' | 'status' | 'amount' | 'amount_kind' | 'amount_note' | 'as_of'> & {
  topic: Pick<Topic, 'key' | 'label'>;
};

const isSettled = (s: string) => s === 'decided' || s === 'done';

// Every planner item that carries an amount: the detail behind the figures above, kept for reference.
function AmountsTable() {
  const { isUnlocked } = useEditMode();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);

  // The table only holds the few fields it shows, so load the whole item before editing it.
  async function startEdit(id: string) {
    const { data } = await supabase.from('planning_items').select('*').eq('id', id).single();
    if (data) setEditingItem(data as PlanningItem);
  }

  async function load() {
    const { data } = await supabase
      .from('planning_items')
      .select('id, title, type, status, amount, amount_kind, amount_note, as_of, topic:topics(key, label)')
      .not('amount', 'is', null)
      .order('amount', { ascending: false });
    setRows((data ?? []) as unknown as BudgetRow[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('planning_items_budget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <Table.ScrollContainer minWidth={640}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Topic</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              {isUnlocked && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id} style={{ opacity: isSettled(r.status) || r.amount_kind === 'paid' ? 1 : 0.75 }}>
                <Table.Td>
                  <Text fw={500}>{r.title}</Text>
                  {r.amount_note && (
                    <Text size="xs" c="dimmed" fs="italic">
                      {r.amount_note}
                      {r.as_of ? ` (as of ${formatAsOf(r.as_of)})` : ''}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text component={Link} to={`/topics/${r.topic.key}`} size="sm" c="rose.6">
                    {r.topic.label}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={r.amount_kind === 'paid' ? 'teal' : r.amount_kind === 'planned' ? 'blue' : 'gray'} variant="light">
                    {KIND_LABEL[r.amount_kind ?? 'quote']}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLOR[r.status]} variant="light">
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  {formatInr(r.amount ?? 0)}
                </Table.Td>
                {isUnlocked && (
                  <Table.Td ta="right">
                    <Button size="compact-xs" variant="subtle" onClick={() => startEdit(r.id)}>
                      Edit
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={isUnlocked ? 6 : 5}>
                  <Text c="dimmed">No budgeted items yet. Add an amount to an item to see it here.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {isUnlocked && editingItem && (
        <ItemEditor key={editingItem.id} topicId={editingItem.topic_id} item={editingItem} opened onClose={() => setEditingItem(null)} onSaved={load} />
      )}
    </>
  );
}

export function Budget() {
  const { isUnlocked } = useEditMode();
  const { dates } = usePlanFacts();
  const { schedule, settings, areas, paid, items, topics, reload } = useBudgetPlan();
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [scheduleEditing, setScheduleEditing] = useState<Scheduled | 'new' | null>(null);
  const [markPaid, setMarkPaid] = useState<Scheduled | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);

  const throughMonth = dates.wedding.start.toLocaleDateString('en-CA').slice(0, 7);
  const [side, setSide] = useState<Side>('both');
  // One plan per side, so the table can show all three and the sections below follow the toggle.
  const plans = useMemo(() => {
    const make = (sd: Side): Plan => buildPlan({ pending: scheduleForSide(schedule, sd), paid: forSide(paid, sd), settings: settingsForSide(settings, sd), today, throughMonth });
    return { both: make('both'), pranjal: make('pranjal'), paridhi: make('paridhi') } as Record<Side, Plan>;
  }, [schedule, paid, settings, today, throughMonth]);
  const plan = plans[side];
  const viewSettings = useMemo(() => settingsForSide(settings, side), [settings, side]);
  const areaRows = useMemo(() => buildAreas({ topics, items, paid, pending: schedule, areas, side }), [topics, items, paid, schedule, areas, side]);
  const notScheduled = sum(areaRows.map((r) => r.notScheduled));

  // Marking a payment as paid records it in the ledger first. If less than the scheduled amount was paid, the rest
  // stays on the schedule as still to pay; otherwise the scheduled payment is marked paid and linked to the ledger entry.
  async function afterPaid(p: Scheduled, paymentId?: string, amountPaid?: number) {
    if (!paymentId) return reload();
    const remaining = p.amount - (amountPaid ?? p.amount);
    const { error } =
      remaining > 0.005
        ? await supabase
            .from('payment_schedule')
            .update({ amount: Math.round(remaining * 100) / 100, paridhi_amount: Math.round(p.paridhi_amount * (remaining / p.amount) * 100) / 100 })
            .eq('id', p.id)
        : await supabase.from('payment_schedule').update({ status: 'paid', paid_payment_id: paymentId }).eq('id', p.id);
    if (error) {
      notifications.show({ color: 'red', title: 'Payment saved, schedule not updated', message: error.message });
    } else if (remaining > 0.005) {
      notifications.show({ color: 'teal', message: `Payment recorded. ${formatInr(remaining)} is still to pay.` });
    }
    await reload();
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end" gap="sm">
        <div>
          <Title order={2}>Budget</Title>
          <Text size="sm" c="dimmed">
            What is paid, what is still to pay, and whether each month is covered.
          </Text>
        </div>
        <SegmentedControl
          value={side}
          onChange={(v) => setSide(v as Side)}
          data={(['both', 'pranjal', 'paridhi'] as Side[]).map((s) => ({ value: s, label: SIDE_LABEL[s] }))}
          aria-label="Whose share to show"
        />
      </Group>

      <Section step={1} title="Where the money stands" hint="Paid, still to pay, and the funds you have to cover it.">
        <Stack gap="md">
        <SideBySide plans={plans} side={side} onPick={setSide} />
        <BudgetSummary side={side} plan={plan} settings={viewSettings} notScheduled={notScheduled} today={today} isUnlocked={isUnlocked} onEditSettings={() => setSettingsOpen(true)} />
        </Stack>
      </Section>

      <Section step={2} title="Month by month" hint="What falls due each month and the funds left after paying it. Overdue payments are counted from today.">
        <MonthPlan
          plan={plan}
          side={side}
          schedule={schedule}
          topics={topics}
          today={today}
          isUnlocked={isUnlocked}
          onAdd={() => setScheduleEditing('new')}
          onPaid={(p) => setMarkPaid(schedule.find((x) => x.id === (p.sourceId ?? p.id)) ?? p)}
          onEdit={(p) => setScheduleEditing(schedule.find((x) => x.id === (p.sourceId ?? p.id)) ?? p)}
        />
      </Section>

      <Section step={3} title="By area" hint="Each area's budget against what is paid and still to pay.">
        <AreaBudget rows={areaRows} isUnlocked={isUnlocked} onEditBudgets={() => setAreasOpen(true)} />
      </Section>

      <Section step={4} title="The records" hint="The payments made and every planner item with an amount, for checking the figures above.">
        <Accordion variant="separated" radius="md" multiple>
          <Accordion.Item value="ledger">
            <Accordion.Control>
              <Text fw={600} size="sm">
                Payments made ({paid.length}), {formatInr(plan.paidTotal)}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <PaymentsLedger topics={topics} />
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="items">
            <Accordion.Control>
              <Text fw={600} size="sm">
                Everything with an amount
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Paper p={0} style={{ overflow: 'hidden' }}>
                <AmountsTable />
              </Paper>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Section>

      {isUnlocked && scheduleEditing && (
        <ScheduleEditor
          key={scheduleEditing === 'new' ? 'new' : scheduleEditing.id}
          payment={scheduleEditing === 'new' ? null : scheduleEditing}
          topics={topics}
          opened
          onClose={() => setScheduleEditing(null)}
          onSaved={reload}
        />
      )}
      {isUnlocked && markPaid && (
        <PaymentEditor
          key={markPaid.id}
          payment={null}
          topics={topics}
          defaults={{ payee: markPaid.payee, amount: markPaid.amount, purpose: markPaid.note, topic_id: markPaid.topic_id, paridhi_amount: markPaid.paridhi_amount }}
          opened
          onClose={() => setMarkPaid(null)}
          onSaved={(id, amount) => afterPaid(markPaid, id, amount)}
        />
      )}
      {isUnlocked && settingsOpen && <SettingsEditor settings={settings} opened onClose={() => setSettingsOpen(false)} onSaved={reload} />}
      {isUnlocked && areasOpen && <AreaBudgetEditor topics={topics} areas={areas} opened onClose={() => setAreasOpen(false)} onSaved={reload} />}
    </Stack>
  );
}
