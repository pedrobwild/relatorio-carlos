import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface MobileFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Conteúdo do painel — grupos de filtros, escolhas etc. */
  children: ReactNode;
  /** Quantidade de filtros ativos (mostra badge no título). */
  activeCount?: number;
  /** Callback para limpar todos os filtros. */
  onClear?: () => void;
  /** Label do botão "aplicar". Default: "Ver resultados". */
  applyLabel?: string;
  /** Disabilita o botão de aplicar (ex.: enquanto carrega). */
  applyDisabled?: boolean;
  /** Classe extra para o body da sheet. */
  bodyClassName?: string;
}

/**
 * MobileFiltersSheet — bottom sheet com filtros para listagens mobile.
 *
 * Reaproveita `Sheet` (Radix Dialog) com `side="bottom"` e cabeçalho/
 * rodapé sticky. Concentra todos os filtros em um único ponto, evitando
 * que chips e selects ocupem o topo da listagem em telas pequenas.
 */
export function MobileFiltersSheet({
  open,
  onOpenChange,
  children,
  activeCount = 0,
  onClear,
  applyLabel = "Ver resultados",
  applyDisabled,
  bodyClassName,
}: MobileFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-3xl pt-7 px-0 pb-0 max-h-[88dvh]",
          "flex flex-col gap-0",
        )}
      >
        <SheetHeader className="px-5 pb-3 border-b border-border-subtle text-left shrink-0">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-base font-bold text-foreground">
              Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
            </SheetTitle>
            {onClear && activeCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </SheetHeader>

        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5",
            bodyClassName,
          )}
        >
          {children}
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-border-subtle pb-safe",
            "px-4 py-3",
          )}
        >
          <SheetClose asChild>
            <Button
              type="button"
              size="lg"
              disabled={applyDisabled}
              className="w-full h-12 text-sm font-semibold"
            >
              {applyLabel}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
