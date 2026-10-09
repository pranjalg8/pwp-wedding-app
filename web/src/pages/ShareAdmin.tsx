import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { supabase, type Task, type TaskOption } from '../lib/supabase';
import { usePlanFacts } from '../hooks/usePlanFacts';
import { formatRange } from '../lib/planFacts';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/topicMeta';
import {
  completeNewPassword,
  getIdentity,
  signIn,
  signOut,
  type CoreIdentity,
} from '../lib/core/auth';
import {
  CoreError,
  createGuestLink,
  getIntegration,
  getPolicy,
  getPublishedGuestPage,
  listLinks,
  publishGuestPage,
  revokeLink,
  setAllowAnonymous,
  type Integration,
  type ShareLink,
  type SharePolicy,
} from '../lib/core/api';
import { emptyGuestPage, type GuestPage } from '../lib/core/guest';

type GuestPick = { note: string; showChosen: boolean };

const errText = (e: unknown) =>
  e instanceof CoreError
    ? e.status === 403
      ? 'core-services refused this (403). This account probably is not the tenant-admin.'
      : e.message
    : e instanceof Error
      ? e.message
      : 'Something went wrong';

function CoreSignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [needsNew, setNeedsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (needsNew) {
        await completeNewPassword(newPassword);
        setNewPassword('');
        onDone();
      } else {
        const r = await signIn(email.trim(), password);
        setPassword('');
        if (r.status === 'new_password_required') setNeedsNew(true);
        else onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper withBorder p="md">
      <form onSubmit={submit}>
        <Stack gap="sm">
          <Title order={4}>Sign in to core-services</Title>
          <Text size="sm" c="dimmed">
            This is separate from your planner login. Use the tenant-admin account for the wedding tenant. The password goes
            straight to the sign-in service and is not stored.
          </Text>
          {needsNew ? (
            <PasswordInput
              label="Choose a new password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              required
            />
          ) : (
            <>
              <TextInput
                label="Email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
            </>
          )}
          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
          <Button type="submit" loading={busy}>
            {needsNew ? 'Set password' : 'Sign in'}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

export function ShareAdmin() {
  const facts = usePlanFacts();
  const [identity, setIdentity] = useState<CoreIdentity | undefined | null>(null); // null = checking
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [policy, setPolicy] = useState<SharePolicy | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [title, setTitle] = useState(emptyGuestPage().title);
  const [intro, setIntro] = useState('');
  const [includeDates, setIncludeDates] = useState(true);
  const [picks, setPicks] = useState<Record<string, GuestPick>>({});
  const [published, setPublished] = useState<GuestPage | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPolicy, setConfirmPolicy] = useState<boolean | null>(null);
  const [ttl, setTtl] = useState('1440');
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState<number | string>(100);
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);

  const note = (kind: 'ok' | 'error', text: string) => setMessage({ kind, text });

  // planner side (Supabase): the task list to choose from
  useEffect(() => {
    (async () => {
      const [t, o] = await Promise.all([
        supabase.from('tasks').select('*').order('sort_order'),
        supabase.from('task_options').select('task_id, name, status').eq('status', 'chosen'),
      ]);
      setTasks((t.data ?? []) as Task[]);
      const byTask: Record<string, string[]> = {};
      for (const r of (o.data ?? []) as Pick<TaskOption, 'task_id' | 'name'>[]) (byTask[r.task_id] ??= []).push(r.name);
      setChosen(byTask);
    })();
  }, []);

  const loadCore = useCallback(async () => {
    const id = await getIdentity();
    setIdentity(id);
    if (!id) return;
    const [integ, pol, lnk, pub] = await Promise.allSettled([getIntegration(), getPolicy(), listLinks(), getPublishedGuestPage()]);
    if (integ.status === 'fulfilled') setIntegration(integ.value);
    else note('error', `Could not read the tenant: ${errText(integ.reason)}`);
    if (pol.status === 'fulfilled') setPolicy(pol.value);
    if (lnk.status === 'fulfilled') setLinks(lnk.value);
    if (pub.status === 'fulfilled') setPublished(pub.value);
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  // continue from the last published page
  useEffect(() => {
    if (!published || tasks.length === 0) return;
    setTitle(published.title);
    setIntro(published.intro);
    setIncludeDates(published.dates.length > 0);
    const next: Record<string, GuestPick> = {};
    for (const s of published.sections) {
      const t = tasks.find((x) => x.title === s.heading);
      if (t) next[t.id] = { note: s.note, showChosen: s.chosen.length > 0 };
    }
    setPicks(next);
  }, [published, tasks]);

  const dateRows = useMemo(
    () => [
      { label: 'Haldi', text: formatRange(facts.dates.haldi, { full: true }) },
      { label: 'Mehndi', text: formatRange(facts.dates.mehndi, { full: true }) },
      { label: 'Wedding', text: formatRange(facts.dates.wedding, { full: true }) },
      { label: 'Reception', text: formatRange(facts.dates.reception, { full: true }) },
    ],
    [facts],
  );

  function buildPage(): GuestPage {
    return {
      version: 1,
      publishedAt: new Date().toISOString(),
      title: title.trim() || emptyGuestPage().title,
      intro: intro.trim(),
      dates: includeDates ? dateRows : [],
      sections: tasks
        .filter((t) => picks[t.id])
        .map((t) => ({
          heading: t.title,
          status: t.status,
          chosen: picks[t.id].showChosen ? (chosen[t.id] ?? []) : [],
          note: picks[t.id].note.trim(),
        })),
    };
  }

  async function run<T>(key: string, fn: () => Promise<T>, okText?: string) {
    setBusy(key);
    setMessage(null);
    try {
      const r = await fn();
      if (okText) note('ok', okText);
      return r;
    } catch (e) {
      note('error', errText(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  const publish = () =>
    run(
      'publish',
      async () => {
        const page = buildPage();
        await publishGuestPage(page);
        setPublished(page);
      },
      'Guest page published. Links show the latest version, so you do not need new links after an update.',
    );

  const applyPolicy = async (allow: boolean) => {
    setConfirmPolicy(null);
    const p = await run('policy', () => setAllowAnonymous(allow), allow ? 'Anonymous links are now allowed.' : 'Anonymous links are off.');
    if (p) setPolicy(p);
  };

  const makeLink = async () => {
    const r = await run('link', () =>
      createGuestLink({ label: label.trim() || 'Guest page', ttlMinutes: Number(ttl), maxRedemptions: Number(maxUses) || 100 }),
    );
    if (r?.token) {
      setCreated({ url: `${window.location.origin}${import.meta.env.BASE_URL}#/share/${r.token}`, expiresAt: r.expiresAt });
      setLabel('');
      setLinks(await listLinks());
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this link? It stops working within about a minute.')) return;
    await run('revoke', () => revokeLink(id), 'Link revoked.');
    setLinks(await listLinks());
  };

  if (identity === null) {
    return (
      <Group justify="center" mt={80}>
        <Loader color="rose" />
      </Group>
    );
  }

  const maxTtl = policy?.effectiveMaxAnonymousMinutes ?? 1440;
  const ttlOptions = [
    { value: '60', label: '1 hour' },
    { value: '360', label: '6 hours' },
    { value: '1440', label: '24 hours' },
  ].filter((o) => Number(o.value) <= maxTtl);
  const isAdmin = (identity?.groups ?? []).some((g) => /admin/i.test(g));

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Share with family and guests</Title>
        <Text c="dimmed" size="sm">
          Publish a small guest page you write yourself, then give people a link that expires. Nothing from the planner (amounts,
          contacts, chats) is shared unless you type it here.
        </Text>
      </div>

      {message && (
        <Alert color={message.kind === 'ok' ? 'teal' : 'red'} withCloseButton onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {!identity ? (
        <CoreSignIn onDone={loadCore} />
      ) : (
        <>
          <Paper withBorder p="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={600}>{identity.email}</Text>
                <Text size="sm" c="dimmed">
                  tenant <Code>{identity.tenantId ?? '?'}</Code> · app <Code>{identity.clientId ?? '?'}</Code> · groups{' '}
                  {identity.groups.length ? identity.groups.join(', ') : 'none'}
                </Text>
                {integration && (
                  <Text size="sm" c="teal">
                    Connected: {integration.tenantId} / {integration.clientId}
                    {integration.apps?.length ? ` · apps: ${integration.apps.map((a) => a.clientId).join(', ')}` : ''}
                  </Text>
                )}
                {!isAdmin && (
                  <Text size="sm" c="orange">
                    This account is not in an admin group, so creating links or changing the policy will be refused.
                  </Text>
                )}
              </Stack>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => {
                  signOut();
                  setIdentity(undefined);
                  setIntegration(null);
                  setPolicy(null);
                  setLinks([]);
                  setCreated(null);
                }}
              >
                Sign out of core-services
              </Button>
            </Group>
          </Paper>

          <Paper withBorder p="md">
            <Group justify="space-between" align="center">
              <Stack gap={2}>
                <Text fw={600}>Anonymous links</Text>
                <Text size="sm" c="dimmed">
                  Anyone with an anonymous link can view the guest page until it expires (at most {Math.round(maxTtl / 60)} hours).
                  They are off unless you turn them on, and the platform audits every open.
                </Text>
              </Stack>
              {policy ? (
                <Group gap="xs">
                  <Badge color={policy.allowAnonymous ? 'teal' : 'gray'} variant="light">
                    {policy.allowAnonymous ? 'On' : 'Off'}
                  </Badge>
                  <Button
                    size="xs"
                    variant="light"
                    loading={busy === 'policy'}
                    color={policy.allowAnonymous ? 'gray' : 'rose'}
                    onClick={() => (policy.allowAnonymous ? applyPolicy(false) : setConfirmPolicy(true))}
                  >
                    {policy.allowAnonymous ? 'Turn off' : 'Turn on'}
                  </Button>
                </Group>
              ) : (
                <Loader size="sm" />
              )}
            </Group>
          </Paper>

          <Paper withBorder p="md">
            <Stack gap="sm">
              <Title order={4}>Guest page</Title>
              <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
              <Textarea label="Welcome note" value={intro} onChange={(e) => setIntro(e.currentTarget.value)} autosize minRows={2} />
              <Checkbox
                label={`Show the key dates (${dateRows.map((d) => d.label).join(', ')})`}
                checked={includeDates}
                onChange={(e) => setIncludeDates(e.currentTarget.checked)}
              />
              <Text size="sm" fw={600} mt="xs">
                Tasks to include
              </Text>
              <Text size="xs" c="dimmed">
                Only the task name, its status and the text you write below are published. Chosen option names are optional.
              </Text>
              {tasks.map((t) => {
                const pick = picks[t.id];
                return (
                  <Paper key={t.id} withBorder p="sm">
                    <Checkbox
                      label={
                        <Group gap={6}>
                          <Text size="sm">{t.title}</Text>
                          <Badge size="xs" color={STATUS_COLOR[t.status]} variant="light">
                            {STATUS_LABEL[t.status]}
                          </Badge>
                        </Group>
                      }
                      checked={!!pick}
                      onChange={(e) =>
                        setPicks((prev) => {
                          const next = { ...prev };
                          if (e.currentTarget.checked) next[t.id] = { note: '', showChosen: false };
                          else delete next[t.id];
                          return next;
                        })
                      }
                    />
                    {pick && (
                      <Stack gap="xs" mt="xs" pl="lg">
                        <Textarea
                          placeholder="What should guests know? e.g. rooms are booked at Hotel Sai, Bawal for 14 and 15 Feb."
                          value={pick.note}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            setPicks((prev) => ({ ...prev, [t.id]: { ...prev[t.id], note: v } }));
                          }}
                          autosize
                          minRows={2}
                        />
                        {(chosen[t.id]?.length ?? 0) > 0 && (
                          <Checkbox
                            size="xs"
                            label={`Show the chosen option: ${chosen[t.id].join(', ')}`}
                            checked={pick.showChosen}
                            onChange={(e) => {
                              const v = e.currentTarget.checked;
                              setPicks((prev) => ({ ...prev, [t.id]: { ...prev[t.id], showChosen: v } }));
                            }}
                          />
                        )}
                      </Stack>
                    )}
                  </Paper>
                );
              })}
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  {published?.publishedAt
                    ? `Last published ${new Date(published.publishedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
                    : 'Not published yet'}
                </Text>
                <Button onClick={publish} loading={busy === 'publish'}>
                  Publish guest page
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Stack gap="sm">
              <Title order={4}>Create a link</Title>
              {!published && <Text size="sm" c="orange">Publish the guest page first so the link has something to show.</Text>}
              {policy && !policy.allowAnonymous && (
                <Text size="sm" c="orange">
                  Anonymous links are off. Turn them on above, then create the link.
                </Text>
              )}
              <TextInput label="Label (only you see this)" placeholder="e.g. Hotel Sai or Mom's side" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
              <Group grow align="flex-end">
                <Select label="Works for" allowDeselect={false} data={ttlOptions} value={ttl} onChange={(v) => v && setTtl(v)} />
                <NumberInput label="Max opens" min={1} max={1000} value={maxUses} onChange={setMaxUses} />
              </Group>
              <Button
                onClick={makeLink}
                loading={busy === 'link'}
                disabled={!policy?.allowAnonymous || !published}
              >
                Create link
              </Button>
              {created && (
                <Alert color="rose" title="Copy this link now. It is shown only once.">
                  <Stack gap="xs">
                    <TextInput readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} />
                    <Group gap="xs">
                      <CopyButton value={created.url}>
                        {({ copied, copy }) => (
                          <Button size="xs" onClick={copy} color={copied ? 'teal' : 'rose'}>
                            {copied ? 'Copied' : 'Copy link'}
                          </Button>
                        )}
                      </CopyButton>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => setCreated(null)}>
                        Done
                      </Button>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Expires {new Date(created.expiresAt).toLocaleString('en-IN')}. Treat it like a password: anyone who has it can open the page.
                    </Text>
                  </Stack>
                </Alert>
              )}
            </Stack>
          </Paper>

          <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
            <Group justify="space-between" p="md" pb="xs">
              <Title order={4}>Your links</Title>
              <Button size="xs" variant="subtle" onClick={async () => setLinks(await listLinks())}>
                Refresh
              </Button>
            </Group>
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Label</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Expires</Table.Th>
                    <Table.Th>Opens</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {links.map((l) => (
                    <Table.Tr key={l.linkId}>
                      <Table.Td>{l.label || '—'}</Table.Td>
                      <Table.Td>
                        <Badge color={l.status === 'ACTIVE' ? 'teal' : 'gray'} variant="light">
                          {l.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{new Date(l.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Table.Td>
                      <Table.Td>
                        {l.redemptionCount}
                        {l.maxRedemptions ? ` / ${l.maxRedemptions}` : ''}
                      </Table.Td>
                      <Table.Td ta="right">
                        {l.status === 'ACTIVE' && (
                          <Button size="compact-xs" variant="light" color="red" onClick={() => revoke(l.linkId)}>
                            Revoke
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {links.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" size="sm">
                          No links yet.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </>
      )}

      <Modal opened={confirmPolicy !== null} onClose={() => setConfirmPolicy(null)} title="Allow anonymous links?" centered>
        <Stack>
          <Text size="sm">
            Anyone you give a link to will be able to open the guest page without signing in, until the link expires (at most 24
            hours). They can only read the guest page. You can revoke a link at any time and switch this off again.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmPolicy(null)}>
              Cancel
            </Button>
            <Button onClick={() => applyPolicy(true)}>Allow anonymous links</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
