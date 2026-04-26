import { useEffect, useRef } from 'react';

export type ScopedSwipeOptions = {
  /** Element to listen on. The hook attaches no listeners if `ref.current` is null. */
  ref: React.RefObject<HTMLElement>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance in px. Default 120. */
  threshold?: number;
  /** Minimum velocity in px/ms (|deltaX| / duration). Default 0.4. */
  minVelocity?: number;
  /**
   * Ignore gestures whose touchstart is within `edgeIgnore` px of the left or
   * right viewport edge. Prevents conflict with iOS edge-swipe back. Default 24.
   */
  edgeIgnore?: number;
  /**
   * Maximum vertical movement (px) tolerated before treating the gesture as
   * a vertical scroll instead of a swipe. Default 60.
   */
  maxVerticalDrift?: number;
  /**
   * If returns true at gesture end, the swipe is ignored. Use to suppress when
   * a dialog/sheet is open. Re-evaluated on each gesture, so you can pass an
   * inline lambda that reads current state.
   */
  disableWhen?: () => boolean;
};

const DATA_NO_SWIPE_ATTR = 'data-no-swipe';

function hasNoSwipeAncestor(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node) {
    if (node.nodeType === 1 && node.hasAttribute?.(DATA_NO_SWIPE_ATTR)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Listens for horizontal swipe gestures on a single element. Unlike a global
 * touch handler, this stays inside the scoped subtree, ignores small gestures,
 * respects iOS edge-swipe, and bails out under any element marked
 * `data-no-swipe`.
 *
 * Use for explicit carousels (photo galleries, declared internal tabs). Do not
 * use to navigate between top-level routes — that pattern is what
 * `useSwipeNavigation` (deprecated) caused accidental navigation for.
 */
export function useScopedSwipe(options: ScopedSwipeOptions) {
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = options.ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let active = false;

    const handleTouchStart = (event: TouchEvent) => {
      const opts = optsRef.current;
      const edgeIgnore = opts.edgeIgnore ?? 24;
      const touch = event.touches[0];
      if (!touch) return;

      const viewportWidth = window.innerWidth;
      if (touch.clientX <= edgeIgnore || touch.clientX >= viewportWidth - edgeIgnore) {
        active = false;
        return;
      }

      if (hasNoSwipeAncestor(event.target)) {
        active = false;
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      startTime = event.timeStamp || Date.now();
      active = true;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!active) return;
      active = false;

      const opts = optsRef.current;
      if (opts.disableWhen?.()) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      const duration = Math.max(1, (event.timeStamp || Date.now()) - startTime);
      const velocity = Math.abs(deltaX) / duration;

      const threshold = opts.threshold ?? 120;
      const minVelocity = opts.minVelocity ?? 0.4;
      const maxVerticalDrift = opts.maxVerticalDrift ?? 60;

      if (deltaY > maxVerticalDrift) return;
      if (Math.abs(deltaX) < threshold) return;
      if (velocity < minVelocity) return;

      if (deltaX < 0) opts.onSwipeLeft?.();
      else opts.onSwipeRight?.();
    };

    const handleTouchCancel = () => {
      active = false;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [options.ref]);
}
