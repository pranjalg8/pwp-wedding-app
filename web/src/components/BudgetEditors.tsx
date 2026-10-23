import { useState } from 'react';
import { Button, Checkbox, Group, Modal, NumberInput, ScrollArea, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import type { AreaBudget, BudgetSettings, Scheduled, TopicRef } from '../lib/budgetPlan';

const todayIso = () => new Date().toLocaleDateString('en-CA');
const n = (v: number | string) => (v === '' ? null : Number(v));

// Add or edit a payment that is still to be made. Changes are recorded in the audit log by a database trigger.
export function ScheduleEditor({
  payment,
  topics,
  opened,
  onClose,
  onSaved,
}: {
  payment: Scheduled | null;
  topics: TopicRef[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useProfile();
  const [payee, setPayee] = useState(payment?.payee ?? '');
  const [amount, setAmount] = useState<number | string>(payment?.amount ?? '');
  const [due, setDue] = useState(payment?.due_date ?? '');
  const [topicId, setTopicId] = useState<string | null>(payment?.topic_id ?? null);
  const [note, setNote] = useState(payment?.note ?? '');
  const [estimate, setEstimate] = useState(payment?.is_estimate ?? false);
  const [paridhi, setParidhi] = useState<number | string>(payment?.paridhi_amount ?? 0);
  const [paridhiDue, setParidhiDue] = useState(payment?.paridhi_due_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const paridhiNum = Number(paridhi) || 0;
  const valid = payee.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0 && /^\d{4}-\d{2}-\d{2}$/.test(due) && paridhiNum >= 0 && paridhiNum <= amountNum && (paridhiDue === '' || /^\d{4}-\d{2}-\d{2}$/.test(paridhiDue));

  async function save() {
    setSaving(true);
    setError(null);
    const fields = { payee: payee.trim(), amount: amountNum, due_date: due, topic_id: topicId, note: note.trim() || null, is_estimate: estimate, paridhi_amount: paridhiNum, paridhi_due_date: paridhiNum > 0 && paridhiDue !== '' ? paridhiDue : null };
    const res = payment
      ? await supabase.from('payment_schedule').update(fields).eq('id', payment.id)
      : await supabase.from('payment_schedule').insert({ ...fields, created_by: profile?.id ?? null });
    setSaving(false);
    if (res.error) return setError(res.error.message);
    onSaved();
    onClose();
  }

  async function remove() {
    if (!payment || !window.confirm(`Remove the payment to ${payment.payee}? It was never paid, so nothing in the ledger changes. This is recorded in the activity log.`)) return;
    setSaving(true);
    const { error: err } = await supabase.from('payment_schedule').delete().eq('id', payment.id);
    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={payment ? 'Edit payment due' : 'Add a payment due'} centered>
      <Stack>
        <TextInput label="Pay to" placeholder="e.g. Photographer, second instalment" value={payee} onChange={(e) => setPayee(e.currentTarget.value)} required />
        <Group grow align="flex-start">
          <NumberInput label="Amount" prefix="₹" thousandSeparator="," thousandsGroupStyle="lakh" decimalScale={2} min={0} value={amount} onChange={setAmount} required />
          <TextInput label="Due on" type="date" value={due} onChange={(e) => setDue(e.currentTarget.value)} required />
        </Group>
        <NumberInput
          label="Of which Paridhi pays"
          description={`Her share of the amount above. Pranjal pays ${amountNum > 0 ? `₹${Math.max(0, amountNum - paridhiNum).toLocaleString('en-IN')}` : 'the rest'}. Leave 0 if Pranjal pays it all.`}
          prefix="₹"
          thousandSeparator="," thousandsGroupStyle="lakh"
          decimalScale={2}
          min={0}
          value={paridhi}
          onChange={setParidhi}
        />
        {paridhiNum > 0 && (
          <TextInput
            label="Paridhi pays her share on"
            description="Leave empty to pay on the due date. If it is later, Pranjal covers the whole payment on the due date and she pays back on this date."
            type="date"
            value={paridhiDue}
            onChange={(e) => setParidhiDue(e.currentTarget.value)}
          />
        )}
        <Select
          label="Area"
          placeholder="Not set"
          clearable
          searchable
          data={topics.map((t) => ({ value: t.id, label: t.label }))}
          value={topicId}
          onChange={setTopicId}
        />
        <Checkbox
          label="This amount is an estimate"
          description="Tick it until you know the real figure. Estimates are shown with a marker and totalled separately."
          checked={estimate}
          onChange={(e) => setEstimate(e.currentTarget.checked)}
        />
        <Textarea label="Note" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize minRows={2} />
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Group justify="space-between">
          {payment ? (
            <Button variant="subtle" color="red" onClick={remove} disabled={saving}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} loading={saving} disabled={!valid}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// The overall budget and the money available. Payments made after the "as of" date are taken off the funds
// automatically, so the figure stays right as payments are recorded.
export function SettingsEditor({ settings, opened, onClose, onSaved }: { settings: BudgetSettings | null; opened: boolean; onClose: () => void; onSaved: () => void }) {
  const [total, setTotal] = useState<number | string>(settings?.total_budget ?? '');
  const [funds, setFunds] = useState<number | string>(settings?.funds_available ?? '');
  const [asOf, setAsOf] = useState(settings?.funds_as_of ?? todayIso());
  const [monthly, setMonthly] = useState<number | string>(settings?.monthly_addition ?? 0);
  const [pFunds, setPFunds] = useState<number | string>(settings?.paridhi_funds_available ?? '');
  const [pMonthly, setPMonthly] = useState<number | string>(settings?.paridhi_monthly_addition ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = (funds === '' && pFunds === '' || /^\d{4}-\d{2}-\d{2}$/.test(asOf)) && Number(monthly) >= 0 && Number(pMonthly) >= 0;

  async function save() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('budget_settings')
      .update({
        total_budget: n(total),
        funds_available: n(funds),
        funds_as_of: funds === '' && pFunds === '' ? null : asOf,
        monthly_addition: Number(monthly) || 0,
        paridhi_funds_available: n(pFunds),
        paridhi_monthly_addition: Number(pMonthly) || 0,
      })
      .eq('id', 1);
    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Budget and funds" centered>
      <Stack>
        <NumberInput
          label="Total wedding budget"
          description="Optional. The most you plan to spend in all."
          prefix="₹"
          thousandSeparator="," thousandsGroupStyle="lakh"
          min={0}
          value={total}
          onChange={setTotal}
        />
        <NumberInput
          label="Pranjal's funds available"
          description="The money Pranjal has ready for the wedding, as it stands on the date below."
          prefix="₹"
          thousandSeparator="," thousandsGroupStyle="lakh"
          min={0}
          value={funds}
          onChange={setFunds}
        />
        <Group grow align="flex-start">
          <TextInput label="Funds as of" type="date" value={asOf} onChange={(e) => setAsOf(e.currentTarget.value)} disabled={funds === '' && pFunds === ''} />
          <NumberInput
            label="Pranjal adds each month"
            description="Optional"
            prefix="₹"
            thousandSeparator="," thousandsGroupStyle="lakh"
            min={0}
            value={monthly}
            onChange={setMonthly}
            disabled={funds === ''}
          />
        </Group>
        <NumberInput
          label="Paridhi's funds available"
          description="The money Paridhi has ready for the wedding, as of the same date. Optional."
          prefix="₹"
          thousandSeparator="," thousandsGroupStyle="lakh"
          min={0}
          value={pFunds}
          onChange={setPFunds}
        />
        <NumberInput
          label="Paridhi adds each month"
          description="Optional"
          prefix="₹"
          thousandSeparator="," thousandsGroupStyle="lakh"
          min={0}
          value={pMonthly}
          onChange={setPMonthly}
          disabled={pFunds === ''}
        />
        <Text size="xs" c="dimmed">
          Payments you record after the "as of" date come off the funds automatically. The monthly amount is added at the start of each month after that
          date, so the month-by-month view shows a running balance.
        </Text>
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving} disabled={!valid}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}

// A budget per area. Leave an area blank for no budget.
export function AreaBudgetEditor({
  topics,
  areas,
  opened,
  onClose,
  onSaved,
}: {
  topics: TopicRef[];
  areas: AreaBudget[];
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, number | string>>(() =>
    Object.fromEntries(topics.map((t) => [t.id, areas.find((a) => a.topic_id === t.id)?.allocation ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const keep = topics.filter((t) => Number(values[t.id]) > 0).map((t) => ({ topic_id: t.id, allocation: Number(values[t.id]) }));
    const drop = topics.filter((t) => !(Number(values[t.id]) > 0) && areas.some((a) => a.topic_id === t.id)).map((t) => t.id);
    if (keep.length > 0) {
      const { error: err } = await supabase.from('budget_areas').upsert(keep, { onConflict: 'topic_id' });
      if (err) {
        setSaving(false);
        return setError(err.message);
      }
    }
    if (drop.length > 0) {
      const { error: err } = await supabase.from('budget_areas').delete().in('topic_id', drop);
      if (err) {
        setSaving(false);
        return setError(err.message);
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const total = topics.reduce((a, t) => a + (Number(values[t.id]) || 0), 0);

  return (
    <Modal opened={opened} onClose={onClose} title="Budget for each area" centered>
      <Stack>
        <ScrollArea.Autosize mah={420} offsetScrollbars>
          <Stack gap="xs">
            {topics.map((t) => (
              <Group key={t.id} justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm">{t.label}</Text>
                <NumberInput
                  aria-label={`Budget for ${t.label}`}
                  placeholder="None"
                  prefix="₹"
                  thousandSeparator="," thousandsGroupStyle="lakh"
                  min={0}
                  w={150}
                  value={values[t.id]}
                  onChange={(v) => setValues((o) => ({ ...o, [t.id]: v }))}
                />
              </Group>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        <Text size="sm">
          Added up: <b>₹{total.toLocaleString('en-IN')}</b>
        </Text>
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
