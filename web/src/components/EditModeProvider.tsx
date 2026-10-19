import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { EditModeContext } from '../hooks/useEditMode';

// Edit mode is remembered on this device so a refresh, a new tab or moving between pages does not lock it again.
// It switches itself off after 30 minutes without any activity (every click or key press pushes that back),
// when you press Lock, or when you sign out. What is stored is only the time it runs out, never the PIN.
// The PIN is a guard against accidental edits; what the database lets you change is decided by your sign-in.
const KEY = 'pwp.editMode.until';
const IDLE_MS = 30 * 60 * 1000;
const EXTEND_EVERY_MS = 30 * 1000; // do not write to storage on every click

function readUntil(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > Date.now() ? v : 0;
  } catch {
    return 0; // storage blocked: edit mode just works for this page load
  }
}

function writeUntil(until: number) {
  try {
    if (until > 0) localStorage.setItem(KEY, String(until));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: nothing to remember
  }
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [until, setUntil] = useState<number>(readUntil);
  const isUnlocked = until > 0;
  const lastExtend = useRef(0);

  const lock = useCallback(() => {
    writeUntil(0);
    setUntil(0);
  }, []);

  const unlock = useCallback(
    async (pin: string) => {
      const { data, error } = await supabase.rpc('verify_pin', { input_pin: pin });
      if (error) {
        console.error('verify_pin failed:', error.message);
        return false;
      }
      if (data) {
        const next = Date.now() + IDLE_MS;
        lastExtend.current = Date.now();
        writeUntil(next);
        setUntil(next);
      } else {
        lock();
      }
      return !!data;
    },
    [lock]
  );

  // Lock at the moment it runs out.
  useEffect(() => {
    if (!until) return;
    const t = setTimeout(lock, Math.max(0, until - Date.now()));
    return () => clearTimeout(t);
  }, [until, lock]);

  // Any activity while unlocked pushes the 30 minutes back.
  useEffect(() => {
    if (!isUnlocked) return;
    function bump() {
      const now = Date.now();
      if (now - lastExtend.current < EXTEND_EVERY_MS) return;
      lastExtend.current = now;
      const next = now + IDLE_MS;
      writeUntil(next);
      setUntil(next);
    }
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    return () => {
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
    };
  }, [isUnlocked]);

  // Other tabs, and coming back to this one after a while (timers are slow in background tabs).
  useEffect(() => {
    function sync() {
      setUntil(readUntil());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === KEY || e.key === null) sync();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') sync();
    }
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Signing out ends edit mode.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') lock();
    });
    return () => data.subscription.unsubscribe();
  }, [lock]);

  return <EditModeContext.Provider value={{ isUnlocked, unlock, lock }}>{children}</EditModeContext.Provider>;
}
