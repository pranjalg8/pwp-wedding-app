import { createContext, useContext } from 'react';

export type EditModeContextValue = {
  isUnlocked: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  /**
   * Run `onUnlocked` now if edit mode is on; otherwise open the PIN dialog and run it once the PIN is accepted.
   * Closing the dialog without a correct PIN drops the callback.
   */
  requestUnlock: (onUnlocked?: () => void) => void;
};

export const EditModeContext = createContext<EditModeContextValue | null>(null);

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error('useEditMode must be used within EditModeProvider');
  return ctx;
}
