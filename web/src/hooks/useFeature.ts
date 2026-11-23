import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from './useProfile';

const cache = new Map<string, boolean>();

// Whether the signed-in profile has been granted a feature (rows in feature_access; RLS shows only your own).
export function useFeature(feature: string): boolean {
  const { profile } = useProfile();
  const key = `${profile?.id}:${feature}`;
  const [has, setHas] = useState(() => cache.get(key) ?? false);

  useEffect(() => {
    if (!profile) return;
    let live = true;
    supabase
      .from('feature_access')
      .select('feature')
      .eq('profile_id', profile.id)
      .eq('feature', feature)
      .maybeSingle()
      .then(({ data }) => {
        cache.set(key, Boolean(data));
        if (live) setHas(Boolean(data));
      });
    return () => {
      live = false;
    };
  }, [profile, feature, key]);

  return has;
}
