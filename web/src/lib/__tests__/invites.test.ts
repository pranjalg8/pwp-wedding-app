import { describe, expect, it } from 'vitest';
import {
  countByOwner,
  defaultOwner,
  greetingName,
  inviteMessage,
  ownerForProfile,
  trackHousehold,
  whatsappSendUrl,
  type InviteSend,
} from '../invites';
import type { InviteReply } from '../replies';
import { DAY1, DAY2 } from './fixtures';

const NOW = new Date('2026-12-10T12:00:00+05:30');
const send = (over: Partial<InviteSend>): InviteSend => ({
  id: 's1', guest_id: 'a', kind: 'invite', channel: 'whatsapp', sent_by: 'papa', sent_by_uid: null, sent_at: '2026-12-01T06:30:00Z', note: null, ...over,
});
const inv = (guest_id: string, event_date: string, coming = 0, maybe = 0, declined = 0) => ({ guest_id, event_date, coming, maybe, declined });
const reply = (over: Partial<InviteReply>): InviteReply => ({
  id: 'r1', guest_id: 'a', code: 'K7M2QXAB', responder_name: 'Asha', answers: {}, arrive_on: null, leave_on: null,
  travel: null, note: null, needs_room: null, room_share: null, status: 'new', reviewed_at: null, submitted_at: '2026-12-05T10:00:00Z', ...over,
});
const A = { id: 'a', persons: 3 };

describe('defaultOwner', () => {
  it('gives Friends-Anjul to Pranjal, Friends-Puru to Puru and everything else to Papa', () => {
    expect(defaultOwner('Friends-Anjul')).toBe('pranjal');
    expect(defaultOwner('Friends-Puru')).toBe('puru');
    for (const g of ['Hamara Pariwar - Mahoba', 'Relatives', 'Friends-DCG', 'Friends-Sushma', 'Pandit Ji', null]) expect(defaultOwner(g)).toBe('papa');
  });
});

describe('ownerForProfile', () => {
  it('knows the three by display name and nobody else', () => {
    expect(ownerForProfile('Pranjal')).toBe('pranjal');
    expect(ownerForProfile('Papa')).toBe('papa');
    expect(ownerForProfile('Dinesh Chandra Gupta')).toBe('papa');
    expect(ownerForProfile(' puru ')).toBe('puru');
    expect(ownerForProfile('Paridhi')).toBeNull();
    expect(ownerForProfile(null)).toBeNull();
  });
});

describe('greetingName', () => {
  it('takes the first part of a household name', () => {
    expect(greetingName('Preetu (Dr Nitish)')).toBe('Preetu');
    expect(greetingName('Yogendra (Babloo)-Kanpur')).toBe('Yogendra');
    expect(greetingName('Shivnarayan - Munna')).toBe('Shivnarayan');
    expect(greetingName('Sangeeta / Gudiya Gupta')).toBe('Sangeeta');
    expect(greetingName('Nikhil Malu')).toBe('Nikhil Malu');
  });
});

describe('inviteMessage', () => {
  const base = { name: 'Nikhil Malu', link: 'https://example.com/?code=K7M2QXAB', sender: 'pranjal' as const };

  it('names only the invited days with the right 2027 weekdays, the venue and the personal link', () => {
    const both = inviteMessage({ ...base, lang: 'en', kind: 'invite', days: [DAY2, DAY1] });
    expect(both).toContain('Namaste Nikhil Malu ji');
    expect(both).toContain('Sunday 14 Feb and Monday 15 Feb 2027');
    expect(both).toContain('Royal Pepper Hotels & Resorts, Kathuwas');
    expect(both).toContain(base.link);
    expect(both).toContain('— Pranjal');
    const one = inviteMessage({ ...base, lang: 'en', kind: 'invite', days: [DAY2] });
    expect(one).toContain('Monday 15 Feb 2027');
    expect(one).not.toContain('14 Feb');
  });

  it('writes Hindi with the Hindi weekdays and Papa signing for the family', () => {
    const hi = inviteMessage({ ...base, lang: 'hi', kind: 'invite', days: [DAY1, DAY2], sender: 'papa' });
    expect(hi).toContain('रविवार 14 फ़रवरी और सोमवार 15 फ़रवरी 2027');
    expect(hi).toContain('काठूवास');
    expect(hi).toContain('दिनेश चंद्र गुप्ता एवं परिवार');
    expect(hi).toContain(base.link);
  });

  it('words a reminder differently and still works without a link', () => {
    const r = inviteMessage({ ...base, lang: 'en', kind: 'reminder', days: [DAY1], link: null });
    expect(r).toContain('gentle reminder');
    expect(r).toContain('Please let us know who is coming.');
    expect(r).not.toContain('http');
  });

  it('names 13 and 16 Feb in words too, never as a raw date', () => {
    const en = inviteMessage({ ...base, lang: 'en', kind: 'invite', days: ['2027-02-16', '2027-02-13'] });
    expect(en).toContain('Saturday 13 Feb and Tuesday 16 Feb 2027');
    expect(en).not.toMatch(/2027-02/);
    const hi = inviteMessage({ ...base, lang: 'hi', kind: 'invite', days: ['2027-02-13', '2027-02-16'] });
    expect(hi).toContain('शनिवार 13 फ़रवरी और मंगलवार 16 फ़रवरी 2027');
  });

  it('never contains a time', () => {
    for (const lang of ['en', 'hi'] as const) expect(inviteMessage({ ...base, lang, kind: 'invite', days: [DAY1, DAY2] })).not.toMatch(/\d\s?(am|pm)|बजे/i);
  });
});

