import { useEffect, useRef } from 'react';

/**
 * Runs `initializer` exactly once, when `ready` becomes true.
 *
 * Used to hydrate a local form state from server data without ever
 * overwriting subsequent user edits when the underlying query refetches
 * (e.g. realtime invalidations, window focus, cache busts).
 *
 * Returns a ref that callers can read to know whether initialization
 * has completed.
 */
export function useInitializeOnce(ready: boolean, initializer: () => void) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!ready) return;
    initializer();
    initializedRef.current = true;
    // initializer is intentionally not in deps: we only want to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return initializedRef;
}
