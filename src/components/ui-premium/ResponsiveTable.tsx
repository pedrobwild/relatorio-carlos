import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResponsiveTableProps<T> {
  rows: T[];
  /**
   * Stable key for each row. Required: lists without keys cause React reconciliation
   * issues that show up as scroll resets and lost focus on mobile.
   */
  getRowKey: (row: T) => string;
  /**
   * Renders the desktop table. Receives the same `rows` reference. The caller
   * owns table chrome (`<Table>`, headers, row striping) — `ResponsiveTable`
   * does not impose a layout on desktop because each list page has different
   * column shapes.
   */
  desktop: (rows: T[]) => ReactNode;
  /** Per-row mobile card renderer. Wrapped in a tap target by the hook. */
  mobileRender: (row: T) => ReactNode;
  /** Tap handler; only meaningful on mobile (desktop rows handle this themselves). */
  onRowClick?: (row: T) => void;
  /** Rendered when `rows` is empty (both layouts). */
  emptyState?: ReactNode;
  className?: string;
  /**
   * Force a specific layout regardless of viewport width. Useful for tests and
   * for pages that always render the same layout (e.g. KPIs).
   */
  forceLayout?: 'desktop' | 'mobile';
}

/**
 * Switches between a desktop table and a mobile card list. Avoids horizontal
 * scrolling on small viewports by handing rendering off to `mobileRender`,
 * which produces a vertically-stacked card per row.
 *
 * Use for list pages whose desktop layout is a wide table. Pages that already
 * render a card list on mobile (e.g. PendenciaItemCard) don't need this — they
 * just gate visibility with Tailwind's responsive prefixes.
 */
export function ResponsiveTable<T>({
  rows,
  getRowKey,
  desktop,
  mobileRender,
  onRowClick,
  emptyState,
  className,
  forceLayout,
}: ResponsiveTableProps<T>) {
  const detectedMobile = useIsMobile();
  const isMobile = forceLayout ? forceLayout === 'mobile' : detectedMobile;

  if (rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  if (isMobile) {
    return (
      <div className={cn('flex flex-col gap-2', className)} role="list">
        {rows.map((row) => {
          const key = getRowKey(row);
          const card = mobileRender(row);
          if (!onRowClick) {
            return (
              <div key={key} role="listitem">
                {card}
              </div>
            );
          }
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              onClick={() => onRowClick(row)}
              className="text-left w-full active:scale-[0.99] transition-transform"
            >
              {card}
            </button>
          );
        })}
      </div>
    );
  }

  return <div className={className}>{desktop(rows)}</div>;
}
