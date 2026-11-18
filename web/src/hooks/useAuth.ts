import { useContext } from 'react';
import { AuthContext } from './authContext';

// The current session, from the single AuthProvider mounted in main.tsx.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return { session: ctx.session, loading: ctx.loading, user: ctx.user };
}
