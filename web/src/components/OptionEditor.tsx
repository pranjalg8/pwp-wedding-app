import { useState } from 'react';
import { Button, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { supabase, type TaskOption } from '../lib/supabase';
import { OPTION_STATUS_LABEL, OPTION_STATUS_ORDER } from '../lib/topicMeta';

function metaStr(o: TaskOption | null, key: string) {
  const v = o?.metadata?.[key];
  return typeof v === 'string' ? v : '';
}

export function OptionEditor({
  taskId,
  option,
  opened,
  onClose,
  onSaved,
}: {
  taskId: string;
  option: TaskOption | null;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(option?.name ?? '');
  const [status, setStatus] = useState<string>(option?.status ?? 'considering');
  const [summary, setSummary] = useState(option?.summary ?? '');
  const [whyNote, setWhyNote] = useState(option?.why_note ?? '');
  const [person, setPerson] = useState(metaStr(option, 'contact_person'));
  const [phone, setPhone] = useState(metaStr(option, 'phone'));
  const [email, setEmail] = useState(metaStr(option, 'email'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      task_id: taskId,
      name,
      status,
      summary: summary || null,
      why_note: whyNote || null,
      // keep any other metadata keys; only contact fields are edited here
      metadata: { ...option?.metadata, contact_person: person || null, phone: phone || null, email: email || null },
    };
    const res = option
      ? await supabase.from('task_options').update(payload).eq('id', option.id)
      : await supabase.from('task_options').insert(payload);
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={option ? 'Edit option' : 'New option'} centered>
      <Stack>
        <TextInput label="Name (vendor or candidate)" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <Select
          label="Status"
          allowDeselect={false}
          data={OPTION_STATUS_ORDER.map((s) => ({ value: s, label: OPTION_STATUS_LABEL[s] }))}
          value={status}
          onChange={(v) => v && setStatus(v)}
        />
        <Textarea label="Summary" value={summary} onChange={(e) => setSummary(e.currentTarget.value)} minRows={2} autosize />
        <TextInput
          label="Why parked or rejected (optional)"
          value={whyNote}
          onChange={(e) => setWhyNote(e.currentTarget.value)}
        />
        <TextInput label="Contact person" value={person} onChange={(e) => setPerson(e.currentTarget.value)} />
        <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
        <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        {error && <span style={{ color: 'var(--mantine-color-red-6)', fontSize: 13 }}>{error}</span>}
        <Button onClick={save} loading={saving} disabled={!name.trim()}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
