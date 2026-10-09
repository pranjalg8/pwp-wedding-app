// Pure message-building for outbox events. Kept free of I/O so it can be tested on its own.
// The pub/sub subject must be printable ASCII (max 100); the message max is 2000 characters.

export type OutboxRow = {
  id: string;
  kind: 'deck_completed' | 'weekly_nudge' | 'due_reminder';
  recipient_profile_id: string;
  payload: Record<string, unknown>;
};

const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, '').trim();

export function buildMessage(row: OutboxRow, appUrl: string): { subject: string; message: string } {
  const p = row.payload;
  const label = String(p.deck_label ?? 'a deck');
  const homeUrl = `${appUrl.replace(/\/$/, '')}/#/`;
  if (row.kind === 'due_reminder') {
    const title = String(p.title ?? 'An item');
    const days = Number(p.days_left ?? 0);
    const when = days < 0 ? `${-days} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'due today' : `due in ${days} day${days === 1 ? '' : 's'}`;
    const subject = ascii(`${title}: ${when}`).slice(0, 100);
    const message = `"${title}" (${String(p.topic_label ?? 'planner')}) is ${when}, on ${String(p.due_date ?? '')}. Open the planner: ${homeUrl}`;
    return { subject, message: message.slice(0, 2000) };
  }
  const swipePath = String(p.deck_key ?? '').startsWith('wedding-') ? 'functions/swipe' : 'honeymoon/swipe';
  const swipeUrl = `${appUrl.replace(/\/$/, '')}/#/${swipePath}`;

  if (row.kind === 'deck_completed') {
    const actor = String(p.actor_name ?? 'Your partner');
    const total = Number(p.total ?? 0);
    const subject = ascii(`${actor} finished ${label}`).slice(0, 100);
    const message = p.partner_done
      ? `${actor} has answered all ${total} cards in "${label}". You have both finished, with ${Number(p.matches ?? 0)} matches. See them under Honeymoon, Swipe, Results: ${swipeUrl}`
      : `${actor} has answered all ${total} cards in "${label}". Your turn when you have a few minutes: ${swipeUrl}`;
    return { subject, message: message.slice(0, 2000) };
  }

  const partner = String(p.partner_name ?? 'Your partner');
  const subject = ascii(`Reminder: swipe cards for ${label}`).slice(0, 100);
  const message = `${partner} has answered ${Number(p.partner_answered ?? 0)} of ${Number(p.total ?? 0)} cards in "${label}". You have answered ${Number(p.answered ?? 0)}. It only takes a few minutes: ${swipeUrl}`;
  return { subject, message: message.slice(0, 2000) };
}
