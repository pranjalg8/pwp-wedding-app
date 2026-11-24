// Invite replies: the codes in personal links, and what a reply would change on the guest list once applied.

// No 0/O, 1/I: a code read out over the phone or typed from a card should not be mistaken.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6,10}$/;

export function makeCode(length = 8, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(length);
  // 256 is a multiple of 32, so taking the low 5 bits keeps every letter equally likely.
  return [...bytes].map((b) => CODE_ALPHABET[b & 31]).join('');
}

// The personal link: the invite site's address (invite_settings.site_url) with the code.
export function inviteLink(code: string, base: string) {
  const u = new URL(base);
  u.searchParams.set('code', code);
  return u.toString();
}

export type Answer = 'yes' | 'maybe' | 'no';
export type ReplyStatus = 'new' | 'applied' | 'dismissed';

export type InviteReply = {
  id: string;
  guest_id: string;
  code: string;
  responder_name: string;
  answers: Record<string, { answer: Answer; people: number }>;
  arrive_on: string | null;
  leave_on: string | null;
  travel: string | null;
  note: string | null;
  needs_room: boolean | null; // asked of Pranjal's friends only; null = not asked
  room_share: boolean | null; // coming alone and happy to share a room
  status: ReplyStatus;
  reviewed_at: string | null;
  submitted_at: string;
};

export type InviteCode = { code: string; guest_id: string; revoked_at: string | null };

export type RsvpCounts = { event_date: string; coming: number; maybe: number; declined: number };

// What applying a reply writes for each day the household is invited to. "yes" with n people: n coming and the rest
// of the household not coming. "maybe" with n: n maybe, the rest left as no reply. "no": everyone not coming. A
// number bigger than the household is capped at its size and flagged, so the couple can fix the size first. Days the
// household is not invited to are left out and listed, never added.
export function replyPlan(reply: Pick<InviteReply, 'answers'>, persons: number, invitedDays: string[]) {
  const rows: RsvpCounts[] = [];
  const ignored: string[] = [];
  let overSize = false;
  for (const [day, a] of Object.entries(reply.answers).sort(([x], [y]) => x.localeCompare(y))) {
    if (!invitedDays.includes(day)) {
      ignored.push(day);
      continue;
    }
    const people = Math.max(0, Math.round(Number(a.people) || 0));
    if (a.answer !== 'no' && people > persons) overSize = true;
    const n = Math.min(people, persons);
    if (a.answer === 'yes') rows.push({ event_date: day, coming: n, maybe: 0, declined: persons - n });
    else if (a.answer === 'maybe') rows.push({ event_date: day, coming: 0, maybe: n, declined: 0 });
    else rows.push({ event_date: day, coming: 0, maybe: 0, declined: persons });
  }
  return { rows, ignored, overSize };
}

// The newest reply of each household still waiting for review. Older new replies from the same household are
// superseded: applying the newest one is what the household meant last.
export function latestNew(replies: InviteReply[]) {
  const byGuest = new Map<string, InviteReply>();
  for (const r of replies) {
    if (r.status !== 'new') continue;
    const cur = byGuest.get(r.guest_id);
    if (!cur || r.submitted_at > cur.submitted_at) byGuest.set(r.guest_id, r);
  }
  return [...byGuest.values()].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

// Friends' answers to the room question, from each household's latest reply that was not dismissed. Nights run from
// arrive_on up to the night before leave_on; people per night come from that day's answer.
export type RoomTally = {
  asked: number; // households whose latest reply answers the room question
  no: number; // heading home
  nights: { night: string; households: number; people: number; sharers: number; rooms: number }[];
};

export function roomTally(replies: InviteReply[]): RoomTally {
  const latest = new Map<string, InviteReply>();
  for (const r of replies) {
    if (r.status === 'dismissed' || r.needs_room === null) continue;
    const cur = latest.get(r.guest_id);
    if (!cur || r.submitted_at > cur.submitted_at) latest.set(r.guest_id, r);
  }
  const byNight = new Map<string, { households: number; people: number; sharers: number; own: number }>();
  let no = 0;
  for (const r of latest.values()) {
    if (!r.needs_room) {
      no++;
      continue;
    }
    if (!r.arrive_on || !r.leave_on) continue;
    for (let d = r.arrive_on; d < r.leave_on; d = new Date(Date.parse(d + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)) {
      const n = byNight.get(d) ?? { households: 0, people: 0, sharers: 0, own: 0 };
      n.households++;
      n.people += r.answers[d]?.people ?? 0;
      if (r.room_share) n.sharers++;
      else n.own++;
      byNight.set(d, n);
    }
  }
  const nights = [...byNight.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([night, n]) => ({ night, households: n.households, people: n.people, sharers: n.sharers, rooms: n.own + Math.ceil(n.sharers / 2) }));
  return { asked: latest.size, no, nights };
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

// Household name, people and personal link, for sending the links out.
export function linksCsv(rows: { name: string; persons: number; code: string }[], base: string | null) {
  const head = ['Household', 'People', 'Code', 'Link'];
  return [head, ...rows.map((r) => [r.name, r.persons, r.code, base ? inviteLink(r.code, base) : ''])].map((row) => row.map(csvCell).join(',')).join('\n');
}
