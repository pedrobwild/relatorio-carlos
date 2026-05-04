import { useEffect, useRef, type RefObject } from "react";

export type ScopedSwipeOptions = {
  ref: RefObject<HTMLElement | null>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal travel in px (default 120). */
  threshold?: number;
  /** Minimum velocity in px/ms (default 0.4). */
  minVelocity?: number;
  /** Distance from each edge (in px) where gestures are ignored (default 24). Avoids conflicting with iOS edge-swipe. */
  edgeIgnore?: number;
  /** Maximum vertical travel ratio relative to horizontal (default 0.6). Above this the gesture is treated as a scroll. */
  maxVerticalRatio?: number;
  /** When this returns true, the listener short-circuits (e.g. dialog open). */
  disableWhen?: () => boolean;
};

/**
 * Scoped swipe gesture hook.
 *
 * Listens only on `ref.current` (not the document). Designed for carousels and
 * inline tabs — never for cross-route navigation. Honors `[data-no-swipe]` on
 * any ancestor of the touch target.
 */
export function useScopedSwipe({
  ref,
  onSwipeLeft,
  onSwipeRight,
  threshold = 120,
  minVelocity = 0.4,
  edgeIgnore = 24,
  maxVerticalRatio = 0.6,
  disableWhen,
}: ScopedSwipeOptions): void {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!onSwipeLeft && !onSwipeRight) return;

    const onTouchStart = (e: TouchEvent) => {
      if (disableWhen?.()) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-no-swipe]")) return;

      const t = e.touches[0];
      const w = window.innerWidth;
      if (t.clientX <= edgeIgnore || t.clientX >= w - edgeIgnore) return;

      start.current = { x: t.clientX, y: t.clientY, t: e.timeStamp };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      if (disableWhen?.()) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = Math.abs(t.clientY - s.y);
      const dt = Math.max(1, e.timeStamp - s.t);

      if (Math.abs(dx) < threshold) return;
      if (dy / Math.max(1, Math.abs(dx)) > maxVerticalRatio) return;
      if (Math.abs(dx) / dt < minVelocity) return;

      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };

    const onTouchCancel = () => {
      start.current = null;
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [ref, onSwipeLeft, onSwipeRight, threshold, minVelocity, edgeIgnore, maxVerticalRatio, disableWhen]);
}
