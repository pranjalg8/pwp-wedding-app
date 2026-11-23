// Check-in writes made with poor signal are kept in a queue (in localStorage) and sent when the connection is back.
// Only the latest value per household and day matters, so a later tick replaces an earlier queued one.
export type CheckinWrite = { guest_id: string; event_date: string; people: number };

const KEY = 'pwp-checkin-queue';
const same = (a: CheckinWrite, b: CheckinWrite) => a.guest_id === b.guest_id && a.event_date === b.event_date;

export function enqueue(queue: CheckinWrite[], w: CheckinWrite): CheckinWrite[] {
  return [...queue.filter((q) => !same(q, w)), w];
}

export function loadQueue(): CheckinWrite[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.guest_id === 'string' && typeof x.event_date === 'string' && Number.isInteger(x.people) && x.people >= 0) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: CheckinWrite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* storage unavailable: the queue lives in memory only */
  }
}

// Sends each queued write with `send`; returns those that failed (kept for the next try). If a newer write for the
// same household and day was queued while sending, it is kept and the older one is not resent.
export async function flush(queue: CheckinWrite[], send: (w: CheckinWrite) => Promise<boolean>): Promise<CheckinWrite[]> {
  const left: CheckinWrite[] = [];
  for (const w of queue) {
    let ok = false;
    try {
      ok = await send(w);
    } catch {
      ok = false;
    }
    if (!ok) left.push(w);
  }
  return left;
}
