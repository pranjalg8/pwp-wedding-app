// Pure helpers for kb-chat's "Ask can propose" feature: the tools Gemini may call, the checks on what it asks for,
// and the aggregate planner snapshot. No imports, so the web test suite can run it.
//
// The tools only ever create PENDING suggestions. A person accepts them in the Suggestions inbox; nothing in the
// planner changes from a chat.

export const TOPIC_KEYS = [
  'dates_logistics', 'jewellery', 'outfits', 'decor', 'photography', 'mehndi', 'dance', 'events',
  'accommodations', 'gifts', 'shopping', 'reception', 'honeymoon', 'post_wedding', 'contingency',
] as const;

const topic = { type: 'STRING', enum: [...TOPIC_KEYS], description: 'Planning area' };

export const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'propose_task',
        description: 'Propose adding a to-do. Only when the user explicitly asks to add, remember or schedule something to do.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Short imperative title' },
            due_date: { type: 'STRING', description: 'YYYY-MM-DD, only if the user gave or clearly implied a date' },
            priority: { type: 'STRING', enum: ['high', 'normal', 'low'] },
            owner: { type: 'STRING', enum: ['pranjal', 'paridhi', 'both'] },
            topic_key: topic,
          },
          required: ['title', 'topic_key'],
        },
      },
      {
        name: 'propose_payment',
        description: 'Propose adding a payment still to be made. Only when the user states the payee, the amount AND the due date. Never guess any of them.',
        parameters: {
          type: 'OBJECT',
          properties: {
            payee: { type: 'STRING' },
            amount: { type: 'NUMBER', description: 'Rupees, plain number' },
            due_date: { type: 'STRING', description: 'YYYY-MM-DD' },
            note: { type: 'STRING' },
            topic_key: topic,
          },
          required: ['payee', 'amount', 'due_date', 'topic_key'],
        },
      },
      {
        name: 'propose_note',
        description: 'Propose saving a note or decision. Only when the user explicitly asks to note or remember something.',
        parameters: {
          type: 'OBJECT',
          properties: { title: { type: 'STRING' }, detail: { type: 'STRING' }, topic_key: topic },
          required: ['title', 'topic_key'],
        },
      },
    ],
  },
];

const SECRET = /\b\d{9,18}\b|\b[A-Z]{4}0[A-Z0-9]{6}\b|[\w.\-]+@[a-z0-9.\-]+|\b[A-Z]{5}\d{4}[A-Z]\b|\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/gi;
export const clean = (v: unknown, max: number) => String(v ?? '').replace(SECRET, '[removed]').replace(/\s+/g, ' ').trim().slice(0, max);

export function validDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const y = d.getUTCFullYear();
  return y >= 2026 && y <= 2028 ? v : null;
}

