import { useState } from 'react';
import { useRealtime } from '../hooks/useRealtime';
import { Link } from 'react-router-dom';
import { Button, Divider, Group, Modal, Select, SimpleGrid, Stack, Switch, Text, TagsInput, Textarea, TextInput } from '@mantine/core';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadError, PageSkeleton } from '../components/PageSkeleton';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useEditMode } from '../hooks/useEditMode';
import { useGuestInvites } from '../hooks/useGuestInvites';
import { FunctionCard, type OutfitOption, type WeddingFunction } from '../components/FunctionCard';
import { FUNCTION_STATUS_LABEL, tintFor } from '../lib/schedule';
import { MealsPlan } from '../components/MealsPlan';

export type Site = { id: string; name: string };
const OTHER = 'other';
const toTime = (t: string | null) => (t ? t.slice(0, 5) : '');

const STATUS_LABEL = FUNCTION_STATUS_LABEL;

function Editor({ fn, sites, onClose, onSaved }: { fn: WeddingFunction; sites: Site[]; onClose: () => void; onSaved: () => void }) {
  const [theme, setTheme] = useState(fn.theme ?? '');
  const [colours, setColours] = useState(fn.colours);
  const [avoid, setAvoid] = useState(fn.avoid_colours);
  const [notes, setNotes] = useState(fn.notes ?? '');
  const [status, setStatus] = useState<string>(fn.status);
  const [start, setStart] = useState(toTime(fn.start_time));
  const [end, setEnd] = useState(toTime(fn.end_time));
  const [showTime, setShowTime] = useState(fn.show_time);
  const [venue, setVenue] = useState<string>(fn.venue_site_id ?? (fn.venue_text ? OTHER : ''));
  const [venueText, setVenueText] = useState(fn.venue_text ?? '');
  const [inviteName, setInviteName] = useState(fn.invite_name ?? '');
  const [invitePart, setInvitePart] = useState(fn.invite_part ?? '');
  const [blurb, setBlurb] = useState(fn.invite_blurb ?? '');
  const [dress, setDress] = useState(fn.dress ?? '');
  const [saving, setSaving] = useState(false);
  const timeProblem = end && !start ? 'Add a start time first' : start && end && end <= start && end !== '00:00' ? 'Ends before it starts' : null;

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('wedding_functions')
      .update({
        theme: theme || null,
        colours,
        avoid_colours: avoid,
        notes: notes || null,
        status,
        start_time: start || null,
        end_time: (start && end) || null,
        show_time: Boolean(start) && showTime,
        venue_site_id: venue && venue !== OTHER ? venue : null,
        venue_text: venue === OTHER ? venueText.trim() || null : null,
        invite_name: inviteName.trim() || null,
        invite_part: invitePart.trim() || null,
        invite_blurb: blurb.trim() || null,
        dress: dress.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fn.id);
    setSaving(false);
    if (error) {
      notifications.show({ color: 'red', title: 'Could not save', message: error.message });
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title={fn.name} centered>
      <Stack>
        <TextInput label="Theme" value={theme} onChange={(e) => setTheme(e.currentTarget.value)} />
        <TagsInput label="Colours we want" description="Press Enter after each colour" value={colours} onChange={setColours} />
        <TagsInput label="Colours to avoid" value={avoid} onChange={setAvoid} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} minRows={3} />
        <Select
          label="Status"
          data={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          value={status}
          onChange={(v) => v && setStatus(v)}
          allowDeselect={false}
        />
        <Divider label="When and where" labelPosition="left" />
        <Group grow align="flex-start">
          <TextInput type="time" label="Starts" value={start} onChange={(e) => setStart(e.currentTarget.value)} />
          <TextInput type="time" label="Ends" value={end} onChange={(e) => setEnd(e.currentTarget.value)} error={timeProblem} />
        </Group>
        <Select
          label="Venue"
          placeholder="Not set"
          data={[...sites.map((s) => ({ value: s.id, label: s.name })), { value: OTHER, label: 'Somewhere else' }]}
          value={venue || null}
          onChange={(v) => setVenue(v ?? '')}
          clearable
        />
        {venue === OTHER && <TextInput label="Where" placeholder="The bride's home" value={venueText} onChange={(e) => setVenueText(e.currentTarget.value)} maxLength={120} />}
        {!fn.family_only && (
          <>
            <Divider label="On the invite site" labelPosition="left" />
            <Switch
              label="Show the time on the invite"
              description={start ? 'Leave off while the time is still being discussed.' : 'Add a start time first.'}
              checked={Boolean(start) && showTime}
              disabled={!start}
              onChange={(e) => setShowTime(e.currentTarget.checked)}
            />
            <TextInput label="Name guests see" placeholder={fn.name} value={inviteName} onChange={(e) => setInviteName(e.currentTarget.value)} maxLength={80} />
            <TextInput label="Part of the day" description="Shown while the time is off the invite" placeholder={fn.slot === 'first_half' ? 'Daytime' : 'Evening'} value={invitePart} onChange={(e) => setInvitePart(e.currentTarget.value)} maxLength={40} />
            <Textarea label="Short line" value={blurb} onChange={(e) => setBlurb(e.currentTarget.value)} maxLength={300} autosize minRows={2} />
            <TextInput label="Dress code" value={dress} onChange={(e) => setDress(e.currentTarget.value)} maxLength={120} />
          </>
        )}
        <Button onClick={save} loading={saving} disabled={Boolean(timeProblem)}>Save</Button>
      </Stack>
    </Modal>
  );
}

export function Functions() {
  const { isUnlocked } = useEditMode();
  const { totals } = useGuestInvites();
  const [rows, setRows] = useState<WeddingFunction[]>([]);
  const [outfits, setOutfits] = useState<OutfitOption[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [editing, setEditing] = useState<WeddingFunction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    const [fns, opts, siteRows] = await Promise.all([
      supabase.from('wedding_functions').select('*').order('sort_order'),
      supabase.from('task_options').select('name, status, tasks!inner(title)').ilike('tasks.title', 'Groom outfits%'),
      supabase.from('stay_sites').select('id, name').order('sort_order'),
    ]);
    // A failed load must not look like "no functions": keep what is on screen and say so.
    setLoadError(fns.error?.message ?? null);
    if (fns.error) return;
    setRows((fns.data ?? []) as WeddingFunction[]);
    setOutfits(((opts.data ?? []) as OutfitOption[]).map((o) => ({ name: o.name, status: o.status })));
    setSites((siteRows.data ?? []) as Site[]);
    setLoaded(true);
  }

  useRealtime(['wedding_functions'], load, { immediate: true });

  const days = [...new Set(rows.map((r) => r.event_date))];
  const venueOf = (r: WeddingFunction) => (r.venue_site_id ? sites.find((s) => s.id === r.venue_site_id)?.name : r.venue_text) ?? null;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Functions"
        action={
        <Group gap="xs">
          <Button component={Link} to="/functions/results" variant="light" color="rose" size="sm">Results</Button>
          <Button component={Link} to="/functions/swipe" color="rose" size="sm">Pick looks together</Button>
        </Group>
        }
      />
      {days.map((d) => (
        <Stack key={d} gap="sm">
          <Text fw={700} c="dimmed" tt="uppercase" size="sm">
            {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {rows.filter((r) => r.event_date === d).map((r) => (
              <FunctionCard
                key={r.id}
                fn={r}
                tint={tintFor(rows.indexOf(r))}
                outfits={outfits}
                detailed
                showRsvp={!r.family_only}
                rsvp={totals[r.event_date]}
                venue={venueOf(r)}
                onEdit={isUnlocked ? () => setEditing(r) : undefined}
              />
            ))}
          </SimpleGrid>
        </Stack>
      ))}
      {loadError && <LoadError message={loadError} onRetry={() => void load()} />}
      {!loaded && !loadError && <PageSkeleton cards={3} />}
      {loaded && !loadError && rows.length === 0 && (
        <EmptyState emoji="🪔" title="No functions yet" hint="Once the wedding events are set up, each one shows here with its date, venue and RSVPs." />
      )}
      {loaded && <MealsPlan sites={sites} />}
      {isUnlocked && editing && <Editor key={editing.id} fn={editing} sites={sites} onClose={() => setEditing(null)} onSaved={load} />}
    </Stack>
  );
}
