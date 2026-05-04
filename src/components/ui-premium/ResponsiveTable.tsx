import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileListItem } from "@/components/mobile/MobileListItem";
import { cn } from "@/lib/utils";

export interface ResponsiveTableMobileItem {
  id: string | number;
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "default" | "warning" | "destructive" | "success";
  onClick?: () => void;
  href?: string;
  showChevron?: boolean;
}

interface ResponsiveTableProps<T> {
  /** Source rows. */
  data: T[];
  /** Maps a row to the mobile-card representation. */
  mobileItem: (row: T) => ResponsiveTableMobileItem;
  /** Renders the desktop table — invoked unchanged at >=md. */
  renderDesktop: (rows: T[]) => React.ReactNode;
  /** Optional empty-state for both layouts. */
  emptyState?: React.ReactNode;
  /** Optional override of the mobile breakpoint behavior (testing). */
  forceMode?: "mobile" | "desktop";
  className?: string;
  mobileClassName?: string;
}

/**
 * ResponsiveTable — single source of truth for tabular data that needs to
 * collapse into a card list on mobile.
 *
 * - Desktop (>=md): renders the caller's existing `<Table>` untouched.
 * - Mobile (<md):  renders a vertical list of `MobileListItem` rows, derived
 *   from `mobileItem(row)`.
 *
 * The wrapper does not own filtering, sorting, or pagination — it only
 * decides which presentation to mount. Page-level state is preserved across
 * breakpoints (the same `data` array drives both).
 */
export function ResponsiveTable<T>({
  data,
  mobileItem,
  renderDesktop,
  emptyState,
  forceMode,
  className,
  mobileClassName,
}: ResponsiveTableProps<T>) {
  const isMobileDetected = useIsMobile();
  const isMobile = forceMode ? forceMode === "mobile" : isMobileDetected;

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  if (isMobile) {
    return (
      <ul
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          mobileClassName,
        )}
        data-component="responsive-table-mobile"
      >
        {data.map((row) => {
          const item = mobileItem(row);
          return (
            <li key={item.id}>
              <MobileListItem
                title={item.title}
                subtitle={item.subtitle}
                leading={item.leading}
                trailing={item.trailing}
                tone={item.tone}
                onClick={item.onClick}
                href={item.href}
                showChevron={item.showChevron ?? !!(item.onClick || item.href)}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return <div className={className}>{renderDesktop(data)}</div>;
}
