// Loading planner data so that a failure is never mistaken for "nothing here". No React or Supabase in this file, so
// the rules can be tested on their own.

type Result = { data: unknown; error: { message: string } | null };

// The rows of a query, or an error when it failed. Plain `data ?? []` turns a failed load into an empty page.
export function rowsOf<T>(res: Result): T[] {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T[];
}

// The single row of a query (null when there is none), or an error when it failed.
export function oneOf<T>(res: Result): T | null {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? null) as T | null;
}

export type LiveState<T> = { data: T; loaded: boolean; error: string | null };

// Runs a load and reports each result. A failure keeps the last good data and sets the error; the next success clears
// it. Calls that arrive during a load are folded into one more load afterwards, so a burst of live updates (filling 50
// rooms, say) costs two loads and an old answer can never replace a newer one.
export function createLiveLoader<T>(load: () => Promise<T>, report: (update: (prev: LiveState<T>) => LiveState<T>) => void) {
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;

  async function loop() {
    do {
      again = false;
      try {
        const data = await load();
        if (!stopped) report(() => ({ data, loaded: true, error: null }));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        if (!stopped) report((prev) => ({ ...prev, loaded: true, error }));
      }
    } while (again && !stopped);
  }

  return {
    run() {
      if (stopped) return Promise.resolve();
      if (running) {
        again = true;
        return running;
      }
      running = loop().finally(() => {
        running = null;
      });
      return running;
    },
    stop() {
      stopped = true;
    },
  };
}
