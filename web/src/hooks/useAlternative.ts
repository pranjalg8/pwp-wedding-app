import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AltRow } from '../data/alternativePlan';

// Returns every alternative plan the signed-in person has been granted access to (possibly none).
// Access is enforced by row-level security in the database, so nothing is returned (and nothing
// is shown in the UI) for people without a grant.
export function useAlternatives() {
  const [plans, setPlans] = useState<AltRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('trip_alternatives')
      .select('key, label, data')
      .order('key')
      .then(({ data }) => {
        if (cancelled) return;
        setPlans((data as AltRow[] | null) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, loading };
}
