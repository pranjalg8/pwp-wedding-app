import { useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { EditModeContext } from '../hooks/useEditMode';

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  async function unlock(pin: string) {
    const { data, error } = await supabase.rpc('verify_pin', { input_pin: pin });
    if (error) {
      console.error('verify_pin failed:', error.message);
      return false;
    }
    setIsUnlocked(!!data);
    return !!data;
  }

  function lock() {
    setIsUnlocked(false);
  }

  return (
    <EditModeContext.Provider value={{ isUnlocked, unlock, lock }}>
      {children}
    </EditModeContext.Provider>
  );
}
