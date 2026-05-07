import { useEffect } from "react";

let warned = false;

/**
 * @deprecated Cross-route swipe navigation is disabled by design.
 *
 * Listening on `document` with a low threshold causes accidental navigation in
 * PDF viewers, charts, sliders, and conflicts with iOS edge-swipe. This stub
 * preserves the type signature so legacy callers compile, but registers no
 * listeners.
 *
 * Use `useScopedSwipe` with a ref to the carousel/tabs element instead, and
 * mark non-swipeable zones with `data-no-swipe`.
 */
export function useSwipeNavigation(_routes: string[]): void {
  useEffect(() => {
    if (import.meta.env.DEV && !warned) {
      warned = true;
       
      console.warn(
        "[useSwipeNavigation] Deprecated. Cross-route swipe is disabled — use useScopedSwipe on a specific element instead.",
      );
    }
  }, []);
}
