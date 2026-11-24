// The checks behind the invite-rsvp function. No imports, so the web test suite can run them.

export const CODE = /^[A-HJ-NP-Z2-9]{6,10}$/;
export const PER_IP = 60; // calls an hour
export const PER_CODE = 20;
export const MAX_PEOPLE = 20;

export const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// A real calendar day as YYYY-MM-DD: 2027-02-31 does not pass.
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// The visitor's address for the hourly limit. cf-connecting-ip is set by the platform's proxy; x-forwarded-for can
// start with whatever the caller sent, so it is only the fallback, and then its last entry is the one a proxy added.
export function clientIp(headers: { get(name: string): string | null }) {
  const direct = headers.get('cf-connecting-ip')?.trim();
  if (direct) return direct;
  const chain = (headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - 1] ?? 'unknown';
}

export type Reply = {
  responder_name: string;
  answers: Record<string, { answer: 'yes' | 'maybe' | 'no'; people: number }>;
  arrive_on: string | null;
  leave_on: string | null;
  travel: string | null;
  note: string | null;
  needs_room: boolean | null; // asked only when askRoom; null otherwise
  room_share: boolean | null; // asked only of a guest coming alone who needs a room
};

const nextDay = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);

// The room answer of a household that is asked (Pranjal's friends). The nights must be days they are coming and follow
// one another; they become arrive_on (first night) and leave_on (the morning after the last night).
function roomAnswer(room: unknown, answers: Reply['answers']) {
  const coming = Object.keys(answers).filter((d) => answers[d].answer !== 'no').sort();
  if (coming.length === 0) return { needs_room: null, room_share: null, arrive_on: null, leave_on: null };
  const r = isObject(room) ? room : {};
  if (r.need === 'no') return { needs_room: false, room_share: null, arrive_on: null, leave_on: null };
  if (r.need !== 'yes') return { error: 'Please tell us if you need a room.' };
  const nights = [...new Set((Array.isArray(r.nights) ? r.nights : []).filter((d): d is string => isDay(d) && coming.includes(d)))].sort();
  if (nights.length === 0) return { error: 'Please pick the nights you need a room.' };
  for (let i = 1; i < nights.length; i++) if (nights[i] !== nextDay(nights[i - 1])) return { error: 'Please pick nights that follow one another.' };
  const alone = coming.every((d) => answers[d].people === 1);
  return { needs_room: true, room_share: alone ? r.share === true : null, arrive_on: nights[0], leave_on: nextDay(nights[nights.length - 1]) };
}

// Checks a submitted form against the days the household is invited to. Only those days are kept.
export function checkReply(
  body: Record<string, unknown>,
  days: string[],
  opts: { askRoom?: boolean } = {},
): { reply: Reply } | { error: string } {
  const name = text(body.name, 80);
  if (!name) return { error: 'Please tell us your name.' };
  if (days.length === 0) return { error: 'We could not find your invitation days. Please tell a family member.' };

  const sent = isObject(body.days) ? body.days : {};
  const answers: Reply['answers'] = {};
  for (const day of days) {
    const a = sent[day];
    if (!isObject(a) || (a.answer !== 'yes' && a.answer !== 'maybe' && a.answer !== 'no')) return { error: 'Please answer for each day.' };
    const people = a.answer === 'no' ? 0 : Number(a.people);
    if (!Number.isInteger(people) || people < 0 || people > MAX_PEOPLE) return { error: 'Please check how many people are coming.' };
    if (a.answer !== 'no' && people === 0) return { error: 'Please tell us how many people are coming.' };
    answers[day] = { answer: a.answer, people };
  }

  const base = { responder_name: name, answers, travel: text(body.travel, 120) || null, note: text(body.note, 300) || null };
  // A form without the room question (an older copy of the site) answers with dates, as everyone else does.
  if (opts.askRoom && body.room !== undefined) {
    const room = roomAnswer(body.room, answers);
    if ('error' in room) return { error: room.error as string };
    return { reply: { ...base, ...room } };
  }

  const arrive = isDay(body.arrive_on) ? body.arrive_on : null;
  const leave = isDay(body.leave_on) ? body.leave_on : null;
  if (!arrive !== !leave) return { error: 'Please pick both the arriving and the leaving day, or neither.' };
  if (arrive && leave && leave <= arrive) return { error: 'The leaving day has to be after the arriving day.' };

  return { reply: { ...base, arrive_on: arrive, leave_on: leave, needs_room: null, room_share: null } };
}
