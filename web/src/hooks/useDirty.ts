import { useState } from 'react';

// True once any of the values differ from what they were when the form first rendered.
// Editors are mounted fresh each time they open, so the first render is the starting point.
export function useDirty(values: unknown): boolean {
  const now = JSON.stringify(values);
  const [initial] = useState(now);
  return now !== initial;
}
