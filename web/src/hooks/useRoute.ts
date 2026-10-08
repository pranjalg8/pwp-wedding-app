import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { OPTIONS } from '../data/travelOptions';
import { useEditMode } from './useEditMode';
import { usePlanFacts } from './usePlanFacts';

// The chosen honeymoon route is a shared setting (planner item "honeymoon.route"). Picking a route while edit
// mode is locked only previews it on this screen; unlock edit mode to make it the plan for both of you.
export function useRoute() {
  const { routeId: dbId, budgetCap } = usePlanFacts();
  const { isUnlocked } = useEditMode();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const chosenId = OPTIONS.some((o) => o.id === dbId) ? dbId : OPTIONS[0].id;
  const routeId = previewId && OPTIONS.some((o) => o.id === previewId) ? previewId : chosenId;

  async function select(id: string) {
    if (!OPTIONS.some((o) => o.id === id)) return;
    if (!isUnlocked) {
      setPreviewId(id === chosenId ? null : id);
      return;
    }
    setPreviewId(null);
    const { error } = await supabase.from('planning_items').update({ metadata: { value: id } }).eq('slug', 'honeymoon.route');
    if (error) setPreviewId(id);
  }

  return { routeId, chosenId, isPreview: routeId !== chosenId, select, budgetCap };
}
