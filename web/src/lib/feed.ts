import { supabase } from './supabase';

// My feed: one person's to-dos, decisions and questions from WhatsApp, pushed in by the local knowledge base (wakb)
// and triaged here by swiping. Rows are owner-only (RLS); the app may only change status and snooze_until.

export type FeedKind = 'todo' | 'decision' | 'question' | 'money' | 'date' | 'info';
export type FeedStatus = 'open' | 'done' | 'snoozed' | 'focus' | 'waiting' | 'dropped';
export type FeedAction = 'done' | 'snooze' | 'focus' | 'waiting' | 'drop' | 'undo';
export type SwipeDir = 'right' | 'left' | 'up' | 'down';

export type FeedCard = {
  id: string;
  owner_id: string;
  source_ref: string;
  domain: string | null;
  kind: FeedKind;
  title: string;
  body: string | null;
  chat_name: string | null;
  msg_ref: string | null;
  source_ts: string | null;
  due_date: string | null;
  score: number;
  status: FeedStatus;
  snooze_until: string | null;
  status_changed_at: string | null;
};

export const DIR_ACTION: Record<SwipeDir, FeedAction> = { right: 'done', left: 'snooze', up: 'focus', down: 'waiting' };

export const ACTION_STATUS: Record<Exclude<FeedAction, 'undo'>, FeedStatus> = {
  done: 'done',
  snooze: 'snoozed',
  focus: 'focus',
  waiting: 'waiting',
  drop: 'dropped',
};

export const ACTION_LABEL: Record<FeedAction, string> = {
  done: 'Done',
  snooze: 'Snoozed',
  focus: 'Queued for focus time',
  waiting: 'Waiting on someone',
  drop: 'Dropped',
  undo: 'Undone',
};

export const DOMAIN_LABEL: Record<string, string> = {
  'pwp-planning': 'PwP',
  'pwp-wedding': 'Wedding',
  'shaadi-ki-tayyari': 'Shaadi',
  fam: 'Family',
  other: 'Personal',
};

export const KIND_META: Record<FeedKind, { label: string; color: string }> = {
  decision: { label: 'Decision', color: 'orange' },
  question: { label: 'Question', color: 'grape' },
  todo: { label: 'To do', color: 'teal' },
  money: { label: 'Money', color: 'yellow' },
  date: { label: 'Date', color: 'blue' },
  info: { label: 'Info', color: 'gray' },
};

// Quiet slots on WhatsApp (from message history): 8am and 5pm. Snooze lands on the next one.
export function nextQuietSlot(now = new Date()): Date {
  const at = (d: Date, h: number) => {
    const x = new Date(d);
    x.setHours(h, 0, 0, 0);
    return x;
  };
  if (now.getHours() < 8) return at(now, 8);
  if (now.getHours() < 17) return at(now, 17);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return at(tomorrow, 8);
}

export function slotLabel(d: Date, now = new Date()): string {
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${sameDay ? 'today' : 'tomorrow'} ${time}`;
}

// Days from today to a yyyy-mm-dd date (negative = overdue).
export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function dueLabel(date: string | null): { text: string; color: string } | null {
  if (!date) return null;
  const n = daysUntil(date);
  if (n < 0) return { text: n === -1 ? 'Overdue 1 day' : `Overdue ${-n} days`, color: 'red' };
  if (n === 0) return { text: 'Due today', color: 'red' };
  if (n === 1) return { text: 'Due tomorrow', color: 'orange' };
  if (n <= 7) return { text: `Due in ${n} days`, color: 'yellow' };
  return { text: `Due ${new Date(date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`, color: 'gray' };
}

export function ageLabel(ts: string | null): string {
  if (!ts) return '';
  const h = (Date.now() - new Date(ts).getTime()) / 3600000;
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

// Cards still waiting for a swipe: open ones, plus snoozed ones whose time has come.
export function isLive(c: FeedCard, now = Date.now()): boolean {
  return c.status === 'open' || (c.status === 'snoozed' && !!c.snooze_until && new Date(c.snooze_until).getTime() <= now);
}

export async function loadFeed(): Promise<FeedCard[]> {
  const out: FeedCard[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('feed_cards')
      .select('*')
      .in('status', ['open', 'snoozed', 'focus', 'waiting'])
      .order('score', { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as FeedCard[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadActionDays(ownerId: string): Promise<{ today: number; streak: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from('feed_actions')
    .select('created_at, action')
    .eq('owner_id', ownerId)
    .neq('action', 'undo')
    .gte('created_at', since.toISOString());
  if (error) throw error;
  const days = new Set((data ?? []).map((a) => new Date(a.created_at).toDateString()));
  const todayKey = new Date().toDateString();
  const today = (data ?? []).filter((a) => new Date(a.created_at).toDateString() === todayKey).length;
  // Streak: consecutive days with at least one swipe, counting back from today (or yesterday if none yet today).
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return { today, streak };
}

// Change a card's status and log the swipe, which the Mac applies to its own list on the next sync.
export async function applyAction(card: FeedCard, action: FeedAction, prevStatus: FeedStatus = card.status) {
  const status: FeedStatus = action === 'undo' ? prevStatus : ACTION_STATUS[action];
  const snooze_until = action === 'snooze' ? nextQuietSlot().toISOString() : null;
  const { error } = await supabase.from('feed_cards').update({ status, snooze_until }).eq('id', card.id);
  if (error) throw error;
  const { error: e2 } = await supabase
    .from('feed_actions')
    .insert({ owner_id: card.owner_id, card_id: card.id, action, prev_status: card.status });
  if (e2) throw e2;
  return { status, snooze_until };
}
