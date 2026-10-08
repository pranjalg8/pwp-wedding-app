import { useState } from 'react';
import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { supabase, type PlanningItem } from '../lib/supabase';
import { notifications } from '@mantine/notifications';
import { useProfile } from '../hooks/useProfile';
import { OPTIONS } from '../data/travelOptions';

const TYPE_OPTIONS = ['decision', 'todo', 'vendor', 'budget_line', 'note'];
const STATUS_OPTIONS = ['open', 'in_progress', 'decided', 'done'];

export function ItemEditor({
  topicId,
  item,
  opened,
  onClose,
  onSaved,
}: {
  topicId: string;
  item?: PlanningItem | null;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useProfile();
  const [title, setTitle] = useState(item?.title ?? '');
  const [detail, setDetail] = useState(item?.detail ?? '');
  const [type, setType] = useState<string>(item?.type ?? 'note');
  const [status, setStatus] = useState<string>(item?.status ?? 'open');
  const [amount, setAmount] = useState<number | ''>(item?.amount ?? '');
  const [amountKind, setAmountKind] = useState<string>(item?.amount_kind ?? 'quote');
  const [amountNote, setAmountNote] = useState(item?.amount_note ?? '');
  const [contactPerson, setContactPerson] = useState(
    typeof item?.metadata?.contact_person === 'string' ? item.metadata.contact_person : ''
  );
  const [phone, setPhone] = useState(typeof item?.metadata?.phone === 'string' ? item.metadata.phone : '');
  const [email, setEmail] = useState(typeof item?.metadata?.email === 'string' ? item.metadata.email : '');
  const [saving, setSaving] = useState(false);
  // Named planner items are the shared source of truth for the whole app (see lib/planFacts.ts).
  const slug = item?.slug ?? null;
  const isDateFact = !!slug?.startsWith('dates.');
  const isRouteFact = slug === 'honeymoon.route';
  const metaString = (k: string) => (typeof item?.metadata?.[k] === 'string' ? (item.metadata[k] as string) : '');
  const [startDate, setStartDate] = useState(metaString('start'));
  const [endDate, setEndDate] = useState(metaString('end'));
  const [routeValue, setRouteValue] = useState(metaString('value'));
  const datesInvalid = isDateFact && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (endDate !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate)));

  async function handleSave() {
    setSaving(true);
    const payload = {
      topic_id: topicId,
      title,
      detail: detail || null,
      type,
      status,
      amount: amount === '' ? null : amount,
      amount_kind: amount === '' ? null : amountKind,
      amount_note: amount === '' ? null : amountNote || null,
      metadata:
        type === 'vendor'
          ? { ...item?.metadata, contact_person: contactPerson || null, phone: phone || null, email: email || null }
          : isDateFact
            ? { ...item?.metadata, start: startDate, end: endDate || startDate }
            : isRouteFact
              ? { ...item?.metadata, value: routeValue }
              : { ...item?.metadata },
      created_by: profile?.id ?? null,
    };

    // The database audit trigger records who/what/device for this write.
    const { error } = item
      ? await supabase.from('planning_items').update(payload).eq('id', item.id)
      : await supabase.from('planning_items').insert(payload);

    setSaving(false);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not save', message: error.message });
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={item ? 'Edit item' : 'New item'} centered>
      <Stack>
        {slug && (
          <Group gap="xs">
            <Badge variant="light" color="rose">Shared setting</Badge>
            <Text size="xs" c="dimmed">Every page, and the WhatsApp extraction, reads this one value.</Text>
          </Group>
        )}
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
        <Textarea label="Detail" value={detail ?? ''} onChange={(e) => setDetail(e.currentTarget.value)} minRows={3} />
        <Group grow>
          <Select label="Type" data={TYPE_OPTIONS} value={type} onChange={(v) => v && setType(v)} />
          <Select label="Status" data={STATUS_OPTIONS} value={status} onChange={(v) => v && setStatus(v)} />
        </Group>
        <NumberInput
          label="Amount (optional)"
          value={amount}
          onChange={(v) => setAmount(typeof v === 'number' ? v : '')}
          thousandSeparator=","
          prefix="₹"
        />
        {amount !== '' && (
          <>
            <Select
              label="What kind of amount is this?"
              data={[
                { value: 'quote', label: 'Quote (an option being compared)' },
                { value: 'planned', label: 'Planned budget' },
                { value: 'paid', label: 'Paid already' },
              ]}
              value={amountKind}
              onChange={(v) => v && setAmountKind(v)}
              allowDeselect={false}
            />
            <TextInput
              label="Where does this number come from?"
              placeholder="e.g. Tanishq quote at size 24, incl. making"
              value={amountNote}
              onChange={(e) => setAmountNote(e.currentTarget.value)}
            />
          </>
        )}
        {isDateFact && (
          <Group grow align="flex-start">
            <TextInput label="Starts" type="date" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} required />
            <TextInput label="Ends (same day if blank)" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
          </Group>
        )}
        {isRouteFact && (
          <Select
            label="Chosen honeymoon route"
            data={OPTIONS.map((o) => ({ value: o.id, label: o.name }))}
            value={routeValue}
            onChange={(v) => v && setRouteValue(v)}
            allowDeselect={false}
          />
        )}
        {type === 'vendor' && (
          <>
            <TextInput
              label="Contact person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.currentTarget.value)}
            />
            <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          </>
        )}
        <Text size="xs" c="dimmed">
          Saving this will be recorded in the audit log as a manual change by {profile?.display_name ?? 'you'}.
        </Text>
        <Button onClick={handleSave} loading={saving} disabled={!title || datesInvalid || (isRouteFact && !routeValue)}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
