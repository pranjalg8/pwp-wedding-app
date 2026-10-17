import { useState } from 'react';
import { Button, Modal, NumberInput, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';

export type Payment = {
  id: string;
  paid_on: string;
  payee: string;
  amount: number;
  method: string | null;
  reference: string | null;
  purpose: string | null;
  verification: 'receipt_checked' | 'chat_only';
  verification_note: string | null;
  topic_id?: string | null;
};

// Add or edit one payment. Changes are recorded in the audit log by a database trigger.
export function PaymentEditor({
  payment,
  topics,
  defaults,
  opened,
  onClose,
  onSaved,
}: {
  payment: Payment | null;
  topics?: { id: string; label: string }[];
  // Starting values for a new payment, for example when marking a scheduled payment as paid.
  defaults?: { payee?: string; amount?: number; purpose?: string | null; topic_id?: string | null };
  opened: boolean;
  onClose: () => void;
  onSaved: (id?: string, amount?: number) => void;
}) {
  const { profile } = useProfile();
  const [paidOn, setPaidOn] = useState(() => payment?.paid_on ?? new Date().toLocaleDateString('en-CA'));
  const [payee, setPayee] = useState(payment?.payee ?? defaults?.payee ?? '');
  const [amount, setAmount] = useState<number | string>(payment ? Number(payment.amount) : (defaults?.amount ?? ''));
  const [method, setMethod] = useState(payment?.method ?? '');
  const [reference, setReference] = useState(payment?.reference ?? '');
  const [purpose, setPurpose] = useState(payment?.purpose ?? defaults?.purpose ?? '');
  const [topicId, setTopicId] = useState<string | null>(payment?.topic_id ?? defaults?.topic_id ?? null);
  const [verification, setVerification] = useState<string>(payment?.verification ?? 'chat_only');
  const [note, setNote] = useState(payment?.verification_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = typeof amount === 'number' ? amount : Number(amount);
  const valid = paidOn !== '' && payee.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0;

  async function save() {
    setSaving(true);
    setError(null);
    const fields = {
      paid_on: paidOn,
      payee: payee.trim(),
      amount: amountNum,
      method: method.trim() || null,
      reference: reference.trim() || null,
      purpose: purpose.trim() || null,
      verification,
      verification_note: note.trim() || null,
      topic_id: topicId,
    };
    let savedId: string | undefined = payment?.id;
    let failure: string | null = null;
    if (payment) {
      const res = await supabase.from('payments').update(fields).eq('id', payment.id);
      failure = res.error?.message ?? null;
    } else {
      const res = await supabase.from('payments').insert({ ...fields, created_by: profile?.id ?? null }).select('id').single();
      failure = res.error?.message ?? null;
      savedId = (res.data as { id: string } | null)?.id;
    }
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onSaved(savedId, amountNum);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={payment ? 'Edit payment' : 'Add payment'} centered>
      <Stack>
        <TextInput label="Date paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.currentTarget.value)} required />
        <TextInput label="Paid to" value={payee} onChange={(e) => setPayee(e.currentTarget.value)} required />
        <NumberInput
          label="Amount"
          prefix="₹"
          thousandSeparator="," thousandsGroupStyle="lakh"
          decimalScale={2}
          min={0}
          value={amount}
          onChange={setAmount}
          required
        />
        {topics && (
          <Select
            label="Area"
            placeholder="Not set"
            clearable
            searchable
            data={topics.map((t) => ({ value: t.id, label: t.label }))}
            value={topicId}
            onChange={setTopicId}
          />
        )}
        <TextInput label="What for" value={purpose} onChange={(e) => setPurpose(e.currentTarget.value)} />
        <TextInput label="Method" placeholder="e.g. card, UPI" value={method} onChange={(e) => setMethod(e.currentTarget.value)} />
        <TextInput label="Reference or receipt number" value={reference} onChange={(e) => setReference(e.currentTarget.value)} />
        <Select
          label="Proof"
          allowDeselect={false}
          data={[
            { value: 'receipt_checked', label: 'Receipt checked' },
            { value: 'chat_only', label: 'Not verified (chat only)' },
          ]}
          value={verification}
          onChange={(v) => v && setVerification(v)}
        />
        <Textarea label="Proof note" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize minRows={2} />
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
