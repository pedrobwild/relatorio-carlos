import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectRouteTransitionProps {
  children: ReactNode;
  /**
   * Optional scroll target. When provided, the transition resets that
   * element's scrollTop on route change. Falls back to window scroll.
   */
  scrollTargetRef?: React.RefObject<HTMLElement>;
}

/** Minimum time the skeleton stays visible — avoids a flicker on fast swaps. */
const SKELETON_MIN_MS = 160;

function RouteSkeleton() {
  return (
    <div
      className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 animate-fade-in"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-40 rounded-md" />
      <Skeleton className="h-4 w-64 rounded" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/**
 * Lightweight per-route transition + scroll restoration for project pages.
 *
 * Goals (mobile-first):
 * - Keep the user "in the obra": never leave a tab scrolled where the
 *   previous tab was, which makes the next tab feel broken/empty.
 * - Show a short skeleton during the swap so the user never sees the old
 *   page suddenly replaced by half-mounted content "jumping" into place.
 * - Respect `prefers-reduced-motion`: skip the fade, keep the scroll reset
 *   and the skeleton (the skeleton is structural, not motion).
 */
export function ProjectRouteTransition({
  children,
  scrollTargetRef,
}: ProjectRouteTransitionProps) {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;

    // Reset every plausible scroll container so we never leave the user
    // looking at the previous tab's scroll position. Mobile (client) scrolls
    // the document; staff scrolls <main>; some pages own a nested scroll
    // container (e.g. Gantt, embedded budget) and can opt in via
    // [data-scroll-container].
    const resetScroll = (el: Element | Window | null | undefined) => {
      if (!el) return;
      try {
        (el as { scrollTo: typeof window.scrollTo }).scrollTo({
          top: 0,
          left: 0,
          behavior: "auto",
        });
      } catch {
        // Some elements expose scrollTop but not scrollTo.
        if ("scrollTop" in (el as HTMLElement)) {
          (el as HTMLElement).scrollTop = 0;
          (el as HTMLElement).scrollLeft = 0;
        }
      }
    };

    if (typeof window !== "undefined") {
      resetScroll(window);
      resetScroll(document.scrollingElement);
      resetScroll(document.documentElement);
      resetScroll(document.body);
    }
    resetScroll(scrollTargetRef?.current);
    if (typeof document !== "undefined") {
      document
        .querySelectorAll<HTMLElement>("[data-scroll-container]")
        .forEach(resetScroll);
    }

    // Show a short skeleton so the next route paints over a stable placeholder
    // instead of letting partial content shift into view.
    setIsSwapping(true);
    const timer = window.setTimeout(
      () => setIsSwapping(false),
      SKELETON_MIN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [location.pathname, scrollTargetRef]);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (isSwapping) {
    return <RouteSkeleton />;
  }

  return (
    <div
      key={location.pathname}
      className={reduceMotion ? undefined : "animate-fade-in"}
    >
      {children}
    </div>
  );
}
