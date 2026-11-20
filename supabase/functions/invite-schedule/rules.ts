// The rules behind the invite-schedule function. No imports, so the web test suite can run them.

export type FunctionRow = {
  key: string;
  name: string;
  event_date: string;
  slot: 'first_half' | 'second_half';
  sort_order: number;
  family_only: boolean;
  start_time: string | null;
  end_time: string | null;
  show_time: boolean;
  venue_site_id: string | null;
  venue_text: string | null;
  invite_name: string | null;
  invite_part: string | null;
  invite_blurb: string | null;
  dress: string | null;
};
export type SiteRow = { id: string; name: string; maps_query: string | null; maps_url: string | null };

export type PublicVenue = { name: string; query: string; maps: string };
export type PublicFunction = {
  key: string;
  name: string;
  part: string;
  time: string | null; // "9:00 am" or "9:00 am to 1:00 pm"; only when show_time is on
  start: string | null; // "09:00", for calendar files
  end: string | null;
  venue: PublicVenue | null;
  blurb: string;
  dress: string;
};
export type PublicDay = { date: string; functions: PublicFunction[] };

const SLOT_PART = { first_half: 'Daytime', second_half: 'Evening' } as const;

// "09:00:00" -> "9:00 am", "21:30" -> "9:30 pm", "00:00" -> "12:00 am".
export function clock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

// Only guest functions, only the words meant for the invite, and a time only once it is switched on. Nothing else in
// the row (notes, status, themes being decided) ever leaves the planner.
export function publicSchedule(rows: FunctionRow[], sites: SiteRow[]): PublicDay[] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const byDay = new Map<string, PublicFunction[]>();
  const sorted = rows
    .filter((r) => !r.family_only)
    .slice()
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.sort_order - b.sort_order);
  for (const r of sorted) {
    const site = r.venue_site_id ? siteById.get(r.venue_site_id) : undefined;
    const venue: PublicVenue | null = site
      ? { name: site.name, query: site.maps_query || site.name, maps: site.maps_url || '' }
      : r.venue_text
        ? { name: r.venue_text, query: r.venue_text, maps: '' }
        : null;
    const timed = r.show_time && r.start_time;
    const time = timed ? (r.end_time ? `${clock(r.start_time!)} to ${clock(r.end_time)}` : clock(r.start_time!)) : null;
    const fn: PublicFunction = {
      key: r.key,
      name: r.invite_name || r.name,
      part: r.invite_part || SLOT_PART[r.slot],
      time,
      start: timed ? hhmm(r.start_time) : null,
      end: timed ? hhmm(r.end_time) : null,
      venue,
      blurb: r.invite_blurb || '',
      dress: r.dress || '',
    };
    byDay.set(r.event_date, [...(byDay.get(r.event_date) ?? []), fn]);
  }
  return [...byDay].map(([date, functions]) => ({ date, functions }));
}
