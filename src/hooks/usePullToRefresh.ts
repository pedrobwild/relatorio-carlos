import { useEffect, useRef, useState, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Pull-to-refresh gesture for mobile.
 * Shows a visual indicator when pulling down from top of page.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current || !enabled) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0 && window.scrollY <= 0) {
        setPulling(true);
        setPullDistance(Math.min(diff * 0.5, threshold * 1.5));
      }
    },
    [enabled, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current || !pulling) {
      isDragging.current = false;
      setPulling(false);
      setPullDistance(0);
      return;
    }
    isDragging.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
  }, [pulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pulling, refreshing, pullDistance, threshold };
}
