import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AltRow } from '../data/alternativePlan';

// Plans are cached for the session so switching tabs does not flash the wrong destination. The cache is
// dropped on sign-out so another person signing in on the same browser never sees it.
let cache: AltRow[] | null = null;
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') cache = null;
});

// Returns every alternative plan the signed-in person has been granted access to (possibly none).
// Access is enforced by row-level security in the database, so nothing is returned (and nothing
// is shown in the UI) for people without a grant.
export function useAlternatives() {
  const [plans, setPlans] = useState<AltRow[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('trip_alternatives')
      .select('key, label, data')
      .order('key')
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data as AltRow[] | null) ?? [];
        cache = rows;
        setPlans(rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, loading };
}
