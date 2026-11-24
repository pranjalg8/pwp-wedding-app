import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Box, Button, Group, Menu, Modal, Paper, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import { UndoMessage } from './UndoMessage';
import { EmptyState } from './EmptyState';
import type { RsvpDay } from '../lib/rsvp';
import type { Invite } from '../lib/rsvp';
import type { GuestContact } from './HouseholdList';
import { inviteLink, makeCode, type InviteCode, type InviteReply } from '../lib/replies';
import {
  CHANNEL_LABEL,
  KIND_LABEL,
  OWNERS,
  OWNER_LABEL,
  countByOwner,
  MESSAGE_APPROVED,
  inviteMessage,
  ownerForProfile,
  shortDate,
  trackHousehold,
  whatsappSendUrl,
  type HouseholdTrack,
  type InviteSend,
  type Lang,
  type Owner,
  type SendChannel,
  type SendKind,
} from '../lib/invites';
import { confirmDanger } from '../lib/confirm';

export type TrackedGuest = { id: string; name: string; persons: number; list_group: string | null; relation: string | null; handled_by: Owner };

type OwnerFilter = Owner | 'all';
type StageFilter = 'all' | 'to_send' | 'remind' | 'waiting' | 'replied';

const SENDER_KEY = 'pwp.invites.sender';
const LANG_KEY = 'pwp.invites.lang';

function readLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // storage blocked: the choice lasts for this page load
  }
}

const fail = (title: string, message: string) => notifications.show({ color: 'red', title, message });
const shortDay = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Per-day answers for one household, as big readable chips: "14 Feb · 2 yes · 1 no reply".
function DayChips({ track }: { track: HouseholdTrack }) {
  if (track.days.length === 0) return <Text size="sm" c="dimmed">Not invited to any day yet</Text>;
  return (
    <Stack gap={4}>
      {track.days.map((d) => {
        const parts = [
          d.coming > 0 && { t: `${d.coming} yes`, c: 'teal' },
          d.maybe > 0 && { t: `${d.maybe} maybe`, c: 'yellow.9' },
          d.declined > 0 && { t: `${d.declined} no`, c: 'red' },
          d.noReply > 0 && { t: `${d.noReply} no reply`, c: 'dimmed' },
        ].filter(Boolean) as { t: string; c: string }[];
        return (
          <Group key={d.date} gap={8} wrap="wrap">
            <Text size="sm" fw={700} w={56}>
              {shortDay(d.date)}
            </Text>
            {parts.map((p) => (
              <Text key={p.t} size="sm" fw={600} c={p.c}>
                {p.t}
              </Text>
            ))}
          </Group>
        );
      })}
      {track.pendingReply && (
        <Text size="sm" c="blue">
          Reply from the invite site waiting for review ({shortDate(track.pendingReply.submitted_at)})
        </Text>
      )}
    </Stack>
  );
}

function StatusLine({ track }: { track: HouseholdTrack }) {
  const s = track.lastInvite;
  if (track.needsReminder)
    return (
      <Text fw={700} c="orange.8">
        ⏰ Reminder due · invite sent {track.daysSinceInvite} days ago
      </Text>
    );
  if (track.stage === 'replied')
    return (
      <Text fw={700} c="teal.8">
        ✓ Replied{s ? ` · sent ${shortDate(s.sent_at)} by ${OWNER_LABEL[s.sent_by]}` : ''}
      </Text>
    );
  if (s)
    return (
      <Text fw={700} c="blue.8">
        Sent {shortDate(s.sent_at)} by {OWNER_LABEL[s.sent_by]} · {CHANNEL_LABEL[s.channel]}
      </Text>
    );
  return (
    <Text fw={700} c="dimmed">
      Not sent yet
    </Text>
  );
}

