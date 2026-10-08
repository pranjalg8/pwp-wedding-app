import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_FACTS, factsFromRows, type PlanFacts } from '../lib/planFacts';

// The shared plan values (dates, honeymoon budget cap, chosen route), read from the named planner items
// (planning_items.slug) so every page shows the same thing. Stays live when either of you edits one.
export function usePlanFacts() {
  const [facts, setFacts] = useState<PlanFacts>(DEFAULT_FACTS);
  const channelName = useRef(`plan_facts_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.from('planning_items').select('slug, amount, metadata').not('slug', 'is', null);
      if (active && data) setFacts(factsFromRows(data));
    }
    load();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return facts;
}
