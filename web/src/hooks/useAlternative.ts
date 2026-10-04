import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AltRow } from '../data/alternativePlan';

// Returns the alternative plan the signed-in person has been granted access to, or null.
// Access is enforced by row-level security in the database, so nothing is returned (and nothing
// is shown in the UI) for people without a grant.
export function useAlternative() {
  const [plan, setPlan] = useState<AltRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('trip_alternatives')
      .select('key, label, data')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPlan((data as AltRow | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { plan, loading };
}
