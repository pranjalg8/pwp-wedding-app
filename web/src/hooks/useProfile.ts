import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type Profile = { id: string; email: string; display_name: string };

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Depend on the id, not the user object: the sign-in library hands out a fresh object every time it quietly
  // renews the session (when the window regains focus, about hourly), and reloading the profile for that
  // showed the loading screen and remounted the whole app, which put edit mode back to locked.
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile(data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { profile, loading };
}
