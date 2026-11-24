// Invite tracker: who handles each household, what has been sent, and who still needs a nudge. Pure functions, so
// the screen, the counters and the tests agree. Nothing here sends anything: WhatsApp opens with the text filled in
// and a person presses send.
import { inviteKind, splitOf, type Invite, type InviteKind, type RsvpDay } from './rsvp';
import type { InviteReply } from './replies';

export type Owner = 'pranjal' | 'papa' | 'puru';
export const OWNERS: Owner[] = ['pranjal', 'papa', 'puru'];
export const OWNER_LABEL: Record<Owner, string> = { pranjal: 'Pranjal', papa: 'Papa', puru: 'Puru' };

export type SendKind = 'save_the_date' | 'invite' | 'reminder';
export type SendChannel = 'whatsapp' | 'call' | 'in_person' | 'card' | 'other';
export const KIND_LABEL: Record<SendKind, string> = { save_the_date: 'Save the date', invite: 'Invite', reminder: 'Reminder' };
export const CHANNEL_LABEL: Record<SendChannel, string> = { whatsapp: 'WhatsApp', call: 'Phone call', in_person: 'In person', card: 'Card', other: 'Other' };

export type InviteSend = {
  id: string;
  guest_id: string;
  kind: SendKind;
  channel: SendChannel;
  sent_by: Owner;
  sent_by_uid: string | null;
  sent_at: string;
  note: string | null;
};

// A reminder is due this many days after the last invite or reminder, while someone still has not replied.
export const REMIND_AFTER_DAYS = 7;

// The default owner of a household, from its list group. The database applies the same rule on insert.
export function defaultOwner(listGroup: string | null): Owner {
  if (listGroup === 'Friends-Anjul') return 'pranjal';
  if (listGroup === 'Friends-Puru') return 'puru';
  return 'papa';
}

// Which of the three a signed-in profile is, by display name ("Papa" or "Dinesh" both mean Papa). Null for anyone
// else (Paridhi), who then sees everyone and picks who is sending.
export function ownerForProfile(displayName: string | null | undefined): Owner | null {
  const n = (displayName ?? '').trim().toLowerCase();
  if (n.startsWith('pranjal')) return 'pranjal';
  if (n.startsWith('papa') || n.startsWith('dinesh')) return 'papa';
  if (n.startsWith('puru')) return 'puru';
  return null;
}

// The name to greet: the first part of the household name, before " - ", "(" or "/" ("Preetu (Dr Nitish)" → "Preetu").
export function greetingName(householdName: string) {
  const first = householdName.split(/\s+-\s+|\(|\//)[0].trim();
  return first || householdName.trim();
}

export type Lang = 'en' | 'hi';

// Any invited day reads as words ("Saturday 13 Feb", "शनिवार 13 फ़रवरी"), never as a raw date. The weekday comes
// from the date itself, so 2027's weekdays are always right.
const EN_WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HI_WEEKDAY = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const EN_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HI_MONTH = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};
const enDay = (iso: string) => {
  const p = parts(iso);
  return `${EN_WEEKDAY[p.wd]} ${p.d} ${EN_MONTH[p.m - 1]}`;
};
const hiDay = (iso: string) => {
  const p = parts(iso);
  return `${HI_WEEKDAY[p.wd]} ${p.d} ${HI_MONTH[p.m - 1]}`;
};
const yearOf = (days: string[]) => parts(days[days.length - 1]).y;

// The invite and reminder texts below are our own wording, not yet approved by Papa. Until he approves them, the
// send screen says so; set this to true once he has.
export const MESSAGE_APPROVED = false;
const enJoin = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const hiJoin = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} और ${xs[xs.length - 1]}`);

export const SIGN_OFF: Record<Lang, Record<Owner, string>> = {
  en: { pranjal: 'Pranjal', papa: 'Dinesh Chandra Gupta & family', puru: 'Puru' },
  hi: { pranjal: 'प्रांजल', papa: 'दिनेश चंद्र गुप्ता एवं परिवार', puru: 'पुरु' },
};

// The WhatsApp text for an invite or a reminder, with the household's personal link when it has one. Only the days
// the household is invited to are named; no times are given (none are confirmed for guests).
export function inviteMessage({
  lang,
  kind,
  name,
  days,
  link,
  sender,
  weddingOnly = false,
}: {
  lang: Lang;
  kind: 'invite' | 'reminder';
  name: string;
  days: string[];
  link: string | null;
  sender: Owner;
  weddingOnly?: boolean; // invited to 15 Feb from the Baraat onwards
}) {
  const greet = greetingName(name);
  const sorted = [...days].sort();
  if (lang === 'hi') {
    const when = (sorted.length ? `${hiJoin(sorted.map(hiDay))} ${yearOf(sorted)}` : '14–15 फ़रवरी 2027') + (weddingOnly ? ' (बारात से)' : '');
    const ask = link ? `कृपया इस लिंक पर बताएं कि कौन-कौन आ रहा है:\n${link}` : 'कृपया बताएं कि कौन-कौन आ रहा है।';
    const lines =
      kind === 'invite'
        ? [`नमस्ते ${greet} जी 🙏`, `प्रांजल संग परिधि के शुभ विवाह में आप सपरिवार सादर आमंत्रित हैं।`, `${when}, रॉयल पेपर होटल्स एवं रिसॉर्ट्स, काठूवास (जयपुर–दिल्ली एक्सप्रेसवे)।`, ask]
        : [`नमस्ते ${greet} जी 🙏`, `प्रांजल संग परिधि के विवाह (${when}) के निमंत्रण का उत्तर अभी नहीं मिला है।`, ask];
    return [...lines, `— ${SIGN_OFF.hi[sender]}`, '#TwoPsInaPod'].join('\n\n');
  }
  const when = (sorted.length ? `${enJoin(sorted.map(enDay))} ${yearOf(sorted)}` : '14–15 Feb 2027') + (weddingOnly ? ' (the wedding, from the Baraat in the evening)' : '');
  const ask = link ? `Please let us know who is coming, here:\n${link}` : 'Please let us know who is coming.';
  const lines =
    kind === 'invite'
      ? [`Namaste ${greet} ji 🙏`, `With great joy we invite you and your family to Pranjal & Paridhi's wedding.`, `${when}, Royal Pepper Hotels & Resorts, Kathuwas (Jaipur–Delhi Expressway).`, ask]
      : [`Namaste ${greet} ji 🙏`, `A gentle reminder about Pranjal & Paridhi's wedding on ${when}. We haven't had your reply yet.`, ask];
  return [...lines, `— ${SIGN_OFF.en[sender]}`, '#TwoPsInaPod'].join('\n\n');
}

