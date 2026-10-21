import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Chip,
  Collapse,
  CopyButton,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useProfile } from '../hooks/useProfile';
import {
  ALL_SENSITIVE,
  NO_SENSITIVE,
  PRESETS,
  SECTIONS,
  SENSITIVE,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  sensitiveOf,
  stateOf,
  timeLeft,
  type SectionKey,
  type Sensitivity,
  type ShareLink,
} from '../lib/shareLinks';

const sectionLabel = (k: SectionKey) => SECTIONS.find((s) => s.key === k)?.label ?? k;
const sensitiveLabel = (k: string) => SENSITIVE.find((s) => s.key === k)?.label ?? k;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function NewLinkModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { url: string; expiresAt: string }) => void }) {
  const { profile } = useProfile();
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<'family' | 'planning' | 'custom'>('planning');
  const [sections, setSections] = useState<SectionKey[]>([...PRESETS.planning.sections]);
  const [sensitive, setSensitive] = useState<Sensitivity>(NO_SENSITIVE);
  const [ttlDays, setTtlDays] = useState('3');
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anySensitive = sensitiveOf({ show_money: sensitive.money, show_guests: sensitive.guests, show_honeymoon: sensitive.honeymoon, show_contacts: sensitive.contacts });

  function pickPreset(p: 'family' | 'planning' | 'custom') {
    setPreset(p);
    setUnderstood(false);
    if (p === 'family') {
      setSections([...PRESETS.family.sections]);
      setSensitive(ALL_SENSITIVE);
    } else if (p === 'planning') {
      setSections([...PRESETS.planning.sections]);
      setSensitive(NO_SENSITIVE);
    }
  }

  // Picking Budget or Honeymoon turns on what it needs, in plain view, so it is never a surprise.
  function changeSections(next: string[]) {
    setPreset('custom');
    const picked = next as SectionKey[];
    setSections(picked);
    setSensitive((s) => {
      const out = { ...s };
      for (const sec of SECTIONS) if (sec.needs && picked.includes(sec.key) && !sections.includes(sec.key)) out[sec.needs] = true;
      return out;
    });
    setUnderstood(false);
  }

  function changeSensitive(key: keyof Sensitivity, on: boolean) {
    setPreset('custom');
    setSensitive((s) => ({ ...s, [key]: on }));
    setUnderstood(false);
  }

  const ready = label.trim().length > 0 && sections.length > 0 && (anySensitive.length === 0 || understood);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      onCreated(await createShareLink({ label, sections, sensitive, ttlDays: Number(ttlDays) }, profile?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.');
      setSaving(false);
    }
  }

  return (
    <Modal opened onClose={onClose} title="New share link" size="lg" centered>
      <Stack gap="md">
        <TextInput label="Who is it for?" description="A name only you will see, so you can tell links apart" placeholder="e.g. Mummy and Papa, Photographer" value={label} onChange={(e) => setLabel(e.currentTarget.value)} data-autofocus />

        <Stack gap={6}>
          <Text size="sm" fw={600}>
            Start from
          </Text>
          <SegmentedControl
            fullWidth
            value={preset}
            onChange={(v) => pickPreset(v as 'family' | 'planning' | 'custom')}
            data={[
              { value: 'planning', label: PRESETS.planning.label },
              { value: 'family', label: PRESETS.family.label },
              { value: 'custom', label: 'Pick my own' },
            ]}
          />
          <Text size="xs" c="dimmed">
            {preset === 'family' ? PRESETS.family.hint : preset === 'planning' ? PRESETS.planning.hint : 'Choose the sections and the sensitive information below.'}
          </Text>
        </Stack>

        <Stack gap={6}>
          <Text size="sm" fw={600}>
            What can they open?
          </Text>
          <Chip.Group multiple value={sections} onChange={changeSections}>
            <Group gap="xs">
              {SECTIONS.map((s) => (
                <Chip key={s.key} value={s.key} size="sm" variant="light" title={s.hint}>
                  {s.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Stack>

        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Sensitive information
          </Text>
          <Text size="xs" c="dimmed">
            Off unless you switch it on. Anyone who has the link sees what is switched on.
          </Text>
          {SENSITIVE.map((s) => (
            <Switch key={s.key} checked={sensitive[s.key]} onChange={(e) => changeSensitive(s.key, e.currentTarget.checked)} label={s.label} description={s.warning} color="orange" />
          ))}
        </Stack>

        <Collapse expanded={anySensitive.length > 0}>
          <Alert color="orange" variant="light" title="This link will show sensitive information">
            <Stack gap="xs">
              <Text size="sm">
                Anyone who gets this link can see {anySensitive.map(sensitiveLabel).join(', ').toLowerCase()} without signing in. A link can be forwarded
                or screenshotted, so only send it to people you trust. You can revoke it at any time, and it stops working by itself when it expires.
              </Text>
              <Checkbox checked={understood} onChange={(e) => setUnderstood(e.currentTarget.checked)} label="I understand, and I am sending this to someone I trust" />
            </Stack>
          </Alert>
        </Collapse>

        <Group grow align="flex-start">
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Access
            </Text>
            <SegmentedControl value="view" data={[{ value: 'view', label: 'View only' }, { value: 'edit', label: 'Can edit (coming next)', disabled: true }]} />
          </Stack>
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Expires
            </Text>
            <SegmentedControl value={ttlDays} onChange={setTtlDays} data={[{ value: '1', label: 'In 1 day' }, { value: '3', label: 'In 3 days' }]} />
          </Stack>
        </Group>

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Button onClick={create} loading={saving} disabled={!ready}>
          Create link
        </Button>
      </Stack>
    </Modal>
  );
}

function CreatedModal({ url, expiresAt, onClose }: { url: string; expiresAt: string; onClose: () => void }) {
  return (
    <Modal opened onClose={onClose} title="Your link is ready" centered>
      <Stack>
        <Alert color="blue" variant="light">
          This is the only time the link is shown. Copy it now. If you lose it, make a new one and revoke this one.
        </Alert>
        <TextInput readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Works until {when(expiresAt)} ({timeLeft(expiresAt)}).
          </Text>
          <CopyButton value={url}>
            {({ copied, copy }) => (
              <Button onClick={copy} color={copied ? 'teal' : undefined}>
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Button variant="default" onClick={onClose}>
          Done
        </Button>
      </Stack>
    </Modal>
  );
}

function LinkRow({ link, onRevoke }: { link: ShareLink; onRevoke: (l: ShareLink) => void }) {
  const state = stateOf(link);
  const sens = sensitiveOf(link);
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" py="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      <Stack gap={6} style={{ minWidth: 0 }}>
        <Group gap="xs">
          <Text fw={600}>{link.label}</Text>
          <Badge size="sm" variant="light" color={state === 'active' ? 'teal' : 'gray'} tt="none">
            {state === 'active' ? timeLeft(link.expires_at) : state === 'revoked' ? 'Revoked' : 'Expired'}
          </Badge>
          <Badge size="sm" variant="outline" color="gray" tt="none">
            {link.access === 'edit' ? 'Can edit' : 'View only'}
          </Badge>
        </Group>
        <Group gap={4}>
          {link.sections.map((s) => (
            <Badge key={s} size="sm" variant="light" color="gray" tt="none">
              {sectionLabel(s)}
            </Badge>
          ))}
        </Group>
        {sens.length > 0 && (
          <Group gap={4}>
            <Text size="xs" c="orange" fw={600}>
              Shows:
            </Text>
            {sens.map((k) => (
              <Badge key={k} size="sm" variant="light" color="orange" tt="none">
                {sensitiveLabel(k)}
              </Badge>
            ))}
          </Group>
        )}
        <Text size="xs" c="dimmed">
          Created {when(link.created_at)} · expires {when(link.expires_at)} ·{' '}
          {link.use_count === 0 ? 'not opened yet' : `opened ${link.use_count} time${link.use_count === 1 ? '' : 's'}, last ${link.last_used_at ? when(link.last_used_at) : ''}`}
        </Text>
      </Stack>
      {state === 'active' && (
        <Button size="compact-sm" variant="light" color="red" onClick={() => onRevoke(link)}>
          Revoke
        </Button>
      )}
    </Group>
  );
}

export function ShareLinks() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    try {
      setLinks(await listShareLinks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the links.');
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(l: ShareLink) {
    if (!window.confirm(`Revoke "${l.label}"? Anyone using this link will lose access straight away.`)) return;
    try {
      await revokeShareLink(l.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke the link.');
    }
  }

  const active = links.filter((l) => stateOf(l) === 'active');
  const past = links.filter((l) => stateOf(l) !== 'active');

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" gap="sm">
        <div>
          <Title order={2}>Share</Title>
          <Text size="sm" c="dimmed" maw={640}>
            Give family, friends or vendors a link to part of the planner. They open it without signing in. Every link expires within 3 days, shows only the sections
            you choose, and can be revoked at any time.
          </Text>
        </div>
        <Button onClick={() => setCreating(true)}>New link</Button>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper withBorder p="md">
        <Text fw={700} mb={4}>
          Active links ({active.length})
        </Text>
        {loaded && active.length === 0 ? (
          <Text size="sm" c="dimmed">
            No active links. Create one to share part of the planner.
          </Text>
        ) : (
          active.map((l) => <LinkRow key={l.id} link={l} onRevoke={revoke} />)
        )}
      </Paper>

      {past.length > 0 && (
        <Stack gap="xs">
          <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setShowPast((v) => !v)} w="fit-content">
            {showPast ? 'Hide' : 'Show'} past links ({past.length})
          </Button>
          <Collapse expanded={showPast}>
            <Paper withBorder p="md">
              {past.map((l) => (
                <LinkRow key={l.id} link={l} onRevoke={revoke} />
              ))}
            </Paper>
          </Collapse>
        </Stack>
      )}

      {creating && (
        <NewLinkModal
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false);
            setCreated(r);
            load();
          }}
        />
      )}
      {created && <CreatedModal url={created.url} expiresAt={created.expiresAt} onClose={() => setCreated(null)} />}
    </Stack>
  );
}
