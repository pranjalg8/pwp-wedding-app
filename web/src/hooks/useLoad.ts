import { useEffect, useRef } from 'react';

// Run a load once when the component mounts, and again whenever `key` changes. The latest `load` is always the one
// called, so callers can pass an inline function. `isActive()` turns false once the component unmounts or the key
// changes, to guard setState after an await. Use useRealtime instead when the view should also follow table changes.
export function useLoad(load: (isActive: () => boolean) => unknown, key: string | number | null = null) {
  const fn = useRef(load);
  useEffect(() => {
    fn.current = load;
  });
  useEffect(() => {
    let alive = true;
    void fn.current(() => alive);
    return () => {
      alive = false;
    };
  }, [key]);
}
