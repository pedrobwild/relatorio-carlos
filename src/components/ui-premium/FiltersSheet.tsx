import { type ReactNode } from 'react';
import { Filter } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FiltersSheetProps {
  /** Number of active filters — drives both the badge and the trigger label. */
  activeCount: number;
  /** Filter controls rendered inside the sheet body. */
  children: ReactNode;
  onClear: () => void;
  onApply?: () => void;
  /** Custom title; defaults to "Filtros". */
  title?: string;
  /** Optional className applied to the trigger chip. */
  triggerClassName?: string;
}

/**
 * Bottom sheet hosting list filters on mobile. Trigger is a single chip
 * ("Filtros (n)") that replaces the row of inline selects/inputs the page
 * used to render.
 */
export function FiltersSheet({
  activeCount,
  children,
  onClear,
  onApply,
  title = 'Filtros',
  triggerClassName,
}: FiltersSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-9 min-h-[36px] rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors',
            activeCount > 0 && 'border-primary/40 bg-primary/5 text-primary',
            triggerClassName
          )}
          aria-label={
            activeCount > 0
              ? `Filtros (${activeCount} ativos)`
              : 'Filtros (nenhum ativo)'
          }
        >
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Filtros</span>
          {activeCount > 0 && (
            <span className="tabular-nums text-[11px] font-semibold bg-primary/15 rounded-full px-1.5 min-w-[20px] text-center">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-safe max-h-[85dvh] flex flex-col"
      >
        <SheetHeader className="text-left shrink-0">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4">{children}</div>

        <div
          className={cn(
            'shrink-0 flex items-center gap-2 pt-3 border-t border-border/60',
            'sticky bottom-0 bg-background'
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="flex-1"
            disabled={activeCount === 0}
          >
            Limpar filtros
          </Button>
          {onApply && (
            <Button type="button" onClick={onApply} className="flex-1">
              Aplicar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
