import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export type Profile = { id: string; email: string; display_name: string };

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
};

// Filled by AuthProvider (mounted once in main.tsx). The default only applies outside the provider.
export const AuthContext = createContext<AuthState | null>(null);
