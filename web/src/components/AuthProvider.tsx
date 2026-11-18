import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthState, type Profile } from '../hooks/authContext';

// The session and the signed-in person's profile, loaded once for the whole app. useAuth() and useProfile()
// read from here, so a dozen components asking for the profile cost one auth listener and one query.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedProfile, setLoadedProfile] = useState<{ userId: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Depend on the id, not the user object: the sign-in library hands out a fresh object every time it quietly
  // renews the session (when the window regains focus, about hourly), and reloading the profile for that
  // showed the loading screen and remounted the whole app, which put edit mode back to locked.
  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLoadedProfile({ userId, profile: data });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const profileReady = !userId || loadedProfile?.userId === userId;
  const profile = userId && loadedProfile?.userId === userId ? loadedProfile.profile : null;
  const profileLoading = loading || !profileReady;

  const value = useMemo<AuthState>(
    () => ({ session, user, loading, profile, profileLoading }),
    [session, user, loading, profile, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
