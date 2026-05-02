import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFullscreenSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer (ex.: ações primárias). Sobre safe-area inferior. */
  footer?: React.ReactNode;
  /** Variante do botão de fechar — `back` (←) sugere "voltar para a lista". */
  closeVariant?: "back" | "x";
  /** Aria-label do botão de fechar. */
  closeAriaLabel?: string;
  /** Classe extra para o body. */
  bodyClassName?: string;
}

/**
 * MobileFullscreenSheet — modal full-screen mobile-first.
 *
 * Substitui o Dialog desktop centralizado para formulários densos no
 * mobile. Usa o Dialog primitive do Radix (focus trap, Esc para fechar,
 * retorno de foco ao disparador) com layout 100dvh + header/footer
 * sticky e safe areas.
 *
 * - Header respeita pt-safe; título e descrição ficam em coluna, com
 *   `truncate`/`line-clamp` para nunca cortar elementos críticos.
 * - Body rola; rodapé sticky com `pb-safe` para iOS home indicator.
 * - Botão "voltar" (default) ou "fechar" — voltar é a metáfora correta
 *   para uma página dedicada vinda de uma listagem.
 */
export function MobileFullscreenSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeVariant = "back",
  closeAriaLabel = "Fechar",
  bodyClassName,
}: MobileFullscreenSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-modal bg-black/40",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-modal-content flex flex-col bg-background",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "duration-200",
          )}
        >
          <header
            className={cn(
              "shrink-0 sticky top-0 z-shell bg-background/95 backdrop-blur",
              "border-b border-border-subtle pt-safe",
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 min-h-[56px] pl-safe pr-safe">
              <DialogPrimitive.Close
                aria-label={closeAriaLabel}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-full",
                  "text-foreground hover:bg-muted active:bg-muted/80",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {closeVariant === "back" ? (
                  <ArrowLeft className="h-5 w-5" />
                ) : (
                  <X className="h-5 w-5" />
                )}
              </DialogPrimitive.Close>

              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[15px] font-semibold text-foreground leading-tight truncate">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-[12px] text-muted-foreground leading-tight line-clamp-1">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>
          </header>

          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
              "pl-safe pr-safe",
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer && (
            <div
              className={cn(
                "shrink-0 sticky bottom-0 z-shell",
                "border-t border-border-subtle bg-background/95 backdrop-blur",
                "pb-safe pl-safe pr-safe",
              )}
            >
              <div className="px-4 py-3">{footer}</div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
