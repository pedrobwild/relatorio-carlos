/**
 * FilterPill — botão de filtro premium estilo Linear.
 *
 * Diferente de um SelectTrigger genérico, este componente:
 *  - mostra o label do filtro mesmo quando vazio (contexto)
 *  - destaca quando há valor aplicado (dot + cor primary)
 *  - mantém altura 32px (mais compacto que h-9 do shadcn padrão)
 *  - pareia bem com o PageToolbar (sem borda pesada)
 */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  label: string;
  value?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  /** Quando uso como Trigger do Select, não renderizamos o button externo */
  asChild?: boolean;
  children?: ReactNode;
}

export function FilterPill({
  label,
  value,
  active,
  onClick,
  className,
  children,
}: FilterPillProps) {
  if (children) {
    // permite <Select><FilterPill asChild>{children}</FilterPill></Select>
    return <>{children}</>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium",
        "border border-border-subtle bg-surface text-foreground/80",
        "transition-colors hover:bg-accent/50 hover:text-foreground hover:border-border",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active &&
          "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      {value && (
        <>
          <span className="opacity-30">·</span>
          <span className="font-semibold truncate max-w-[140px]">{value}</span>
        </>
      )}
      <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
    </button>
  );
}
