import { useSyncExternalStore } from 'react';
import releases from '../data/releases.json';

export type ReleaseKind = 'new' | 'improved' | 'fix';
export type Release = { version: string; date: string; title: string; items: { kind: ReleaseKind; text: string }[] };

export const RELEASES = releases as Release[];
const KEY = 'pwp-seen-release';
const listeners = new Set<() => void>();

// The last version this person has looked at, remembered per browser. It is a convenience only: if storage is
// unavailable everything still works and the badge just stays on.
function readSeen(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function markUpdatesSeen() {
  try {
    localStorage.setItem(KEY, RELEASES[0].version);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// How many versions are newer than the last one seen. A brand-new browser sees the badge once.
export function useUnseenUpdates(): number {
  const seen = useSyncExternalStore(subscribe, readSeen, () => '');
  const idx = RELEASES.findIndex((r) => r.version === seen);
  return idx === -1 ? RELEASES.length : idx;
}
