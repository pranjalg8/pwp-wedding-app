import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from './useRealtime';

export function usePendingSuggestions() {
  const [count, setCount] = useState(0);

  useRealtime(
    ['suggestions'],
    async (isActive) => {
      const { count: n } = await supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (isActive()) setCount(n ?? 0);
    },
    { immediate: true }
  );

  return count;
}
