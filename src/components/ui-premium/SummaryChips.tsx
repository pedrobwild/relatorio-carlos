import { cn } from '@/lib/utils';

export type SummaryChip = {
  /** Stable identifier used as the chip's value when the row is interactive. */
  id: string;
  label: string;
  count: number;
  /** Visual accent applied when the chip is *active*. Defaults to the primary tone. */
  accent?: 'primary' | 'destructive' | 'warning' | 'success' | 'muted';
};

interface SummaryChipsProps {
  chips: SummaryChip[];
  /** Currently active chip id (for filter use). Pass `null` for non-interactive display. */
  activeId?: string | null;
  /** Toggle a chip; receives `null` when the user deselects the active chip. */
  onChange?: (id: string | null) => void;
  className?: string;
  /** Used as the parent's `aria-label` (e.g. "Filtrar formalizações"). */
  ariaLabel?: string;
}

const ACCENT_STYLES: Record<NonNullable<SummaryChip['accent']>, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  warning: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
  success: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  muted: 'bg-muted text-foreground border-border',
};

/**
 * Horizontal row of countable filter chips. Replaces stacked KPI cards on
 * mobile lists — one tap filters the underlying list to that bucket.
 *
 * - At most one chip is active at a time.
 * - Tapping the active chip clears the filter (`onChange(null)`).
 * - When `onChange` is omitted the chips render as read-only summary tiles.
 */
export function SummaryChips({
  chips,
  activeId = null,
  onChange,
  className,
  ariaLabel,
}: SummaryChipsProps) {
  const isInteractive = typeof onChange === 'function';

  return (
    <div
      role={isInteractive ? 'tablist' : undefined}
      aria-label={ariaLabel}
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-none -mx-3 px-3 pb-1',
        className
      )}
    >
      {chips.map((chip) => {
        const accent = chip.accent ?? 'primary';
        const isActive = activeId === chip.id;

        const baseStyles =
          'shrink-0 inline-flex items-center gap-1.5 px-3 h-9 min-h-[36px] rounded-full border text-xs font-medium transition-colors';
        const activeStyles = ACCENT_STYLES[accent];
        const inactiveStyles =
          'bg-card text-foreground border-border hover:bg-muted/60';

        const content = (
          <>
            <span className="truncate max-w-[160px]">{chip.label}</span>
            <span
              className={cn(
                'tabular-nums text-[11px] font-semibold rounded-full px-1.5 min-w-[20px] text-center',
                isActive ? 'bg-card/40' : 'bg-muted text-muted-foreground'
              )}
            >
              {chip.count}
            </span>
          </>
        );

        if (!isInteractive) {
          return (
            <span key={chip.id} className={cn(baseStyles, inactiveStyles)}>
              {content}
            </span>
          );
        }

        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(isActive ? null : chip.id)}
            className={cn(baseStyles, isActive ? activeStyles : inactiveStyles)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