// wa.me with the text filled in. With no usable number WhatsApp opens its own "send to" picker.
export function whatsappSendUrl(phone: string | null | undefined, text: string) {
  let digits = (phone ?? '').replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  const to = digits.length >= 11 ? digits : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export type DayCounts = { date: string; coming: number; maybe: number; declined: number; noReply: number };
export type Stage = 'not_invited' | 'not_sent' | 'sent' | 'replied';

export type HouseholdTrack = {
  stage: Stage;
  lastInvite: InviteSend | null; // the latest invite or reminder
  lastAny: InviteSend | null;
  sends: InviteSend[]; // newest first
  days: DayCounts[]; // the days the household is invited to
  kind: InviteKind; // both days, 15 Feb whole day, or wedding only
  pendingReply: InviteReply | null; // a reply from the site still waiting for review
  needsReminder: boolean;
  daysSinceInvite: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Where one household stands. "Replied" means every invited person has an answer in the guest list, or a reply came
// in from the site (even one still waiting for review). A reminder is due once the last invite or reminder is
// REMIND_AFTER_DAYS old and they have not replied.
export function trackHousehold(
  guest: { id: string; persons: number },
  sends: InviteSend[],
  invites: Pick<Invite, 'guest_id' | 'event_date' | 'coming' | 'maybe' | 'declined' | 'part'>[],
  replies: InviteReply[],
  now: Date = new Date()
): HouseholdTrack {
  const mine = sends.filter((s) => s.guest_id === guest.id).sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  const lastInvite = mine.find((s) => s.kind === 'invite' || s.kind === 'reminder') ?? null;
  const rows = invites.filter((i) => i.guest_id === guest.id).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const days = rows.map((i) => ({ date: i.event_date, ...splitOf({ ...i, guests: { persons: guest.persons } }) }));
  const theirs = replies.filter((r) => r.guest_id === guest.id && r.status !== 'dismissed');
  const pendingReply = theirs.filter((r) => r.status === 'new').sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null;
  const allAnswered = days.length > 0 && days.every((d) => d.noReply === 0);
  const replied = allAnswered || theirs.length > 0;
  const stage: Stage = replied ? 'replied' : lastInvite ? 'sent' : days.length === 0 ? 'not_invited' : 'not_sent';
  const daysSinceInvite = lastInvite ? Math.floor((now.getTime() - new Date(lastInvite.sent_at).getTime()) / DAY_MS) : null;
  return {
    stage,
    lastInvite,
    lastAny: mine[0] ?? null,
    sends: mine,
    days,
    kind: inviteKind(rows),
    pendingReply,
    needsReminder: stage === 'sent' && daysSinceInvite !== null && daysSinceInvite >= REMIND_AFTER_DAYS,
    daysSinceInvite,
  };
}

export type OwnerCounts = {
  households: number;
  people: number;
  sent: number; // households with an invite or reminder sent
  replied: number;
  needsReminder: number;
  notSent: number;
  byDay: Record<string, { invited: number; coming: number; maybe: number; declined: number }>;
  cards: Record<'both' | 'day2' | 'wedding', number>; // households per printed card
};

const emptyCounts = (days: RsvpDay[]): OwnerCounts => ({
  households: 0,
  people: 0,
  sent: 0,
  replied: 0,
  needsReminder: 0,
  notSent: 0,
  byDay: Object.fromEntries(days.map((d) => [d.date, { invited: 0, coming: 0, maybe: 0, declined: 0 }])),
  cards: { both: 0, day2: 0, wedding: 0 },
});

// Counters for each owner: households, invites sent, replies, reminders due, and people per day.
export function countByOwner(
  guests: { id: string; persons: number; handled_by: Owner }[],
  tracks: Record<string, HouseholdTrack>,
  days: RsvpDay[]
): Record<Owner, OwnerCounts> {
  const out = Object.fromEntries(OWNERS.map((o) => [o, emptyCounts(days)])) as Record<Owner, OwnerCounts>;
  for (const g of guests) {
    const c = out[g.handled_by];
    const t = tracks[g.id];
    if (!c || !t) continue;
    c.households += 1;
    c.people += g.persons;
    if (t.lastInvite) c.sent += 1;
    if (t.stage === 'replied') c.replied += 1;
    if (t.stage === 'not_sent') c.notSent += 1;
    if (t.needsReminder) c.needsReminder += 1;
    if (t.kind === 'both' || t.kind === 'day2' || t.kind === 'wedding') c.cards[t.kind] += 1;
    for (const d of t.days) {
      const b = c.byDay[d.date];
      if (!b) continue;
      b.invited += d.coming + d.maybe + d.declined + d.noReply;
      b.coming += d.coming;
      b.maybe += d.maybe;
      b.declined += d.declined;
    }
  }
  return out;
}

// India time, as people say it: "12 Nov".
export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
