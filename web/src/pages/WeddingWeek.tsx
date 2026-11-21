import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, NumberInput, Paper, SegmentedControl, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadError, PageSkeleton } from '../components/PageSkeleton';
import { EditButton } from '../components/EditButton';
import { useProfile } from '../hooks/useProfile';
import { useRealtime } from '../hooks/useRealtime';
import { fetchAll } from '../lib/fetchAll';
import { firstError } from '../lib/loadState';
import { arrivalsByDay, type TransportGuest } from '../lib/transport';
import { enqueue, flush, loadQueue, saveQueue, type CheckinWrite } from '../lib/checkinQueue';

type Tab = 'transport' | 'checkin' | 'photos';
type Fn = { id: string; name: string; event_date: string; family_only: boolean; sort_order: number };
type Rsvp = { guest_id: string; event_date: string; coming: number };
type Checkin = { guest_id: string; event_date: string; people: number };

const dayLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function WeddingWeek() {
  const [tab, setTab] = useState<Tab>('transport');
  const [guests, setGuests] = useState<(TransportGuest & { arrive_on: string | null })[]>([]);
  const [travel, setTravel] = useState<{ guest_id: string; travel: string | null }[]>([]);
  const [fns, setFns] = useState<Fn[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [album, setAlbum] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    const [g, t, f, r, c, s] = await Promise.all([
      fetchAll((from, to) => supabase.from('guests').select('id, name, persons, needs_lift, arrive_on').order('id').range(from, to)),
      supabase.from('invite_responses').select('guest_id, travel, submitted_at').neq('status', 'dismissed').not('travel', 'is', null).order('submitted_at', { ascending: false }),
      supabase.from('wedding_functions').select('id, name, event_date, family_only, sort_order').order('sort_order'),
      fetchAll((from, to) => supabase.from('guest_rsvps').select('guest_id, event_date, coming').gt('coming', 0).order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('guest_checkins').select('guest_id, event_date, people').order('id').range(from, to)),
      supabase.from('invite_settings').select('photo_album_url').maybeSingle(),
    ]);
    if (!isActive()) return;
    const failed = firstError(g, t, f, r, c, s);
    setLoadError(failed);
    setLoaded(true);
    if (failed) return;
    setGuests((g.data ?? []) as TransportGuest[]);
    // newest first, so the first note seen for a household is its latest
    const seen = new Set<string>();
    setTravel(((t.data ?? []) as { guest_id: string; travel: string | null }[]).filter((x) => (seen.has(x.guest_id) ? false : (seen.add(x.guest_id), true))));
    setFns((f.data ?? []) as Fn[]);
    setRsvps((r.data ?? []) as Rsvp[]);
    setCheckins((c.data ?? []) as Checkin[]);
    setAlbum((s.data as { photo_album_url: string | null } | null)?.photo_album_url ?? null);
  }, []);
  useRealtime(['guests', 'invite_responses', 'guest_rsvps', 'guest_checkins', 'invite_settings'], load, { immediate: true });

  return (
    <Stack gap="md">
      <PageHeader icon="🧳" title="Wedding week" subtitle="Arrivals, check-in at each function, and the photo album" />
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        data={[
          { value: 'transport', label: 'Transport' },
          { value: 'checkin', label: 'Check-in' },
          { value: 'photos', label: 'Photos' },
        ]}
      />
      {loadError && <LoadError message={loadError} onRetry={() => load(() => true)} />}
      {!loaded ? (
        <PageSkeleton cards={3} />
      ) : tab === 'transport' ? (
        <Transport guests={guests} travel={travel} />
      ) : tab === 'checkin' ? (
        <CheckIn guests={guests} fns={fns} rsvps={rsvps} checkins={checkins} setCheckins={setCheckins} />
      ) : (
        <Photos key={album ?? ''} album={album} />
      )}
    </Stack>
  );
}

