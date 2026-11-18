import { useState } from 'react';
import { useRealtime } from './useRealtime';
import { supabase } from '../lib/supabase';
import { DEFAULT_FACTS, factsFromRows, type PlanFacts } from '../lib/planFacts';

// The shared plan values (dates, honeymoon budget cap, chosen route), read from the named planner items
// (planning_items.slug) so every page shows the same thing. Stays live when either of you edits one.
export function usePlanFacts() {
  const [facts, setFacts] = useState<PlanFacts>(DEFAULT_FACTS);

  useRealtime(
    ['planning_items'],
    async (isActive) => {
      const { data } = await supabase.from('planning_items').select('slug, amount, metadata').not('slug', 'is', null);
      if (isActive() && data) setFacts(factsFromRows(data));
    },
    { immediate: true }
  );

  return facts;
}
