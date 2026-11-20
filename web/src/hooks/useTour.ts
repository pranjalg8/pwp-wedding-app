import { createContext, useContext } from 'react';

export type TourContextValue = {
  /** Start the guided tour from the first stop. */
  start: () => void;
  active: boolean;
};

export const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