function Transport({ guests, travel }: { guests: TransportGuest[]; travel: { guest_id: string; travel: string | null }[] }) {
  const [seats, setSeats] = useState<number | string>(4);
  const { days, undated } = arrivalsByDay(guests, travel, Number(seats) || 4);
  return (
    <Stack gap="md">
      <Group align="flex-end">
        <NumberInput label="People per vehicle" value={seats} onChange={setSeats} min={1} max={60} w={160} />
        <Text size="sm" c="dimmed" maw={420}>
          Vehicles are the people who asked for a lift on that day, divided by this number. It is an estimate, not a booking.
        </Text>
      </Group>
      {undated > 0 && (
        <Alert color="blue" variant="light">
          {undated} household{undated === 1 ? ' has' : 's have'} no arrival day yet. Arrival days come from invite replies once you apply them.
        </Alert>
      )}
      {days.length === 0 ? (
        <EmptyState emoji="🚗" title="No arrivals yet" hint="When households reply with their arrival day and you apply the reply, they are counted here by day." />
      ) : (
        days.map((d) => (
          <Paper key={d.date} withBorder p="md">
            <Group justify="space-between" mb="xs">
              <Title order={4}>{dayLabel(d.date)}</Title>
              <Group gap="xs">
                <Badge variant="light">{d.households.length} households, {d.people} people</Badge>
                {d.liftPeople > 0 && <Badge color="orange" variant="light">{d.liftPeople} need a lift, about {d.vehicles} vehicle{d.vehicles === 1 ? '' : 's'}</Badge>}
              </Group>
            </Group>
            <Stack gap={6}>
              {d.households.map((h) => (
                <Group key={h.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>{h.name} ({h.persons})</Text>
                    {h.travel && <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{h.travel}</Text>}
                  </div>
                  {h.needsLift && <Badge color="orange" variant="light" style={{ flexShrink: 0 }}>Lift</Badge>}
                </Group>
              ))}
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}

function CheckIn({ guests, fns, rsvps, checkins, setCheckins }: { guests: TransportGuest[]; fns: Fn[]; rsvps: Rsvp[]; checkins: Checkin[]; setCheckins: (c: Checkin[]) => void }) {
  const { profile } = useProfile();
  const days = fns.filter((f) => !f.family_only);
  const [fnId, setFnId] = useState<string | null>(null);
  const fn = days.find((f) => f.id === fnId) ?? days[0];
  const [queued, setQueued] = useState<CheckinWrite[]>(() => loadQueue());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [filter, setFilter] = useState('');
  const sending = useRef(false);
  const queueRef = useRef(queued);
  useEffect(() => {
    queueRef.current = queued;
  }, [queued]);

  const send = useCallback(
    async (w: CheckinWrite) => {
      const { error } = await supabase.from('guest_checkins').upsert({ ...w, checked_by: profile?.id ?? null, checked_at: new Date().toISOString() }, { onConflict: 'guest_id,event_date' });
      return !error;
    },
    [profile?.id],
  );

  const sync = useCallback(async () => {
    if (sending.current || queueRef.current.length === 0) return;
    sending.current = true;
    const batch = queueRef.current;
    const left = await flush(batch, send);
    // writes queued while sending stay; a batch entry that was replaced meanwhile is not put back
    const fresh = queueRef.current.filter((q) => !batch.includes(q));
    const next = [...left.filter((l) => !fresh.some((f) => f.guest_id === l.guest_id && f.event_date === l.event_date)), ...fresh];
    saveQueue(next);
    setQueued(next);
    sending.current = false;
  }, [send]);

  useEffect(() => {
    const up = () => { setOnline(true); void sync(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    void sync();
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [sync]);

  if (!fn) return <EmptyState emoji="🎉" title="No functions yet" hint="Functions with guests appear here." />;

  const date = fn.event_date;
  const arrived = new Map(checkins.filter((c) => c.event_date === date).map((c) => [c.guest_id, c.people]));
  const name = new Map(guests.map((g) => [g.id, g.name]));
  const expected = rsvps.filter((r) => r.event_date === date && name.has(r.guest_id)).map((r) => ({ id: r.guest_id, name: name.get(r.guest_id)!, coming: r.coming })).sort((a, b) => a.name.localeCompare(b.name));
  const shown = expected.filter((h) => h.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const inPeople = expected.reduce((s, h) => s + (arrived.get(h.id) ?? 0), 0);
  const allPeople = expected.reduce((s, h) => s + h.coming, 0);

  function toggle(id: string, people: number) {
    const w: CheckinWrite = { guest_id: id, event_date: date, people };
    setCheckins([...checkins.filter((c) => !(c.guest_id === id && c.event_date === date)), ...(people > 0 ? [w] : [{ ...w, people: 0 }])]);
    const next = enqueue(queueRef.current, w);
    saveQueue(next);
    setQueued(next);
    queueRef.current = next;
    void sync().then(() => {
      if (!navigator.onLine) notifications.show({ color: 'orange', message: 'No signal: saved on this phone and will sync when you are back online.' });
    });
  }

  return (
    <Stack gap="md">
      <FunctionPicker days={days} value={fn.id} onChange={setFnId} />
      <Group justify="space-between">
        <Text fw={700}>{inPeople} of {allPeople} people in</Text>
        {queued.length > 0 ? <Badge color="orange" variant="light">{queued.length} waiting to sync{online ? '' : ' (offline)'}</Badge> : <Badge color="teal" variant="light">All synced</Badge>}
      </Group>
      <TextInput placeholder="Find a household" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
      {expected.length === 0 ? (
        <EmptyState compact emoji="📋" title="Nobody is marked coming on this day" hint="Households whose RSVP says coming for this date are listed here." />
      ) : (
        <Stack gap={4}>
          {shown.map((h) => {
            const here = arrived.get(h.id) ?? 0;
            return (
              <Paper key={h.id} withBorder p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Checkbox size="md" checked={here > 0} onChange={(e) => toggle(h.id, e.currentTarget.checked ? h.coming : 0)} label={`${h.name} (${h.coming})`} styles={{ label: { overflowWrap: 'anywhere' } }} />
                  {here > 0 && (
                    <NumberInput size="xs" w={70} min={1} max={h.coming} value={here} onChange={(v) => Number(v) >= 1 && toggle(h.id, Math.min(h.coming, Number(v)))} aria-label="People who arrived" />
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function FunctionPicker({ days, value, onChange }: { days: Fn[]; value: string; onChange: (v: string) => void }) {
  return (
    <SegmentedControl
      fullWidth
      orientation="vertical"
      value={value}
      onChange={onChange}
      data={days.map((f) => ({ value: f.id, label: `${f.name} · ${dayLabel(f.event_date)}` }))}
    />
  );
}

function Photos({ album }: { album: string | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const [draft, setDraft] = useState(album ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!album) return;
    import('qrcode').then((m) => m.toDataURL(album, { width: 480, margin: 2 })).then((u) => alive && setQr(u)).catch(() => alive && setQr(null));
    return () => { alive = false; };
  }, [album]);

  async function save() {
    const url = draft.trim();
    if (url && !/^https:\/\/\S+$/.test(url)) {
      notifications.show({ color: 'red', title: 'Not a link', message: 'Paste the album link, starting with https://' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('invite_settings').update({ photo_album_url: url || null }).eq('id', true);
    setSaving(false);
    notifications.show(error ? { color: 'red', title: 'Not saved', message: error.message } : { color: 'teal', message: url ? 'Album link saved.' : 'Album link removed.' });
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Make one shared Google Photos or Drive album that anyone with the link can add to, then paste its link here. The QR code opens it, so guests can scan it at the venue. Print it or show it on a phone.
      </Text>
      <Group align="flex-end" wrap="nowrap">
        <TextInput style={{ flex: 1 }} label="Album link" placeholder="https://photos.app.goo.gl/..." value={draft} onChange={(e) => setDraft(e.currentTarget.value)} />
        <EditButton onClick={save} loading={saving}>Save</EditButton>
      </Group>
      {qr ? (
        <Paper withBorder p="md" style={{ textAlign: 'center' }}>
          <img src={qr} alt="QR code for the shared photo album" width={240} height={240} style={{ maxWidth: '100%', height: 'auto' }} />
          <Text size="sm" mt="xs">Scan to add and see photos from the wedding</Text>
        </Paper>
      ) : (
        <EmptyState compact emoji="📸" title="No album yet" hint="Paste the album link above and the QR code appears." />
      )}
      <Button variant="light" onClick={() => window.print()} disabled={!qr}>Print</Button>
    </Stack>
  );
}
