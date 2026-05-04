import { useRef, useCallback } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
}

/**
 * Hook to detect long-press (touch hold) on mobile.
 * Returns handlers to attach to the target element.
 */
export function useLongPress({
  onLongPress,
  delay = 500,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    isLongPress: isLongPressRef,
  };
}
