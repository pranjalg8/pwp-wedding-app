// A one-value async cache: the first get() starts the load, later calls share it until invalidate() or until it
// is older than maxAgeMs. A failed load is not kept, so the next get() tries again.
export type AsyncCache<T> = { get: () => Promise<T>; invalidate: () => void };

export function createAsyncCache<T>(load: () => Promise<T>, { maxAgeMs = Infinity, now = Date.now }: { maxAgeMs?: number; now?: () => number } = {}): AsyncCache<T> {
  let pending: Promise<T> | null = null;
  let startedAt = 0;
  let generation = 0;
  return {
    get() {
      if (pending && now() - startedAt < maxAgeMs) return pending;
      const mine = ++generation;
      startedAt = now();
      const p = load().catch((err) => {
        if (mine === generation) pending = null;
        throw err;
      });
      pending = p;
      return p;
    },
    invalidate() {
      generation++;
      pending = null;
    },
  };
}
