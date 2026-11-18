import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createDebouncer, parseSourcesKey, sourcesKey, uniqueChannelName, type RealtimeSource } from '../lib/realtime';

export type RealtimeOptions = {
  // Collapse a burst of row changes into one call. 0 calls on every change.
  debounceMs?: number;
  // Also call once when the subscription starts (the initial load), straight away rather than debounced.
  immediate?: boolean;
  // Skip subscribing until the inputs are ready (e.g. an id from the URL has loaded).
  enabled?: boolean;
};

// Keep a view live: call onChange (debounced) whenever any watched table changes. Each subscription gets its own
// channel name and the latest onChange is always used, so callers can pass an inline function. onChange gets an
// isActive() check that turns false once the subscription is torn down, to guard setState after an await.
export function useRealtime(sources: RealtimeSource[], onChange: (isActive: () => boolean) => unknown, { debounceMs = 300, immediate = false, enabled = true }: RealtimeOptions = {}) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });

  const key = sourcesKey(sources);

  useEffect(() => {
    if (!enabled) return;
    const list = parseSourcesKey(key);
    let alive = true;
    const isActive = () => alive;
    const run = () => {
      void callback.current(isActive);
    };
    const debounced = createDebouncer(run, debounceMs);
    if (immediate) run();
    if (list.length === 0)
      return () => {
        alive = false;
        debounced.cancel();
      };
    let channel = supabase.channel(uniqueChannelName(list));
    for (const s of list) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: s.table, ...(s.filter ? { filter: s.filter } : {}) }, debounced.call);
    }
    channel.subscribe();
    return () => {
      alive = false;
      debounced.cancel();
      supabase.removeChannel(channel);
    };
  }, [key, debounceMs, immediate, enabled]);
}

