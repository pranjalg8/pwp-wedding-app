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
