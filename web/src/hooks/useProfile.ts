import { useContext } from 'react';
import { AuthContext } from './authContext';

export type { Profile } from './authContext';

// The signed-in person's profile, loaded once by AuthProvider and shared by every caller.
export function useProfile() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useProfile must be used inside <AuthProvider>');
  return { profile: ctx.profile, loading: ctx.profileLoading };
}
