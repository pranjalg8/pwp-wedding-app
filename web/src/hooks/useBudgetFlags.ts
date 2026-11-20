import { useCallback, useState } from 'react';
import { useRealtime } from './useRealtime';
import { supabase } from '../lib/supabase';
import type { Severity, FlagTable } from '../../../supabase/functions/budget-review/checks';

// What the budget review agent has recorded (see supabase/functions/budget-review). Kept live.
export type StoredFlag = {
  id: string;
  fingerprint: string;
  code: string;
  severity: Severity;
  source_table: FlagTable;
  row_id: string | null;
  label: string;
  message: string;
  question: string | null;
  status: 'open' | 'confirmed' | 'dismissed' | 'resolved';
  decided_at: string | null;
  decision_note: string | null;
};

export function useBudgetFlags() {
  const [flags, setFlags] = useState<StoredFlag[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error } = await supabase
      .from('budget_flags')
      .select('id, fingerprint, code, severity, source_table, row_id, label, message, question, status, decided_at, decision_note')
      .neq('status', 'resolved');
    if (!isActive()) return;
    // Not deployed yet, or a failed load: show nothing stored and let the page's own live checks carry on.
    if (!error) setFlags((data ?? []) as StoredFlag[]);
    setLoaded(true);
  }, []);

  useRealtime(['budget_flags'], load, { immediate: true });
  return { flags, loaded, reload: useCallback(() => load(() => true), [load]) };
}
