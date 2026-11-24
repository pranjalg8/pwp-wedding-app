import { describe, expect, it } from 'vitest';
import { checkReply, clientIp, isDay, isObject } from '../../../../supabase/functions/invite-rsvp/rules';

const DAYS = ['2027-02-14', '2027-02-15'];
const form = (over: Record<string, unknown> = {}) => ({
  name: 'Asha',
  days: { '2027-02-14': { answer: 'yes', people: 3 }, '2027-02-15': { answer: 'no', people: 2 } },
  ...over,
});
const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k] ?? null });

describe('checkReply', () => {
  it('keeps a good reply, with no people on a day they cannot come', () => {
    const out = checkReply(form({ arrive_on: '2027-02-14', leave_on: '2027-02-16', note: ' Veg ' }), DAYS);
    expect(out).toEqual({
      reply: {
        responder_name: 'Asha',
        answers: { '2027-02-14': { answer: 'yes', people: 3 }, '2027-02-15': { answer: 'no', people: 0 } },
        arrive_on: '2027-02-14',
        leave_on: '2027-02-16',
        travel: null,
        note: 'Veg',
        needs_room: null,
        room_share: null,
      },
    });
  });

  it('keeps only the days the household is invited to', () => {
    const out = checkReply(form(), ['2027-02-15']);
    expect('reply' in out && Object.keys(out.reply.answers)).toEqual(['2027-02-15']);
  });

  it('refuses coming or maybe with nobody, so it cannot read as the whole household declining', () => {
    expect(checkReply(form({ days: { '2027-02-14': { answer: 'yes', people: 0 } } }), ['2027-02-14'])).toHaveProperty('error');
    expect(checkReply(form({ days: { '2027-02-14': { answer: 'maybe', people: 0 } } }), ['2027-02-14'])).toHaveProperty('error');
  });

  it('refuses a missing answer, a bad count, a missing name and no invited days', () => {
    expect(checkReply(form({ days: {} }), DAYS)).toHaveProperty('error');
    expect(checkReply(form({ days: 'yes' }), DAYS)).toHaveProperty('error');
    expect(checkReply(form({ days: { '2027-02-14': { answer: 'yes', people: 21 } } }), ['2027-02-14'])).toHaveProperty('error');
    expect(checkReply(form({ days: { '2027-02-14': { answer: 'yes', people: 1.5 } } }), ['2027-02-14'])).toHaveProperty('error');
    expect(checkReply(form({ name: '  ' }), DAYS)).toHaveProperty('error');
    expect(checkReply(form(), [])).toHaveProperty('error');
  });

  it('needs both dates or neither, with leaving after arriving', () => {
    expect(checkReply(form({ arrive_on: '2027-02-14' }), DAYS)).toHaveProperty('error');
    expect(checkReply(form({ arrive_on: '2027-02-15', leave_on: '2027-02-15' }), DAYS)).toHaveProperty('error');
    expect(checkReply(form({ arrive_on: '2027-02-31', leave_on: '2027-03-01' }), DAYS)).toHaveProperty('error');
  });
});

describe('checkReply with the room question (Pranjal\'s friends)', () => {
  const both = { '2027-02-14': { answer: 'yes', people: 2 }, '2027-02-15': { answer: 'yes', people: 2 } };
  const ask = (over: Record<string, unknown>, days = DAYS) => checkReply(form({ days: both, ...over }), days, { askRoom: true });

  it('turns the nights into arriving and leaving days', () => {
    const out = ask({ room: { need: 'yes', nights: ['2027-02-15', '2027-02-14'] } });
    expect(out).toMatchObject({ reply: { needs_room: true, room_share: null, arrive_on: '2027-02-14', leave_on: '2027-02-16' } });
    expect(ask({ room: { need: 'yes', nights: ['2027-02-15'] } })).toMatchObject({ reply: { arrive_on: '2027-02-15', leave_on: '2027-02-16' } });
  });

  it('records heading home, and ignores the old date pickers for these households', () => {
    const out = ask({ room: { need: 'no' }, arrive_on: '2027-02-14', leave_on: '2027-02-16' });
    expect(out).toMatchObject({ reply: { needs_room: false, room_share: null, arrive_on: null, leave_on: null } });
  });

  it('insists on an answer and at least one night', () => {
    expect(ask({})).toHaveProperty('error');
    expect(ask({ room: { need: 'maybe' } })).toHaveProperty('error');
    expect(ask({ room: { need: 'yes', nights: [] } })).toHaveProperty('error');
  });

  it('keeps only nights on days they are coming, in a row', () => {
    const office = { '2027-02-15': { answer: 'yes', people: 1 } };
    expect(ask({ days: office, room: { need: 'yes', nights: ['2027-02-14'] } }, ['2027-02-15'])).toHaveProperty('error');
    const gap = checkReply(form({ days: both, room: { need: 'yes', nights: ['2027-02-14', '2027-02-16'] } }), DAYS, { askRoom: true });
    expect(gap).toMatchObject({ reply: { arrive_on: '2027-02-14', leave_on: '2027-02-15' } }); // 16 Feb is not a coming day
  });

  it('asks about sharing only when someone comes alone', () => {
    const alone = { '2027-02-14': { answer: 'yes', people: 1 }, '2027-02-15': { answer: 'maybe', people: 1 } };
    expect(ask({ days: alone, room: { need: 'yes', nights: ['2027-02-14'], share: true } })).toMatchObject({ reply: { room_share: true } });
    expect(ask({ days: alone, room: { need: 'yes', nights: ['2027-02-14'] } })).toMatchObject({ reply: { room_share: false } });
    expect(ask({ room: { need: 'yes', nights: ['2027-02-14'], share: true } })).toMatchObject({ reply: { room_share: null } });
  });

  it('skips the question when they cannot come at all', () => {
    const none = { '2027-02-14': { answer: 'no', people: 0 }, '2027-02-15': { answer: 'no', people: 0 } };
    expect(ask({ days: none })).toMatchObject({ reply: { needs_room: null, arrive_on: null, leave_on: null } });
  });
});

describe('request helpers', () => {
  it('accepts only real days and plain objects', () => {
    expect(isDay('2027-02-28')).toBe(true);
    expect(isDay('2027-02-30')).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject({})).toBe(true);
  });

  it('prefers the address the proxy sets over one the caller can send', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.1.1.1');
    expect(clientIp(headers({ 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }))).toBe('2.2.2.2');
    expect(clientIp(headers({}))).toBe('unknown');
  });
});
