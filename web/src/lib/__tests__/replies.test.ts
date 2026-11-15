import { describe, expect, it } from 'vitest';
import { CODE_PATTERN, inviteLink, latestNew, linksCsv, makeCode, replyPlan, type InviteReply } from '../replies';
import { DAY1, DAY2 } from './fixtures';

const reply = (over: Partial<InviteReply>): InviteReply => ({
  id: 'r1', guest_id: 'a', code: 'K7M2QXAB', responder_name: 'Asha', answers: {}, arrive_on: null, leave_on: null,
  travel: null, note: null, status: 'new', reviewed_at: null, submitted_at: '2026-12-01T10:00:00Z', ...over,
});

describe('makeCode', () => {
  it('makes codes the database accepts, without 0, O, 1 or I', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(CODE_PATTERN);
    expect(makeCode(8, () => new Uint8Array([0, 8, 14, 24, 31, 32, 255, 100]))).toBe('AJQ29A9E');
  });
});

describe('inviteLink', () => {
  it('adds the code to the site address, keeping a path and any other query', () => {
    expect(inviteLink('K7M2QXAB', 'https://example.com/invite/')).toBe('https://example.com/invite/?code=K7M2QXAB');
    expect(inviteLink('K7M2QXAB', 'https://example.com/?lang=hi')).toBe('https://example.com/?lang=hi&code=K7M2QXAB');
  });
});

describe('replyPlan', () => {
  it('turns yes, maybe and no into counts within the household', () => {
    const plan = replyPlan(reply({ answers: { [DAY1]: { answer: 'yes', people: 3 }, [DAY2]: { answer: 'maybe', people: 2 } } }), 5, [DAY1, DAY2]);
    expect(plan.rows).toEqual([
      { event_date: DAY1, coming: 3, maybe: 0, declined: 2 },
      { event_date: DAY2, coming: 0, maybe: 2, declined: 0 },
    ]);
    expect(replyPlan(reply({ answers: { [DAY1]: { answer: 'no', people: 0 } } }), 4, [DAY1]).rows).toEqual([{ event_date: DAY1, coming: 0, maybe: 0, declined: 4 }]);
  });

  it('caps more people than the household and flags it', () => {
    const plan = replyPlan(reply({ answers: { [DAY1]: { answer: 'yes', people: 7 } } }), 5, [DAY1]);
    expect(plan.rows[0]).toEqual({ event_date: DAY1, coming: 5, maybe: 0, declined: 0 });
    expect(plan.overSize).toBe(true);
  });

  it('never adds a day the household is not invited to', () => {
    const plan = replyPlan(reply({ answers: { [DAY1]: { answer: 'yes', people: 2 }, [DAY2]: { answer: 'yes', people: 2 } } }), 2, [DAY2]);
    expect(plan.rows.map((r) => r.event_date)).toEqual([DAY2]);
    expect(plan.ignored).toEqual([DAY1]);
  });
});

describe('latestNew', () => {
  it('keeps the newest reply per household still to review, newest first', () => {
    const list = latestNew([
      reply({ id: 'old', submitted_at: '2026-12-01T10:00:00Z' }),
      reply({ id: 'new', submitted_at: '2026-12-02T10:00:00Z' }),
      reply({ id: 'done', submitted_at: '2026-12-03T10:00:00Z', status: 'applied' }),
      reply({ id: 'b', guest_id: 'b', submitted_at: '2026-12-04T10:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['b', 'new']);
  });
});

describe('linksCsv', () => {
  it('writes the link when the site is known and leaves it empty when not, quoting names', () => {
    const rows = [{ name: 'Sharma "Ji"', persons: 4, code: 'K7M2QXAB' }];
    expect(linksCsv(rows, 'https://example.com/').split('\n')[1]).toBe('"Sharma ""Ji""","4","K7M2QXAB","https://example.com/?code=K7M2QXAB"');
    expect(linksCsv(rows, null).split('\n')[1].endsWith(',""')).toBe(true);
  });
});
