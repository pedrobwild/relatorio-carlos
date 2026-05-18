import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

interface ProjectRouteTransitionProps {
  children: ReactNode;
  /**
   * Optional scroll target. When provided, the transition resets that
   * element's scrollTop on route change. Falls back to window scroll.
   */
  scrollTargetRef?: React.RefObject<HTMLElement>;
}

/**
 * Lightweight per-route transition + scroll restoration for project pages.
 *
 * Goals (mobile-first):
 * - Keep the user "in the obra": never leave a tab scrolled where the
 *   previous tab was, which makes the next tab feel broken/empty.
 * - Provide a short fade-in so tab swaps feel intentional, never jarring.
 * - Respect `prefers-reduced-motion`: skip the fade, keep the scroll reset.
 */
export function ProjectRouteTransition({
  children,
  scrollTargetRef,
}: ProjectRouteTransitionProps) {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;

    // Reset scroll on the actual scroll container.
    const target = scrollTargetRef?.current;
    if (target) {
      target.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.pathname, scrollTargetRef]);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      key={location.pathname}
      className={reduceMotion ? undefined : "animate-fade-in"}
    >
      {children}
    </div>
  );
}
