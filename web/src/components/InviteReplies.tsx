import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { useProfile } from '../hooks/useProfile';
import type { InviteSettings } from '../hooks/useInviteReplies';
import type { Invite } from '../lib/rsvp';
import type { RoomStay } from '../lib/rooms';
import { inviteLink, latestNew, linksCsv, makeCode, replyPlan, type InviteCode, type InviteReply } from '../lib/replies';
import { confirmDanger } from '../lib/confirm';

type G = { id: string; name: string; persons: number };

const dayLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const when = (t: string) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const nowIso = () => new Date().toISOString();
const ANSWER: Record<string, string> = { yes: 'Coming', maybe: 'Not sure', no: "Can't come" };

function fail(title: string, message: string) {
  notifications.show({ color: 'red', title, message });
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Replies from the invite site's personal links. Each reply is kept as sent; the couple applies it (it then sets the
// household's answers, and its room dates when it is in a room) or dismisses it. Nothing changes until Apply.
export function InviteReplies({
  guests,
  invites,
  roomStays,
  codes,
  replies,
  settings,
  reload,
  onApplied,
}: {
  guests: G[];
  invites: Invite[];
  roomStays: RoomStay[];
  codes: InviteCode[];
  replies: InviteReply[];
  settings: InviteSettings;
  reload: () => Promise<void>;
  onApplied: () => void;
}) {
  const { isUnlocked } = useEditMode();
  const { profile } = useProfile();
  const [site, setSite] = useState(settings.site_url ?? '');
  const [busy, setBusy] = useState(false);

  const guestById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const daysOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of invites) m.set(i.guest_id, [...(m.get(i.guest_id) ?? []), i.event_date].sort());
    return m;
  }, [invites]);
  const toReview = useMemo(() => latestNew(replies), [replies]);
  const codeOf = useMemo(() => new Map(codes.filter((c) => !c.revoked_at).map((c) => [c.guest_id, c.code])), [codes]);
  const invited = guests.filter((g) => daysOf.has(g.id));
  const withoutCode = invited.filter((g) => !codeOf.has(g.id));
  const siteOk = /^https:\/\/\S+$/.test(settings.site_url ?? '');

  async function setOpen(open: boolean) {
    const ok = await confirmDanger(
      open
        ? {
            title: 'Open replies?',
            message: 'Anyone with a personal link can then send an answer for that household. Replies still wait here for you to apply them.',
            confirmLabel: 'Open replies',
            confirmColor: 'teal',
          }
        : {
            title: 'Close replies?',
            message: 'Personal links will say replies are closed. Replies already in stay here.',
            confirmLabel: 'Close replies',
          },
    );
    if (!ok) return;
    const { error } = await supabase.from('invite_settings').update({ open }).eq('id', true);
    if (error) return fail('Could not change', error.message);
    await reload();
  }

  async function saveSite() {
    const v = site.trim();
    if (v && !/^https:\/\/\S+$/.test(v)) return fail('Check the address', 'It should start with https://');
    const { error } = await supabase.from('invite_settings').update({ site_url: v || null }).eq('id', true);
    if (error) return fail('Could not save', error.message);
    await reload();
  }

  async function makeCodes() {
    if (withoutCode.length === 0) return;
    setBusy(true);
    const taken = new Set(codes.map((c) => c.code));
    const rows = withoutCode.map((g) => {
      let code = makeCode();
      while (taken.has(code)) code = makeCode();
      taken.add(code);
      return { code, guest_id: g.id };
    });
    // A household may have a revoked code: replace it rather than add a second row (guest_id is unique).
    const { error } = await supabase.from('invite_codes').upsert(rows.map((r) => ({ ...r, revoked_at: null })), { onConflict: 'guest_id' });
    setBusy(false);
    if (error) return fail('Could not make codes', error.message);
    notifications.show({ color: 'teal', title: 'Codes made', message: `${rows.length} personal link${rows.length === 1 ? '' : 's'} ready.` });
    await reload();
  }

  async function revoke(g: G) {
    const ok = await confirmDanger({
      title: `Turn off ${g.name}'s link?`,
      message: 'Their personal link stops working straight away. Make codes again to give them a new one.',
      confirmLabel: 'Turn off link',
    });
    if (!ok) return;
    const { error } = await supabase.from('invite_codes').update({ revoked_at: nowIso() }).eq('guest_id', g.id);
    if (error) return fail('Could not revoke', error.message);
    await reload();
  }

  async function copy(code: string) {
    if (!settings.site_url) return;
    await navigator.clipboard.writeText(inviteLink(code, settings.site_url));
    notifications.show({ color: 'teal', message: 'Link copied' });
  }

  async function review(r: InviteReply, status: 'applied' | 'dismissed') {
    const stamp = { reviewed_at: nowIso(), reviewed_by: profile?.id ?? null };
    const { error } = await supabase.from('invite_responses').update({ status, ...stamp }).eq('id', r.id);
    if (error) throw new Error(error.message);
    // Older replies from the same household waiting for review are superseded by this one.
    const older = replies.filter((x) => x.guest_id === r.guest_id && x.status === 'new' && x.id !== r.id).map((x) => x.id);
    if (older.length > 0) {
      const { error: e2 } = await supabase.from('invite_responses').update({ status: 'dismissed', ...stamp }).in('id', older);
      if (e2) throw new Error(e2.message);
    }
  }

  async function apply(r: InviteReply) {
    const g = guestById.get(r.guest_id);
    if (!g) return;
    const plan = replyPlan(r, g.persons, daysOf.get(r.guest_id) ?? []);
    setBusy(true);
    try {
      for (const row of plan.rows) {
        const { error } = await supabase
          .from('guest_rsvps')
          .update({ coming: row.coming, maybe: row.maybe, declined: row.declined })
          .eq('guest_id', r.guest_id)
          .eq('event_date', row.event_date);
        if (error) throw new Error(error.message);
      }
      const mine = roomStays.filter((s) => s.guest_id === r.guest_id);
      if (r.arrive_on && r.leave_on) {
        // Kept on the household, so the dates apply whenever it is placed. Stays with their own dates follow them.
        const { error } = await supabase.from('guests').update({ arrive_on: r.arrive_on, leave_on: r.leave_on }).eq('id', r.guest_id);
        if (error) throw new Error(error.message);
        const dated = mine.filter((s) => s.check_in);
        if (dated.length > 0) {
          const { error: e2 } = await supabase.from('room_stays').update({ check_in: r.arrive_on, check_out: r.leave_on }).in('id', dated.map((s) => s.id));
          if (e2) throw new Error(e2.message);
        }
      }
      const nobodyComing = plan.rows.length > 0 && plan.rows.every((x) => x.coming + x.maybe === 0);
      if (
        nobodyComing &&
        mine.length > 0 &&
        (await confirmDanger({
          title: `Free ${g.name}'s ${mine.length === 1 ? 'room' : 'rooms'}?`,
          message: `${g.name} can't come. Free the ${mine.length === 1 ? 'room' : `${mine.length} rooms`} held for them so others can use ${mine.length === 1 ? 'it' : 'them'}?`,
          confirmLabel: mine.length === 1 ? 'Free room' : 'Free rooms',
          cancelLabel: 'Keep held',
        }))
      ) {
        const { error } = await supabase.from('room_stays').delete().in('id', mine.map((s) => s.id));
        if (error) throw new Error(error.message);
      }
      await review(r, 'applied');
      notifications.show({ color: 'teal', title: 'Reply applied', message: `${g.name}: answers updated${r.arrive_on && r.leave_on ? ', stay dates saved' : ''}.` });
      onApplied();
    } catch (e) {
      fail('Could not apply', (e as Error).message);
    } finally {
      setBusy(false);
      await reload();
    }
  }

  async function dismiss(r: InviteReply) {
    try {
      await review(r, 'dismissed');
    } catch (e) {
      fail('Could not dismiss', (e as Error).message);
    }
    await reload();
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <div>
              <Text fw={600}>Replies from the invite site are {settings.open ? 'open' : 'closed'}</Text>
              <Text size="sm" c="dimmed">
                {settings.open
                  ? 'Households can answer from their personal link. Each reply waits below until you apply it.'
                  : 'Personal links say replies are not open yet. Nothing can be sent until you open them.'}
              </Text>
            </div>
            {isUnlocked && <Switch checked={settings.open} onChange={(e) => void setOpen(e.currentTarget.checked)} label={settings.open ? 'Open' : 'Closed'} aria-label="Replies open" />}
          </Group>
          {isUnlocked && (
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                size="xs"
                label="Invite site address"
                description="Where the invite site is published; personal links are built from it."
                placeholder="https://…"
                value={site}
                onChange={(e) => setSite(e.currentTarget.value)}
              />
              <Button size="xs" variant="light" onClick={() => void saveSite()} disabled={site.trim() === (settings.site_url ?? '')}>
                Save
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      <Stack gap="sm">
        <Title order={4}>To review {toReview.length > 0 && <Badge ml={4}>{toReview.length}</Badge>}</Title>
        {toReview.length === 0 && (
          <Text size="sm" c="dimmed">
            No replies waiting.
          </Text>
        )}
        {toReview.map((r) => {
          const g = guestById.get(r.guest_id);
          const days = daysOf.get(r.guest_id) ?? [];
          const plan = replyPlan(r, g?.persons ?? 0, days);
          const older = replies.filter((x) => x.guest_id === r.guest_id && x.status === 'new' && x.id !== r.id).length;
          const placed = roomStays.some((s) => s.guest_id === r.guest_id);
          return (
            <Paper key={r.id} withBorder p="sm" radius="md">
              <Stack gap={6}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {g?.name ?? 'A household no longer on the list'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      From {r.responder_name} · {when(r.submitted_at)}
                      {older > 0 ? ` · replaces ${older} earlier repl${older === 1 ? 'y' : 'ies'}` : ''}
                    </Text>
                  </div>
                  {isUnlocked && g && (
                    <Group gap={6} wrap="nowrap">
                      <Button size="compact-sm" onClick={() => void apply(r)} loading={busy}>
                        Apply
                      </Button>
                      <Button size="compact-sm" variant="subtle" color="gray" onClick={() => void dismiss(r)}>
                        Dismiss
                      </Button>
                    </Group>
                  )}
                </Group>
                {Object.entries(r.answers)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([day, a]) => {
                    const now = invites.find((i) => i.guest_id === r.guest_id && i.event_date === day);
                    return (
                      <Text key={day} size="sm">
                        <b>{dayLabel(day)}:</b> {ANSWER[a.answer] ?? a.answer}
                        {a.answer !== 'no' ? `, ${a.people} ${a.people === 1 ? 'person' : 'people'}` : ''}
                        {now ? (
                          <Text span size="xs" c="dimmed">
                            {' '}
                            (now {now.coming} yes, {now.maybe} maybe, {now.declined} no)
                          </Text>
                        ) : null}
                      </Text>
                    );
                  })}
                {(r.arrive_on || r.leave_on || r.travel) && (
                  <Text size="sm">
                    <b>Stay:</b> {r.arrive_on ? `arriving ${dayLabel(r.arrive_on)}` : ''}
                    {r.arrive_on && r.leave_on ? ', ' : ''}
                    {r.leave_on ? `leaving ${dayLabel(r.leave_on)}` : ''}
                    {r.travel ? `${r.arrive_on || r.leave_on ? ' · ' : ''}${r.travel}` : ''}
                    {r.arrive_on && r.leave_on ? (
                      <Text span size="xs" c="dimmed">
                        {placed ? ' (Apply updates their room dates)' : ' (Apply saves these for when they get a room)'}
                      </Text>
                    ) : null}
                  </Text>
                )}
                {r.note && (
                  <Text size="sm">
                    <b>Note:</b> {r.note}
                  </Text>
                )}
                {(plan.overSize || plan.ignored.length > 0) && (
                  <Alert color="orange" variant="light" p="xs">
                    <Text size="xs">
                      {plan.overSize ? `They say more people than the ${g?.persons ?? 0} on the list; Apply caps it, so change the household size first if they are right. ` : ''}
                      {plan.ignored.length > 0 ? `Not invited on ${plan.ignored.map(dayLabel).join(', ')}, so that answer is not applied.` : ''}
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Title order={4}>Personal links</Title>
          <Group gap="xs">
            {isUnlocked && withoutCode.length > 0 && (
              <Button size="compact-md" onClick={() => void makeCodes()} loading={busy}>
                Make codes for {withoutCode.length} household{withoutCode.length === 1 ? '' : 's'}
              </Button>
            )}
            {codeOf.size > 0 && (
              <Button
                size="compact-md"
                variant="light"
                onClick={() =>
                  download(
                    'personal-links.csv',
                    linksCsv(
                      invited.filter((g) => codeOf.has(g.id)).map((g) => ({ name: g.name, persons: g.persons, code: codeOf.get(g.id)! })),
                      siteOk ? settings.site_url : null
                    )
                  )
                }
              >
                Download links
              </Button>
            )}
          </Group>
        </Group>
        <Text size="sm" c="dimmed">
          {invited.length} invited household{invited.length === 1 ? '' : 's'}, {invited.length - withoutCode.length} with a link.
          {!siteOk ? ' Add the invite site address above to copy full links; until then only the codes are shown.' : ''}
        </Text>
        {codeOf.size > 0 && (
          <Table.ScrollContainer minWidth={420}>
            <Table striped verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Household</Table.Th>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Reply</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invited
                  .filter((g) => codeOf.has(g.id))
                  .map((g) => {
                    const last = replies.find((r) => r.guest_id === g.id);
                    return (
                      <Table.Tr key={g.id}>
                        <Table.Td>{g.name}</Table.Td>
                        <Table.Td ff="monospace">{codeOf.get(g.id)}</Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {last ? `${last.status === 'new' ? 'To review' : last.status === 'applied' ? 'Applied' : 'Dismissed'} · ${when(last.submitted_at)}` : 'None yet'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            {siteOk && (
                              <Button size="compact-xs" variant="subtle" onClick={() => void copy(codeOf.get(g.id)!)}>
                                Copy link
                              </Button>
                            )}
                            {isUnlocked && (
                              <Button size="compact-xs" variant="subtle" color="red" onClick={() => void revoke(g)}>
                                Revoke
                              </Button>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Stack>
  );
}
