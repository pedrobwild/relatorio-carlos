import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectRouteTransitionProps {
  children: ReactNode;
  /**
   * Optional scroll target. When provided, the transition manages that
   * element's scroll. Falls back to window scroll.
   */
  scrollTargetRef?: React.RefObject<HTMLElement>;
}

/** Minimum time the skeleton stays visible — avoids a flicker on fast swaps. */
const SKELETON_MIN_MS = 160;

/** Throttle for scroll-save so we don't thrash on momentum scrolls. */
const SAVE_THROTTLE_MS = 80;

/** Per-route scroll snapshot. Top values for every plausible container. */
type ScrollSnapshot = {
  win: number;
  target: number;
  containers: Record<string, number>;
};

/**
 * Shared in-memory store. Lives at module scope so it survives unmounts of
 * the transition wrapper (e.g. when ProjectShell remounts on project switch).
 * Keyed by full pathname so each tab inside an obra has its own slot.
 */
const scrollPositions = new Map<string, ScrollSnapshot>();

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

function getContainerKey(el: HTMLElement, index: number): string {
  return el.dataset.scrollContainer || `container-${index}`;
}

function captureScroll(target: HTMLElement | null | undefined): ScrollSnapshot {
  const containers: Record<string, number> = {};
  if (typeof document !== "undefined") {
    document
      .querySelectorAll<HTMLElement>("[data-scroll-container]")
      .forEach((el, i) => {
        containers[getContainerKey(el, i)] = el.scrollTop;
      });
  }
  return {
    win: typeof window !== "undefined" ? window.scrollY : 0,
    target: target?.scrollTop ?? 0,
    containers,
  };
}

function applyScroll(
  snapshot: ScrollSnapshot | null,
  target: HTMLElement | null | undefined,
) {
  // null snapshot means "reset to top".
  const top = snapshot?.win ?? 0;
  const targetTop = snapshot?.target ?? 0;
  const containers = snapshot?.containers ?? {};

  try {
    window.scrollTo({ top, left: 0, behavior: "auto" });
  } catch {
    if (document.scrollingElement) {
      (document.scrollingElement as HTMLElement).scrollTop = top;
    }
  }
  if (target) target.scrollTop = targetTop;
  if (typeof document !== "undefined") {
    document
      .querySelectorAll<HTMLElement>("[data-scroll-container]")
      .forEach((el, i) => {
        const key = getContainerKey(el, i);
        el.scrollTop = containers[key] ?? 0;
      });
  }
}

/**
 * Per-route scroll restoration + lightweight transition for project pages.
 *
 * Behavior:
 * - PUSH/REPLACE navigation (user taps a tab, opens a link): reset every
 *   plausible scroll container to top. Forward navigation should never land
 *   mid-scroll on the previous tab's position.
 * - POP navigation (browser/system back): restore the snapshot we saved
 *   the last time the user left this exact pathname. Mirrors the native
 *   browser experience users already expect.
 * - During the swap, render a short skeleton so the user never sees content
 *   "jump" into place; the scroll position is applied after the new route
 *   paints (next rAF) so React has measured the layout first.
 * - Respects `prefers-reduced-motion`: skips the fade, keeps the skeleton
 *   and the scroll behavior (structural, not motion).
 */
export function ProjectRouteTransition({
  children,
  scrollTargetRef,
}: ProjectRouteTransitionProps) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const trackedPathRef = useRef<string>(location.pathname);
  const [isSwapping, setIsSwapping] = useState(false);

  // Continuously snapshot the current route's scroll positions so we have
  // an up-to-date value the moment the user navigates away.
  useEffect(() => {
    let lastSave = Number.NEGATIVE_INFINITY;
    const save = () => {
      const now = Date.now();
      if (now - lastSave < SAVE_THROTTLE_MS) return;
      lastSave = now;
      scrollPositions.set(
        trackedPathRef.current,
        captureScroll(scrollTargetRef?.current),
      );
    };

    window.addEventListener("scroll", save, { passive: true });
    const target = scrollTargetRef?.current;
    target?.addEventListener("scroll", save, { passive: true });
    const containerEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scroll-container]"),
    );
    containerEls.forEach((el) =>
      el.addEventListener("scroll", save, { passive: true }),
    );

    return () => {
      window.removeEventListener("scroll", save);
      target?.removeEventListener("scroll", save);
      containerEls.forEach((el) => el.removeEventListener("scroll", save));
    };
  }, [scrollTargetRef, location.pathname]);

  // Handle the actual route swap: save outgoing position, decide whether
  // to restore or reset on the incoming route.
  useEffect(() => {
    if (trackedPathRef.current === location.pathname) return;

    // Save the outgoing route's final scroll, in case the throttle skipped
    // the very last user scroll event.
    scrollPositions.set(
      trackedPathRef.current,
      captureScroll(scrollTargetRef?.current),
    );
    trackedPathRef.current = location.pathname;

    const saved =
      navigationType === "POP"
        ? (scrollPositions.get(location.pathname) ?? null)
        : null;

    setIsSwapping(true);
    const timer = window.setTimeout(() => {
      setIsSwapping(false);
      // Defer one tick so React commits the new content before we set
      // scroll, otherwise the target may be too short to hold the value.
      window.setTimeout(
        () => applyScroll(saved, scrollTargetRef?.current),
        0,
      );
    }, SKELETON_MIN_MS);

    return () => window.clearTimeout(timer);
  }, [location.pathname, navigationType, scrollTargetRef]);

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

/** Test-only helper to reset the module-level store between specs. */
export function __resetScrollPositionsForTests() {
  scrollPositions.clear();
}
