import { useState } from 'react';
import { Button, Group, Modal, NumberInput, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { supabase, type PlanningItem } from '../lib/supabase';
import { recordManualChange } from '../lib/audit';
import { useProfile } from '../hooks/useProfile';

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
  const [contactPerson, setContactPerson] = useState(
    typeof item?.metadata?.contact_person === 'string' ? item.metadata.contact_person : ''
  );
  const [phone, setPhone] = useState(typeof item?.metadata?.phone === 'string' ? item.metadata.phone : '');
  const [email, setEmail] = useState(typeof item?.metadata?.email === 'string' ? item.metadata.email : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const payload = {
      topic_id: topicId,
      title,
      detail: detail || null,
      type,
      status,
      amount: amount === '' ? null : amount,
      metadata:
        type === 'vendor'
          ? { ...item?.metadata, contact_person: contactPerson || null, phone: phone || null, email: email || null }
          : { ...item?.metadata },
      created_by: profile?.id ?? null,
    };

    if (item) {
      const { error } = await supabase.from('planning_items').update(payload).eq('id', item.id);
      if (!error) {
        await recordManualChange({
          actorName: profile?.display_name ?? 'unknown',
          tableName: 'planning_items',
          recordId: item.id,
          action: 'update',
          before: item,
          after: { ...item, ...payload },
        });
      }
    } else {
      const { data, error } = await supabase.from('planning_items').insert(payload).select().single();
      if (!error && data) {
        await recordManualChange({
          actorName: profile?.display_name ?? 'unknown',
          tableName: 'planning_items',
          recordId: data.id,
          action: 'insert',
          after: data,
        });
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={item ? 'Edit item' : 'New item'} centered>
      <Stack>
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
        <Button onClick={handleSave} loading={saving} disabled={!title}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
