import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type Profile = { id: string; email: string; display_name: string };

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user]);

  return { profile, loading };
}
