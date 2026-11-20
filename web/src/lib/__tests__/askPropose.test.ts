import { describe, expect, it } from 'vitest';
import { snapshot, validateCall } from '../../../../supabase/functions/kb-chat/propose';

describe('ask proposals', () => {
  it('turns a task request into a pending-task proposal', () => {
    const r = validateCall('propose_task', { title: 'Confirm the dhol wala', due_date: '2026-11-27', priority: 'high', topic_key: 'events' }, []);
    expect(r.ok && r.proposal.kind).toBe('new_task');
    expect(r.ok && r.proposal.payload).toMatchObject({ title: 'Confirm the dhol wala', due_date: '2026-11-27', priority: 'high' });
  });

  it('ignores an invalid date and an unknown area instead of failing', () => {
    const r = validateCall('propose_task', { title: 'Book the mandap', due_date: 'Friday', topic_key: 'nonsense' }, []);
    expect(r.ok && r.proposal.payload.due_date).toBeNull();
    expect(r.ok && r.proposal.topicKey).toBe('dates_logistics');
  });

  it('refuses a payment without a date, an amount, or for Royal Pepper, and repeats', () => {
    const base = { payee: 'Lensflix', amount: 50000, due_date: '2026-11-30', topic_key: 'photography' };
    expect(validateCall('propose_payment', { ...base, due_date: undefined }, [])).toMatchObject({ ok: false });
    expect(validateCall('propose_payment', { ...base, amount: 'a lot' }, [])).toMatchObject({ ok: false });
    expect(validateCall('propose_payment', { ...base, payee: 'Royal Pepper' }, [])).toMatchObject({ ok: false });
    expect(validateCall('propose_payment', base, [{ payee: 'Other', amount: 50000, due_date: '2026-11-30' }])).toMatchObject({ ok: false });
    const ok = validateCall('propose_payment', base, []);
    expect(ok.ok && ok.proposal.involvesMoney).toBe(true);
  });

  it('removes bank details from anything it saves', () => {
    const r = validateCall('propose_note', { title: 'Vendor A/c 123456789012', detail: 'call 9876543210', topic_key: 'decor' }, []);
    expect(JSON.stringify(r)).not.toMatch(/123456789012|9876543210/);
  });

  it('rejects an unknown tool', () => {
    expect(validateCall('delete_everything', {}, [])).toMatchObject({ ok: false });
  });

  it('builds a snapshot with counts and dates but no guest names', () => {
    const text = snapshot({
      today: '2026-11-21',
      tasks: [{ title: 'Call caterer', due_date: '2026-11-25', priority: 'high', owner: 'pranjal', status: 'open' }, { title: 'Done thing', due_date: null, priority: 'normal', owner: null, status: 'done' }],
      payments: [{ payee: 'Photographer advance', amount: 50000, due_date: '2026-11-30' }],
      rsvps: [{ event_date: '2027-02-14', coming: 4, maybe: 1, declined: 0 }, { event_date: '2027-02-14', coming: 2, maybe: 0, declined: 1 }],
      guests: [{ persons: 5, rooms_inside: 2, rooms_outside: 0.5 }],
    });
    expect(text).toContain('2026-11-25 Call caterer');
    expect(text).not.toContain('Done thing');
    expect(text).toContain('₹50,000');
    expect(text).toContain('RSVP 2027-02-14: 2 households invited, 6 people yes, 1 maybe, 1 no');
    expect(text).toContain('1 households, 5 people');
  });
});
