import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createLiveLoader, type LiveState } from '../lib/liveData';

// Loads planner data and keeps it fresh while any of the tables changes. `loadError` is set when the latest load
// failed; the last good data stays on screen. Show it with <LoadError />. Build `load` with rowsOf and oneOf, so a
// failed query counts as a failure. The realtime check reads the `tables` list, so keep it a plain list of names.
export function useLiveData<T>({ tables, load, initial }: { tables: readonly string[]; load: () => Promise<T>; initial: T }) {
  const [state, setState] = useState<LiveState<T>>({ data: initial, loaded: false, error: null });
  const channelName = `live_${useId()}`;
  const latestLoad = useRef(load);
  const loader = useRef<ReturnType<typeof createLiveLoader<T>> | null>(null);
  const tableList = tables.join(',');

  useEffect(() => {
    latestLoad.current = load;
  });

  useEffect(() => {
    const live = createLiveLoader<T>(() => latestLoad.current(), setState);
    loader.current = live;
    void live.run();
    let channel = supabase.channel(channelName);
    for (const table of tableList.split(',').filter(Boolean)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => void live.run());
    }
    channel.subscribe();
    return () => {
      live.stop();
      supabase.removeChannel(channel);
    };
  }, [channelName, tableList]);

  const reload = useCallback(async () => {
    await loader.current?.run();
  }, []);

  return { data: state.data, loaded: state.loaded, loadError: state.error, reload };
}