describe('whatsappSendUrl', () => {
  it('adds 91 to a bare Indian number and encodes the text', () => {
    expect(whatsappSendUrl('98765 43210', 'Hi & bye')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
    expect(whatsappSendUrl('+1 (415) 555-0100', 'x')).toBe('https://wa.me/14155550100?text=x');
  });
  it('falls back to the WhatsApp picker without a usable number', () => {
    expect(whatsappSendUrl(null, 'x')).toBe('https://wa.me/?text=x');
    expect(whatsappSendUrl('123', 'x')).toBe('https://wa.me/?text=x');
  });
});

describe('trackHousehold', () => {
  it('is not sent when invited with no send logged, and save-the-dates do not count as the invite', () => {
    const t = trackHousehold(A, [send({ kind: 'save_the_date' })], [inv('a', DAY1)], [], NOW);
    expect(t.stage).toBe('not_sent');
    expect(t.lastInvite).toBeNull();
    expect(t.lastAny?.kind).toBe('save_the_date');
  });

  it('is sent with the latest invite or reminder, and a reminder is due after 7 days without a reply', () => {
    const t = trackHousehold(A, [send({ id: 'x', sent_at: '2026-11-20T06:30:00Z' }), send({ id: 'y', kind: 'reminder', sent_at: '2026-12-02T06:30:00Z' })], [inv('a', DAY1, 1)], [], NOW);
    expect(t.stage).toBe('sent');
    expect(t.lastInvite?.id).toBe('y');
    expect(t.daysSinceInvite).toBe(8);
    expect(t.needsReminder).toBe(true);
    expect(trackHousehold(A, [send({ sent_at: '2026-12-08T06:30:00Z' })], [inv('a', DAY1)], [], NOW).needsReminder).toBe(false);
  });

  it('is replied once everyone has an answer on every day, or a site reply came in', () => {
    expect(trackHousehold(A, [send({})], [inv('a', DAY1, 2, 0, 1), inv('a', DAY2, 0, 0, 3)], [], NOW).stage).toBe('replied');
    const pending = trackHousehold(A, [send({})], [inv('a', DAY1)], [reply({})], NOW);
    expect(pending.stage).toBe('replied');
    expect(pending.needsReminder).toBe(false);
    expect(pending.pendingReply?.id).toBe('r1');
    expect(trackHousehold(A, [send({})], [inv('a', DAY1)], [reply({ status: 'dismissed' })], NOW).stage).toBe('sent');
  });

  it('shows per-day counts with the no-reply remainder', () => {
    const t = trackHousehold(A, [], [inv('a', DAY2, 1, 1), inv('a', DAY1, 3)], [], NOW);
    expect(t.days).toEqual([
      { date: DAY1, coming: 3, maybe: 0, declined: 0, noReply: 0 },
      { date: DAY2, coming: 1, maybe: 1, declined: 0, noReply: 1 },
    ]);
  });

  it('is not invited with no days', () => {
    expect(trackHousehold(A, [], [], [], NOW).stage).toBe('not_invited');
  });
});

describe('countByOwner', () => {
  it('counts households, sends, replies, reminders and people per day for each owner', () => {
    const guests = [
      { id: 'a', persons: 3, handled_by: 'papa' as const },
      { id: 'b', persons: 2, handled_by: 'papa' as const },
      { id: 'c', persons: 1, handled_by: 'pranjal' as const },
    ];
    const invites = [inv('a', DAY1, 2, 0, 1), inv('b', DAY1), inv('b', DAY2, 0, 1), inv('c', DAY2)];
    const sends = [send({ guest_id: 'a' }), send({ guest_id: 'b', sent_at: '2026-11-01T06:30:00Z' })];
    const tracks = Object.fromEntries(guests.map((g) => [g.id, trackHousehold(g, sends, invites, [], NOW)]));
    const days = [{ date: DAY1, label: '14', functions: [] }, { date: DAY2, label: '15', functions: [] }];
    const c = countByOwner(guests, tracks, days);
    expect(c.papa).toMatchObject({ households: 2, people: 5, sent: 2, replied: 1, needsReminder: 1, notSent: 0 });
    expect(c.papa.byDay[DAY1]).toEqual({ invited: 5, coming: 2, maybe: 0, declined: 1 });
    expect(c.papa.byDay[DAY2]).toEqual({ invited: 2, coming: 0, maybe: 1, declined: 0 });
    expect(c.pranjal).toMatchObject({ households: 1, sent: 0, notSent: 1 });
    expect(c.puru.households).toBe(0);
  });
});
