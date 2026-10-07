import { useSyncExternalStore } from 'react';
import { useAlternatives } from './useAlternative';

// Which destination the Honeymoon, Getting there and Swipe tabs are showing. '' means the default plan;
// otherwise it is the key of an alternative plan the person has access to. Kept in localStorage and shared
// across components in the same tab, so flipping on one tab flips them all.
const KEY = 'pwp-flipped';

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

let side = read();
const listeners = new Set<() => void>();

function setSide(next: string) {
  side = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore: the side just will not persist
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDestination() {
  const { plans, loading } = useAlternatives();
  const stored = useSyncExternalStore(subscribe, () => side);
  // An old stored value of '1' (before there were several alternatives) means the first alternative.
  const wanted = stored === '1' ? (plans[0]?.key ?? '') : stored;
  const plan = plans.find((p) => p.key === wanted);
  const destKey = plan ? plan.key : '';
  // Until plans have loaded we cannot tell whether a stored alternative is still allowed.
  const ready = !loading || stored === '';

  const order = ['', ...plans.map((p) => p.key)];
  const nextKey = order[(Math.max(0, order.indexOf(destKey)) + 1) % order.length];
  const labelOf = (key: string) => (key === '' ? 'Samui' : (plans.find((p) => p.key === key)?.label ?? ''));

  return {
    plans,
    plan,
    destKey,
    ready,
    hasAlternatives: plans.length > 0,
    currentLabel: labelOf(destKey),
    nextLabel: labelOf(nextKey),
    flip: () => setSide(nextKey),
  };
}
