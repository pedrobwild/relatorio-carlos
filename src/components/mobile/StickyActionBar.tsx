import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Quando true, posiciona o bar acima da bottom navigation
   * (`bottom-cta`) — útil em páginas dentro de Shells com nav fixa.
   * Default: false (use dentro de full-screen sheets sem nav).
   */
  aboveBottomNav?: boolean;
}

/**
 * StickyActionBar — barra inferior fixa para ações primárias em mobile.
 *
 * Respeita `pb-safe`, fica acima do conteúdo (z-shell) e, opcionalmente,
 * acima da bottom navigation. Usar quando uma página/sheet precisa
 * preservar uma ação como "Salvar" sempre acessível, sem depender de
 * scroll até o footer ou modal centralizado no desktop.
 */
export function StickyActionBar({
  children,
  className,
  aboveBottomNav = false,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky z-shell border-t border-border-subtle bg-background/95 backdrop-blur",
        "pl-safe pr-safe pb-safe",
        aboveBottomNav ? "bottom-cta" : "bottom-0",
        className,
      )}
    >
      <div className="px-4 py-3 flex items-center gap-2">{children}</div>
    </div>
  );
}
