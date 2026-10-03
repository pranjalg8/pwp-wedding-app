import { createContext, useContext } from 'react';

export type EditModeContextValue = {
  isUnlocked: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
};

export const EditModeContext = createContext<EditModeContextValue | null>(null);

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error('useEditMode must be used within EditModeProvider');
  return ctx;
}
