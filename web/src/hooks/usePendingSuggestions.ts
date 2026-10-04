import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePendingSuggestions() {
  const [count, setCount] = useState(0);
  const channelName = useRef(`suggestions_pending_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let active = true;
    async function load() {
      const { count: n } = await supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (active) setCount(n ?? 0);
    }
    load();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestions' }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
