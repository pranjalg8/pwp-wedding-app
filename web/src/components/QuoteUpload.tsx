import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Checkbox, FileButton, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useEditMode } from '../hooks/useEditMode';
import { supabase, type Topic } from '../lib/supabase';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

// What the file is, from the browser's own guess or else the extension (phones sometimes report nothing for HEIC).
export function mimeOf(name: string, reported: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const guess = Object.values(TYPES).includes(reported) ? reported : TYPES[ext];
  return guess ?? null;
}

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, '_').slice(-80) || 'document';

type Result = { payments: number; tasks: number; notes: number; skipped: string[]; summary: string };

const ERRORS: Record<string, string> = {
  not_configured: 'Reading documents is not switched on yet (no AI key on the server).',
  rate_limited: 'The AI is busy or the hourly limit is reached. Try again in a few minutes.',
  too_big: 'That file is over 10 MB. Try a smaller photo or a compressed PDF.',
  unreadable: 'Could not read anything from that file. A clearer, flatter photo usually helps.',
  ai_unavailable: 'The AI could not be reached. Try again shortly.',
};

// Upload or photograph a vendor quote or contract. Claude reads it and files proposals in Suggestions; nothing in
// the planner changes until one of you accepts.
export function QuoteUpload({ topics = [], label = 'Add a quote', variant = 'light' }: { topics?: Pick<Topic, 'id' | 'label'>[]; label?: string; variant?: 'light' | 'default' | 'subtle' }) {
  const { isUnlocked } = useEditMode();
  const [opened, setOpened] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<'idle' | 'upload' | 'read'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const reset = useRef(() => {});
  reset.current = () => {
    setFile(null);
    setConsent(false);
    setError(null);
    setResult(null);
    setBusy('idle');
  };

  function pick(f: File | null) {
    setError(null);
    if (!f) return;
    if (!mimeOf(f.name, f.type)) return setError('Please choose a photo (JPG, PNG, WebP, HEIC) or a PDF.');
    if (f.size > MAX_BYTES) return setError('That file is over 10 MB. Try a smaller photo or a compressed PDF.');
    setFile(f);
  }

  async function send() {
    if (!file) return;
    const mime = mimeOf(file.name, file.type)!;
    setError(null);
    setBusy('upload');
    const { data: u } = await supabase.auth.getUser();
    const path = `${crypto.randomUUID()}/${safeName(file.name)}`;
    const up = await supabase.storage.from('documents').upload(path, file, { contentType: mime });
    if (up.error) {
      setBusy('idle');
      return setError('Upload failed: ' + up.error.message);
    }
    const ins = await supabase
      .from('documents')
      .insert({ storage_path: path, file_name: file.name.slice(0, 120), mime_type: mime, topic_id: topicId, uploaded_by: u.user?.id })
      .select('id')
      .single();
    if (ins.error || !ins.data) {
      setBusy('idle');
      return setError('Could not save the document: ' + (ins.error?.message ?? 'unknown'));
    }
    setBusy('read');
    const { data, error: fnErr } = await supabase.functions.invoke('doc-extract', { body: { document_id: ins.data.id } });
    setBusy('idle');
    if (fnErr) {
      let code = '';
      try {
        code = ((await (fnErr as { context?: Response }).context?.clone().json()) as { error?: string }).error ?? '';
      } catch {
        // not a JSON error body
      }
      return setError(ERRORS[code] ?? 'Something went wrong reading the document.');
    }
    setResult(data as Result);
  }

  const total = result ? result.payments + result.tasks + result.notes : 0;

  return (
    <>
      <Button variant={variant} color="rose" size="sm" leftSection={<span aria-hidden>📎</span>} onClick={() => setOpened(true)}>
        {label}
      </Button>
      <Modal opened={opened} onClose={() => { setOpened(false); reset.current(); }} title="Add a quote or contract" centered>
        <Stack gap="sm">
          {!result && (
            <>
              <Text size="sm" c="dimmed">
                Photograph or upload a vendor quote, estimate or contract. Claude reads it and proposes payments, tasks and a note of the terms. You review each one in Suggestions; nothing is added until you accept.
              </Text>
              {!isUnlocked && <Alert color="yellow">Unlock edit mode first (the lock at the top) to add a document.</Alert>}
              <Group gap="xs">
                <FileButton onChange={pick} accept="image/*,application/pdf">
                  {(props) => <Button {...props} variant="default" disabled={!isUnlocked || busy !== 'idle'}>Choose a photo or PDF</Button>}
                </FileButton>
                <Text size="sm" style={{ overflowWrap: 'anywhere' }}>{file ? `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)` : 'Nothing chosen'}</Text>
              </Group>
              <Select
                label="Which area is it for? (optional)"
                placeholder="Let Claude work it out"
                data={topics.map((t) => ({ value: t.id, label: t.label }))}
                value={topicId}
                onChange={setTopicId}
                clearable
                searchable
              />
              <Checkbox
                checked={consent}
                onChange={(e) => setConsent(e.currentTarget.checked)}
                label="I am happy for this file to be sent to Google's Gemini (free tier) to be read. Bank details are ignored and never saved."
              />
              {error && <Alert color="red">{error}</Alert>}
              <Button color="rose" onClick={send} disabled={!file || !consent || !isUnlocked} loading={busy !== 'idle'}>
                {busy === 'read' ? 'Reading the document…' : busy === 'upload' ? 'Uploading…' : 'Read it'}
              </Button>
            </>
          )}
          {result && (
            <>
              <Alert color={total ? 'teal' : 'yellow'} title={total ? `${total} ${total === 1 ? 'suggestion' : 'suggestions'} ready` : 'Nothing to propose'}>
                <Text size="sm">
                  {result.summary || 'Read.'}
                  {total > 0 && ` ${result.payments} payment${result.payments === 1 ? '' : 's'}, ${result.tasks} task${result.tasks === 1 ? '' : 's'}${result.notes ? ', 1 note of the terms' : ''}.`}
                </Text>
              </Alert>
              {result.skipped.length > 0 && (
                <Text size="xs" c="dimmed">Left out: {result.skipped.join('; ')}</Text>
              )}
              <Group>
                {total > 0 && (
                  <Button component={Link} to="/activity/suggestions" color="rose" onClick={() => { setOpened(false); reset.current(); }}>
                    Review suggestions
                  </Button>
                )}
                <Button variant="subtle" color="gray" onClick={() => reset.current()}>Add another</Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
