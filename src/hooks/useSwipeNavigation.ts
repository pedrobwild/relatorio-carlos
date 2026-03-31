import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX_Y = 80;

/**
 * Detects horizontal swipe gestures and navigates between ordered routes.
 * Only active on mobile viewports (< 768px).
 */
export function useSwipeNavigation(routes: string[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleSwipe = useCallback(
    (deltaX: number) => {
      const currentIndex = routes.findIndex((r) => location.pathname.startsWith(r));
      if (currentIndex === -1) return;

      if (deltaX < -SWIPE_THRESHOLD && currentIndex < routes.length - 1) {
        navigate(routes[currentIndex + 1]);
      } else if (deltaX > SWIPE_THRESHOLD && currentIndex > 0) {
        navigate(routes[currentIndex - 1]);
      }
    },
    [routes, location.pathname, navigate]
  );

  useEffect(() => {
    // Only on mobile
    if (window.innerWidth >= 768) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      const deltaX = t.clientX - touchStart.current.x;
      const deltaY = Math.abs(t.clientY - touchStart.current.y);
      touchStart.current = null;

      // Only trigger if horizontal movement dominates
      if (deltaY < SWIPE_MAX_Y) {
        handleSwipe(deltaX);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleSwipe]);
}
