// Pure helpers behind useRealtime: what to subscribe to, a unique channel name, and a debouncer.

// A table to watch, optionally narrowed with a PostgREST-style realtime filter (e.g. 'task_id=eq.123').
export type RealtimeSource = string | { table: string; filter?: string };

export function normalizeSources(sources: RealtimeSource[]): { table: string; filter?: string }[] {
  return sources.map((s) => (typeof s === 'string' ? { table: s } : s));
}

// A stable string for the effect dependency, so a new array literal on every render does not resubscribe.
export function sourcesKey(sources: RealtimeSource[]): string {
  return normalizeSources(sources)
    .map((s) => (s.filter ? `${s.table}?${s.filter}` : s.table))
    .join('|');
}

// The inverse of sourcesKey.
export function parseSourcesKey(key: string): { table: string; filter?: string }[] {
  if (!key) return [];
  return key.split('|').map((part) => {
    const i = part.indexOf('?');
    return i < 0 ? { table: part } : { table: part.slice(0, i), filter: part.slice(i + 1) };
  });
}

let seq = 0;

// supabase.channel(topic) hands back the existing channel when the topic is already in use, and removeChannel
// is async, so a quick remount (StrictMode, navigating back) with a fixed name can end up bound to the channel
// that is being torn down. A fresh name per subscription avoids that.
export function uniqueChannelName(sources: RealtimeSource[]): string {
  seq += 1;
  const tables = normalizeSources(sources).map((s) => s.table).join('_') || 'none';
  return `rt_${tables}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

export type Debounced = { call: () => void; cancel: () => void; flush: () => void; pending: () => boolean };

// Trailing-edge debounce: a sync batch touching 50 rows fires one reload, not 50.
export function createDebouncer(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    call() {
      if (ms <= 0) {
        fn();
        return;
      }
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel,
    flush() {
      if (timer === null) return;
      cancel();
      fn();
    },
    pending: () => timer !== null,
  };
}