// The invite tracker: each of Pranjal, Papa and Puru sees the households they handle, sends each invite from their
// own phone (WhatsApp opens with the message filled in; they press send), marks calls, cards and visits by hand, and
// sees who has replied for each day. Every send is logged with who sent it and when.
export function InviteTracker({
  guests,
  invites,
  days,
  sends,
  replies,
  codes,
  siteUrl,
  contacts,
  isUnlocked,
  onAnswer,
  reloadSends,
  reloadCodes,
  reloadGuests,
}: {
  guests: TrackedGuest[];
  invites: Invite[];
  days: RsvpDay[];
  sends: InviteSend[];
  replies: InviteReply[];
  codes: InviteCode[];
  siteUrl: string | null;
  contacts: GuestContact[];
  isUnlocked: boolean;
  onAnswer: (guestId: string) => void;
  reloadSends: () => Promise<void> | void;
  reloadCodes: () => Promise<void> | void;
  reloadGuests: () => Promise<void> | void;
}) {
  const { profile } = useProfile();
  const me = ownerForProfile(profile?.display_name);
  const [params, setParams] = useSearchParams();
  const ownerParam = params.get('owner');
  const owner: OwnerFilter = ownerParam === 'all' || OWNERS.includes(ownerParam as Owner) ? (ownerParam as OwnerFilter) : (me ?? 'all');
  const setOwner = (o: OwnerFilter) => {
    const next = new URLSearchParams(params);
    next.set('owner', o);
    setParams(next, { replace: true });
  };
  const [stage, setStage] = useState<StageFilter>('all');
  const [query, setQuery] = useState('');
  const [sender, setSenderState] = useState<Owner>(() => (readLocal(SENDER_KEY) as Owner) || me || 'pranjal');
  const setSender = (o: Owner) => {
    writeLocal(SENDER_KEY, o);
    setSenderState(o);
  };
  const [sending, setSending] = useState<TrackedGuest | null>(null);
  const [marking, setMarking] = useState<TrackedGuest | null>(null);

  // Reminder ages are worked out from when the screen opened; a send reloads the list, which is enough.
  const [now] = useState(() => new Date());
  const tracks = useMemo(() => Object.fromEntries(guests.map((g) => [g.id, trackHousehold(g, sends, invites, replies, now)])), [guests, sends, invites, replies, now]);
  const counts = useMemo(() => countByOwner(guests, tracks, days), [guests, tracks, days]);
  const codeOf = useMemo(() => new Map(codes.filter((c) => !c.revoked_at).map((c) => [c.guest_id, c.code])), [codes]);
  const phonesOf = useMemo(() => {
    const m = new Map<string, GuestContact[]>();
    for (const c of [...contacts].sort((a, b) => a.rank - b.rank)) if (c.kind === 'phone') m.set(c.guest_id, [...(m.get(c.guest_id) ?? []), c]);
    return m;
  }, [contacts]);

  const mine = guests.filter((g) => owner === 'all' || g.handled_by === owner);
  const q = query.trim().toLowerCase();
  const visible = mine
    .filter((g) => {
      const t = tracks[g.id];
      if (stage === 'to_send') return t.stage === 'not_sent';
      if (stage === 'remind') return t.needsReminder;
      if (stage === 'waiting') return t.stage === 'sent';
      if (stage === 'replied') return t.stage === 'replied';
      return true;
    })
    .filter((g) => !q || g.name.toLowerCase().includes(q) || (g.list_group ?? '').toLowerCase().includes(q));

  const shownOwners = owner === 'all' ? OWNERS : [owner];
  const stageCount = (s: StageFilter) =>
    mine.filter((g) => {
      const t = tracks[g.id];
      return s === 'all' || (s === 'to_send' ? t.stage === 'not_sent' : s === 'remind' ? t.needsReminder : s === 'waiting' ? t.stage === 'sent' : t.stage === 'replied');
    }).length;

  async function logSend(g: TrackedGuest, row: { kind: SendKind; channel: SendChannel; sent_at?: string; note?: string | null }) {
    const { data, error } = await supabase
      .from('invite_sends')
      .insert({ guest_id: g.id, sent_by: sender, ...row })
      .select('id')
      .single();
    if (error) {
      fail('Could not record the send', error.message);
      return;
    }
    await reloadSends();
    const id = (data as { id: string }).id;
    notifications.show({
      id: `send-${id}`,
      color: 'teal',
      autoClose: 12000,
      withCloseButton: true,
      title: `${KIND_LABEL[row.kind]} recorded`,
      message: (
        <UndoMessage
          text={`${g.name}: ${CHANNEL_LABEL[row.channel]}, by ${OWNER_LABEL[sender]}.`}
          onUndo={async () => {
            notifications.hide(`send-${id}`);
            const { error: e } = await supabase.from('invite_sends').delete().eq('id', id);
            if (e) fail('Could not undo', e.message);
            await reloadSends();
          }}
        />
      ),
    });
  }

  async function removeSend(s: InviteSend, g: TrackedGuest) {
    const ok = await confirmDanger({
      title: 'Remove this send?',
      message: `${KIND_LABEL[s.kind]} to ${g.name} on ${shortDate(s.sent_at)} by ${OWNER_LABEL[s.sent_by]} will be taken off the log. This is recorded in the activity log.`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    const { error } = await supabase.from('invite_sends').delete().eq('id', s.id);
    if (error) fail('Could not remove', error.message);
    await reloadSends();
  }

  async function reassign(g: TrackedGuest, o: Owner) {
    const { error } = await supabase.from('guests').update({ handled_by: o }).eq('id', g.id);
    if (error) return fail('Could not change who handles it', error.message);
    notifications.show({ color: 'teal', message: `${g.name} is now ${OWNER_LABEL[o]}'s.` });
    await reloadGuests();
  }

  const ownerData = [
    ...(me ? [{ value: me, label: 'Mine' }] : []),
    ...OWNERS.filter((o) => o !== me).map((o) => ({ value: o, label: OWNER_LABEL[o] })),
    { value: 'all', label: 'Everyone' },
  ];

  return (
    <Stack gap="md">
      <SegmentedControl size="md" fullWidth value={owner} onChange={(v) => setOwner(v as OwnerFilter)} data={ownerData} aria-label="Whose households" />

      <SimpleGrid cols={{ base: 1, sm: shownOwners.length }} spacing="sm">
        {shownOwners.map((o) => {
          const c = counts[o];
          return (
            <Paper key={o} withBorder p="md" radius="lg">
              <Group justify="space-between" align="baseline">
                <Text fw={700} fz="lg">
                  {OWNER_LABEL[o]}
                </Text>
                <Text size="sm" c="dimmed">
                  {c.households} households · {c.people} people
                </Text>
              </Group>
              <Group gap="lg" mt={6}>
                <div>
                  <Text fz={28} fw={700} lh={1}>
                    {c.sent}
                  </Text>
                  <Text size="xs" c="dimmed">
                    sent
                  </Text>
                </div>
                <div>
                  <Text fz={28} fw={700} lh={1}>
                    {c.replied}
                  </Text>
                  <Text size="xs" c="dimmed">
                    replied
                  </Text>
                </div>
                <div>
                  <Text fz={28} fw={700} lh={1} c={c.needsReminder > 0 ? 'orange.8' : undefined}>
                    {c.needsReminder}
                  </Text>
                  <Text size="xs" c="dimmed">
                    reminder due
                  </Text>
                </div>
              </Group>
              <Stack gap={2} mt="sm">
                {days.map((d) => {
                  const b = c.byDay[d.date];
                  return (
                    <Text key={d.date} size="sm">
                      <Text span fw={700}>
                        {d.label}:
                      </Text>{' '}
                      {b.coming} yes{b.maybe ? ` · ${b.maybe} maybe` : ''} of {b.invited} invited
                    </Text>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Group gap="xs" wrap="wrap">
        {(
          [
            ['all', 'All'],
            ['to_send', 'To send'],
            ['remind', 'Reminder due'],
            ['waiting', 'Waiting'],
            ['replied', 'Replied'],
          ] as [StageFilter, string][]
        ).map(([v, label]) => {
          const on = stage === v;
          return (
            <UnstyledButton
              key={v}
              onClick={() => setStage(v)}
              aria-pressed={on}
              style={{
                padding: '9px 16px',
                borderRadius: 999,
                border: `1px solid ${on ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-default-border)'}`,
                background: on ? 'var(--mantine-color-dark-8)' : undefined,
                color: on ? 'white' : undefined,
              }}
            >
              <Text size="md" fw={500} span>
                {label}{' '}
                <Text span fw={700}>
                  {stageCount(v)}
                </Text>
              </Text>
            </UnstyledButton>
          );
        })}
      </Group>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput style={{ flex: 1, minWidth: 200 }} size="md" radius="xl" placeholder="Search a name" aria-label="Search households" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <Select
          size="md"
          label="I am"
          w={140}
          allowDeselect={false}
          data={OWNERS.map((o) => ({ value: o, label: OWNER_LABEL[o] }))}
          value={sender}
          onChange={(v) => v && setSender(v as Owner)}
        />
      </Group>

      {visible.length === 0 ? (
        <EmptyState emoji="📭" title="Nothing here" hint={stage === 'all' ? 'No households for this person yet.' : 'Try another filter.'} />
      ) : (
        <Stack gap="sm">
          {visible.map((g) => {
            const t = tracks[g.id];
            const hasPhone = (phonesOf.get(g.id) ?? []).length > 0;
            return (
              <Paper key={g.id} withBorder p="md" radius="lg" style={{ borderLeft: `5px solid var(--mantine-color-${t.needsReminder ? 'orange-6' : t.stage === 'replied' ? 'teal-6' : t.lastInvite ? 'blue-5' : 'gray-4'})` }}>
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                  <div style={{ minWidth: 0 }}>
                    <Text fz={20} fw={700} lh={1.2}>
                      {g.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {g.persons} {g.persons === 1 ? 'person' : 'people'}
                      {g.list_group ? ` · ${g.list_group}` : ''}
                    </Text>
                  </div>
                  {isUnlocked ? (
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <Badge size="lg" variant="light" style={{ cursor: 'pointer', flexShrink: 0 }} rightSection="▾">
                          {OWNER_LABEL[g.handled_by]}
                        </Badge>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Who handles this household</Menu.Label>
                        {OWNERS.map((o) => (
                          <Menu.Item key={o} disabled={o === g.handled_by} onClick={() => void reassign(g, o)}>
                            {OWNER_LABEL[o]}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  ) : (
                    <Badge size="lg" variant="light" style={{ flexShrink: 0 }}>
                      {OWNER_LABEL[g.handled_by]}
                    </Badge>
                  )}
                </Group>

                <Box mt="xs">
                  <StatusLine track={t} />
                </Box>
                <Box mt="xs">
                  <DayChips track={t} />
                </Box>

                <SimpleGrid cols={{ base: 1, xs: isUnlocked ? 3 : 2 }} spacing="xs" mt="md">
                  <Button size="lg" color="teal" variant={t.stage === 'replied' ? 'light' : 'filled'} onClick={() => setSending(g)}>
                    {t.stage === 'replied' ? 'Message again' : t.lastInvite ? 'Send reminder' : 'Send on WhatsApp'}
                  </Button>
                  <Button size="lg" variant="default" onClick={() => setMarking(g)}>
                    Mark sent
                  </Button>
                  {isUnlocked && (
                    <Button size="lg" variant="light" onClick={() => onAnswer(g.id)}>
                      Set answers
                    </Button>
                  )}
                </SimpleGrid>
                {!hasPhone && (
                  <Text size="xs" c="dimmed" mt={6}>
                    No phone number saved: WhatsApp will ask whom to send it to.
                  </Text>
                )}

                {t.sends.length > 0 && (
                  <Box component="details" mt="sm">
                    <Text component="summary" size="sm" c="dimmed" style={{ cursor: 'pointer' }}>
                      History ({t.sends.length})
                    </Text>
                    <Stack gap={4} mt={6}>
                      {t.sends.map((s) => (
                        <Group key={s.id} justify="space-between" wrap="nowrap" gap="xs">
                          <Text size="sm">
                            {shortDate(s.sent_at)} · {KIND_LABEL[s.kind]} · {CHANNEL_LABEL[s.channel]} · {OWNER_LABEL[s.sent_by]}
                            {s.note ? ` · ${s.note}` : ''}
                          </Text>
                          {isUnlocked && (
                            <Button size="compact-xs" variant="subtle" color="red" onClick={() => void removeSend(s, g)}>
                              Remove
                            </Button>
                          )}
                        </Group>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      {sending && (
        <SendModal
          key={sending.id}
          guest={sending}
          track={tracks[sending.id]}
          sender={sender}
          code={codeOf.get(sending.id) ?? null}
          takenCodes={codes.map((c) => c.code)}
          siteUrl={siteUrl}
          phones={phonesOf.get(sending.id) ?? []}
          onClose={() => setSending(null)}
          onSent={(kind) => void logSend(sending, { kind, channel: 'whatsapp' })}
          reloadCodes={reloadCodes}
        />
      )}
      {marking && (
        <MarkSentModal
          key={marking.id}
          guest={marking}
          sender={sender}
          defaultKind={tracks[marking.id].lastInvite ? 'reminder' : 'invite'}
          onClose={() => setMarking(null)}
          onSave={(row) => logSend(marking, row)}
        />
      )}
    </Stack>
  );
}

// The message to send, in English or Hindi, editable before WhatsApp opens. Opening WhatsApp records the send
// (Undo is offered straight away, in case it was not sent).
function SendModal({
  guest,
  track,
  sender,
  code,
  takenCodes,
  siteUrl,
  phones,
  onClose,
  onSent,
  reloadCodes,
}: {
  guest: TrackedGuest;
  track: HouseholdTrack;
  sender: Owner;
  code: string | null;
  takenCodes: string[];
  siteUrl: string | null;
  phones: GuestContact[];
  onClose: () => void;
  onSent: (kind: SendKind) => void;
  reloadCodes: () => Promise<void> | void;
}) {
  const kind: 'invite' | 'reminder' = track.lastInvite ? 'reminder' : 'invite';
  const [lang, setLangState] = useState<Lang>(() => (readLocal(LANG_KEY) === 'hi' ? 'hi' : 'en'));
  const [phone, setPhone] = useState<string | null>(phones[0]?.value ?? null);
  const [making, setMaking] = useState(false);
  const link = code && siteUrl ? inviteLink(code, siteUrl) : null;
  const make = (l: Lang, lk: string | null) => inviteMessage({ lang: l, kind, name: guest.name, days: track.days.map((d) => d.date), link: lk, sender });
  const [text, setText] = useState(() => make(lang, link));
  const setLang = (l: Lang) => {
    writeLocal(LANG_KEY, l);
    setLangState(l);
    setText(make(l, link));
  };

  async function makeLink() {
    setMaking(true);
    const taken = new Set(takenCodes);
    let c = makeCode();
    while (taken.has(c)) c = makeCode();
    const { error } = await supabase.from('invite_codes').upsert({ code: c, guest_id: guest.id, revoked_at: null }, { onConflict: 'guest_id' });
    setMaking(false);
    if (error) return fail('Could not make the link', error.message);
    await reloadCodes();
    if (siteUrl) setText(make(lang, inviteLink(c, siteUrl)));
  }

  function open() {
    window.open(whatsappSendUrl(phone, text), '_blank', 'noopener');
    onSent(kind);
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title={<Text fw={700} fz="lg">{kind === 'invite' ? 'Send invite' : 'Send reminder'}: {guest.name}</Text>} size="lg" fullScreen={window.innerWidth < 600}>
      <Stack>
        <SegmentedControl
          size="md"
          fullWidth
          value={lang}
          onChange={(v) => setLang(v as Lang)}
          data={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिंदी' },
          ]}
        />
        {phones.length > 1 && (
          <Select
            size="md"
            label="Send to"
            allowDeselect={false}
            data={phones.map((p) => ({ value: p.value, label: `${p.person}: ${p.value}` }))}
            value={phone}
            onChange={setPhone}
          />
        )}
        {phones.length === 1 && (
          <Text size="sm">
            To {phones[0].person}: {phones[0].value}
          </Text>
        )}
        {phones.length === 0 && (
          <Text size="sm" c="dimmed">
            No number saved. WhatsApp will open and ask whom to send it to.
          </Text>
        )}
        {!link && (
          <Alert color="yellow" variant="light">
            <Group justify="space-between" gap="xs">
              <Text size="sm">{siteUrl ? 'This household has no personal RSVP link yet.' : 'The invite site address is not set (Guests, Replies).'}</Text>
              {siteUrl && (
                <Button size="compact-md" variant="light" loading={making} onClick={() => void makeLink()}>
                  Make link
                </Button>
              )}
            </Group>
          </Alert>
        )}
        {!MESSAGE_APPROVED && (
          <Alert color="orange" variant="light" title="Wording not approved yet">
            <Text size="sm">Papa has not approved this message yet. Don't send it until he has, or change the text first.</Text>
          </Alert>
        )}
        <Textarea size="md" autosize minRows={8} value={text} onChange={(e) => setText(e.currentTarget.value)} aria-label="Message" />
        <Text size="xs" c="dimmed">
          WhatsApp opens with this message. You press send there. It is recorded here as sent by {OWNER_LABEL[sender]}; you can undo it straight after.
        </Text>
        <Button size="xl" color="teal" onClick={open}>
          Open WhatsApp
        </Button>
      </Stack>
    </Modal>
  );
}

const CHANNELS: SendChannel[] = ['call', 'in_person', 'card', 'whatsapp', 'other'];

// Record an invite given some other way: a call, a visit, a printed card. The date defaults to today.
function MarkSentModal({
  guest,
  sender,
  defaultKind,
  onClose,
  onSave,
}: {
  guest: TrackedGuest;
  sender: Owner;
  defaultKind: SendKind;
  onClose: () => void;
  onSave: (row: { kind: SendKind; channel: SendChannel; sent_at?: string; note?: string | null }) => Promise<void>;
}) {
  const [today] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [channel, setChannel] = useState<SendChannel>('call');
  const [kind, setKind] = useState<SendKind>(defaultKind);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    // Today keeps the exact time; an earlier day is recorded at noon India time.
    const sent_at = date === today ? undefined : new Date(`${date}T12:00:00+05:30`).toISOString();
    await onSave({ kind, channel, sent_at, note: note.trim() || null });
    setSaving(false);
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title={<Text fw={700} fz="lg">Mark sent: {guest.name}</Text>} size="md">
      <Stack>
        <Text size="sm" fw={600}>
          How?
        </Text>
        <SimpleGrid cols={2} spacing="xs">
          {CHANNELS.map((c) => (
            <Button key={c} size="lg" variant={channel === c ? 'filled' : 'default'} aria-pressed={channel === c} onClick={() => setChannel(c)}>
              {CHANNEL_LABEL[c]}
            </Button>
          ))}
        </SimpleGrid>
        <SegmentedControl
          size="md"
          fullWidth
          value={kind}
          onChange={(v) => setKind(v as SendKind)}
          data={(['invite', 'reminder', 'save_the_date'] as SendKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
        <TextInput size="md" type="date" label="When" value={date} max={today} onChange={(e) => setDate(e.currentTarget.value || today)} />
        <TextInput size="md" label="Note (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Text size="xs" c="dimmed">
          Recorded as sent by {OWNER_LABEL[sender]}.
        </Text>
        <Button size="lg" onClick={() => void save()} loading={saving}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
