import { forwardRef, useCallback, useRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export interface PrefetchLinkProps extends LinkProps {
  /**
   * Callback fired once on the first hover/focus/touch.
   * Use it to call `queryClient.prefetchQuery(...)` for the destination route.
   */
  prefetch?: () => void | Promise<unknown>;
}

/**
 * `<Link>` wrapper that prefetches the destination's data on hover/focus/touch.
 * The `prefetch` callback is invoked at most once per mount.
 *
 * Use it in sidebars and navigation rails to make tab switching feel instant
 * (the data is already in the TanStack Query cache before the user clicks).
 */
export const PrefetchLink = forwardRef<HTMLAnchorElement, PrefetchLinkProps>(
  function PrefetchLink({ prefetch, onMouseEnter, onFocus, onTouchStart, ...rest }, ref) {
    const triggered = useRef(false);

    const trigger = useCallback(() => {
      if (triggered.current || !prefetch) return;
      triggered.current = true;
      try {
        const result = prefetch();
        if (result instanceof Promise) {
          result.catch(() => {
            // swallow — prefetch failures are not user-facing
          });
        }
      } catch {
        // swallow
      }
    }, [prefetch]);

    const handleMouseEnter: React.MouseEventHandler<HTMLAnchorElement> = e => {
      trigger();
      onMouseEnter?.(e);
    };
    const handleFocus: React.FocusEventHandler<HTMLAnchorElement> = e => {
      trigger();
      onFocus?.(e);
    };
    const handleTouchStart: React.TouchEventHandler<HTMLAnchorElement> = e => {
      trigger();
      onTouchStart?.(e);
    };

    return (
      <Link
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        onTouchStart={handleTouchStart}
        {...rest}
      />
    );
  },
);