export type ExistingPayment = { payee: string; amount: number; due_date: string };
export type Proposal = {
  kind: 'new_task' | 'new_payment' | 'new_item';
  topicKey: string;
  label: string;
  involvesMoney: boolean;
  payload: Record<string, unknown>;
};
export type CallResult = { ok: true; proposal: Proposal } | { ok: false; reason: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function validateCall(name: string, rawArgs: unknown, existing: ExistingPayment[]): CallResult {
  const a = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  const topicKey = (TOPIC_KEYS as readonly string[]).includes(String(a.topic_key)) ? String(a.topic_key) : 'dates_logistics';

  if (name === 'propose_task') {
    const title = clean(a.title, 120);
    if (title.length < 3) return { ok: false, reason: 'the task had no clear title' };
    const owner = ['pranjal', 'paridhi', 'both'].includes(String(a.owner)) ? String(a.owner) : null;
    const priority = a.priority === 'high' || a.priority === 'low' ? a.priority : 'normal';
    const due = validDate(a.due_date);
    return { ok: true, proposal: { kind: 'new_task', topicKey, label: title + (due ? ` (due ${due})` : ''), involvesMoney: false, payload: { title, due_date: due, priority, owner, summary: 'Proposed in the Ask panel' } } };
  }

  if (name === 'propose_payment') {
    const payee = clean(a.payee, 120);
    const amount = Number(a.amount);
    const due = validDate(a.due_date);
    if (!payee) return { ok: false, reason: 'the payment had no payee' };
    if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000_000) return { ok: false, reason: `the payment to ${payee} had no clear amount` };
    if (!due) return { ok: false, reason: `the payment to ${payee} needs a due date, so I did not add it` };
    if (/royal\s*pepper/i.test(payee)) return { ok: false, reason: 'Royal Pepper is paid by both fathers and is not in the planner' };
    if (existing.some((e) => Number(e.amount) === amount && (e.due_date === due || norm(e.payee) === norm(payee)))) {
      return { ok: false, reason: `a payment of ${amount} to ${payee} is already in the planner` };
    }
    return { ok: true, proposal: { kind: 'new_payment', topicKey, label: `${payee}: ₹${amount.toLocaleString('en-IN')} by ${due}`, involvesMoney: true, payload: { payee, amount, due_date: due, note: clean(a.note, 200), is_estimate: false } } };
  }

  if (name === 'propose_note') {
    const title = clean(a.title, 120);
    if (title.length < 3) return { ok: false, reason: 'the note had no clear title' };
    return { ok: true, proposal: { kind: 'new_item', topicKey, label: title, involvesMoney: false, payload: { type: 'note', title, detail: clean(a.detail, 800) || null, status: 'open' } } };
  }
  return { ok: false, reason: 'unknown action' };
}

export type SnapshotInput = {
  today: string;
  tasks: { title: string; due_date: string | null; priority: string; owner: string | null; status: string }[];
  payments: { payee: string; amount: number; due_date: string; paridhi_amount?: number | null }[];
  rsvps: { event_date: string; coming: number; maybe: number; declined: number }[];
  guests: { persons: number; rooms_inside: number; rooms_outside: number }[];
};

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

// A short plain-text picture of the live planner: counts and dates only, never a guest's name or contact.
export function snapshot(i: SnapshotInput): string {
  const lines: string[] = [`PLANNER SNAPSHOT (live, as of ${i.today}; trust it over the Knowledge pages if they differ)`];
  const open = i.tasks.filter((t) => t.status !== 'done');
  const dated = open.filter((t) => t.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  lines.push(`Open tasks: ${open.length}. With a due date (soonest first):`);
  for (const t of dated.slice(0, 25)) lines.push(`- ${t.due_date} ${t.title} [${t.priority}${t.owner ? ', ' + t.owner : ''}]`);
  const undated = open.length - dated.length;
  if (undated > 0) lines.push(`- plus ${undated} open tasks without a due date`);

  const pay = [...i.payments].sort((a, b) => a.due_date.localeCompare(b.due_date));
  lines.push(`Payments still to make: ${pay.length}, total ${inr(pay.reduce((s, p) => s + Number(p.amount), 0))}. Soonest first:`);
  for (const p of pay.slice(0, 25)) lines.push(`- ${p.due_date} ${p.payee} ${inr(Number(p.amount))}`);

  const byDay = new Map<string, { h: number; c: number; m: number; d: number }>();
  for (const r of i.rsvps) {
    const x = byDay.get(r.event_date) ?? { h: 0, c: 0, m: 0, d: 0 };
    x.h += 1; x.c += r.coming; x.m += r.maybe; x.d += r.declined;
    byDay.set(r.event_date, x);
  }
  lines.push(`Guest list: ${i.guests.length} households, ${i.guests.reduce((s, g) => s + g.persons, 0)} people; rooms ${i.guests.reduce((s, g) => s + Number(g.rooms_inside), 0)} at the main stay, ${i.guests.reduce((s, g) => s + Number(g.rooms_outside), 0)} elsewhere.`);
  for (const [day, x] of [...byDay].sort()) lines.push(`- RSVP ${day}: ${x.h} households invited, ${x.c} people yes, ${x.m} maybe, ${x.d} no`);
  return lines.join('\n');
}
