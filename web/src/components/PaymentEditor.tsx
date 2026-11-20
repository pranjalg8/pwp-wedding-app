import { useState } from 'react';
import { Button, Collapse, NumberInput, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import { useDirty } from '../hooks/useDirty';
import { formatInr } from '../lib/topicMeta';
import { FormModal } from './FormModal';

const METHODS = ['UPI', 'Bank transfer', 'Card', 'Cash', 'Other'];

// Older payments have free-text methods ("upi", "gpay"). Match the usual ones to the list; keep anything else as written.
function methodValue(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  return METHODS.find((m) => m.toLowerCase() === t.toLowerCase()) ?? t;
}

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
  paridhi_amount?: number | string | null;
  vendor_id?: string | null;
};

// Add or edit one payment. Changes are recorded in the audit log by a database trigger.
export function PaymentEditor({
  payment,
  topics,
  vendors,
  defaults,
  opened,
  onClose,
  onSaved,
}: {
  payment: Payment | null;
  topics?: { id: string; label: string }[];
  vendors?: { id: string; name: string }[];
  // Starting values for a new payment, for example when marking a scheduled payment as paid.
  defaults?: { payee?: string; amount?: number; purpose?: string | null; topic_id?: string | null; paridhi_amount?: number; vendor_id?: string | null };
  opened: boolean;
  onClose: () => void;
  onSaved: (id?: string, amount?: number) => void;
}) {
  const { profile } = useProfile();
  const today = () => new Date().toLocaleDateString('en-CA');
  const [paidOn, setPaidOn] = useState(() => payment?.paid_on ?? today());
  const [payee, setPayee] = useState(payment?.payee ?? defaults?.payee ?? '');
  const [amount, setAmount] = useState<number | string>(payment ? Number(payment.amount) : (defaults?.amount ?? ''));
  const [method, setMethod] = useState<string | null>(methodValue(payment?.method));
  const [reference, setReference] = useState(payment?.reference ?? '');
  const [purpose, setPurpose] = useState(payment?.purpose ?? defaults?.purpose ?? '');
  const [paridhiAmount, setParidhiAmount] = useState<number | string>(Number(payment?.paridhi_amount ?? defaults?.paridhi_amount ?? 0) || 0);
  const [topicId, setTopicId] = useState<string | null>(payment?.topic_id ?? defaults?.topic_id ?? null);
  const [vendorId, setVendorId] = useState<string | null>(payment?.vendor_id ?? defaults?.vendor_id ?? null);
  const [verification, setVerification] = useState<string>(payment?.verification ?? 'chat_only');
  const [note, setNote] = useState(payment?.verification_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(
    () => !!payment && (!!payment.reference || !!payment.verification_note || payment.verification !== 'chat_only'),
  );
  const dirty = useDirty([paidOn, payee, amount, method, reference, purpose, paridhiAmount, topicId, vendorId, verification, note]);
  const methodOptions = method && !METHODS.includes(method) ? [...METHODS, method] : METHODS;

  const amountNum = typeof amount === 'number' ? amount : Number(amount);
  const paridhiNum = Number(paridhiAmount) || 0;
  const valid = (paidOn !== '' || !payment) && payee.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0 && paridhiNum >= 0 && paridhiNum <= amountNum;

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const fields = {
      // A new payment with the date cleared is taken as paid today.
      paid_on: paidOn || today(),
      payee: payee.trim(),
      amount: amountNum,
      method: method?.trim() || null,
      reference: reference.trim() || null,
      purpose: purpose.trim() || null,
      verification,
      verification_note: note.trim() || null,
      topic_id: topicId,
      paridhi_amount: paridhiNum,
      vendor_id: vendorId,
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
      return false;
    }
    onSaved(savedId, amountNum);
    onClose();
    return true;
  }

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={payment ? 'Edit payment' : 'Add payment'}
      onSubmit={save}
      canSubmit={valid}
      submitting={saving}
      dirty={dirty}
      error={error}
      successMessage={() => `Payment of ${formatInr(amountNum)} to ${payee.trim()} saved`}
    >
      <NumberInput
        label="Amount"
        prefix="₹"
        thousandSeparator="," thousandsGroupStyle="lakh"
        decimalScale={2}
        min={0}
        inputMode="decimal"
        value={amount}
        onChange={setAmount}
        required
        data-autofocus
      />
      <TextInput label="Paid to" value={payee} onChange={(e) => setPayee(e.currentTarget.value)} required />
      <TextInput
        label="Date paid"
        type="date"
        description={!payment && paidOn === '' ? 'Left blank, it is saved as today.' : undefined}
        value={paidOn}
        onChange={(e) => setPaidOn(e.currentTarget.value)}
        required={!!payment}
      />
      <Select label="Method" placeholder="Not set" clearable data={methodOptions} value={method} onChange={setMethod} />
      <NumberInput
        label="Of which Paridhi pays"
        description={`Her share of the amount. Pranjal pays ${amountNum > 0 ? `₹${Math.max(0, amountNum - paridhiNum).toLocaleString('en-IN')}` : 'the rest'}.`}
        prefix="₹"
        thousandSeparator="," thousandsGroupStyle="lakh"
        decimalScale={2}
        min={0}
        inputMode="decimal"
        value={paridhiAmount}
        onChange={setParidhiAmount}
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
      {vendors && (
        <Select
          label="Vendor"
          placeholder="Not set"
          clearable
          searchable
          data={vendors.map((v) => ({ value: v.id, label: v.name }))}
          value={vendorId}
          onChange={setVendorId}
        />
      )}
      <TextInput label="What for" value={purpose} onChange={(e) => setPurpose(e.currentTarget.value)} />
      <Button variant="subtle" size="sm" px={0} style={{ alignSelf: 'flex-start' }} onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
        {moreOpen ? 'Hide details' : 'More details (reference, proof)'}
      </Button>
      <Collapse expanded={moreOpen}>
        <Stack>
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
        </Stack>
      </Collapse>
    </FormModal>
  );
}
