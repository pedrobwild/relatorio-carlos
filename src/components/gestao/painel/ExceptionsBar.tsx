/**
 * ExceptionsBar — faixa de exceções cross-domain do Painel de Obras.
 *
 * Chips clicáveis (cada um representa um Set de `project_id`). Clique alterna
 * o filtro via URL param `?excecao=`. Contadores em 0 ficam esmaecidos e não
 * clicáveis. Complementa o MetricRail existente (que cobre status internos
 * das obras) — sem duplicar contadores.
 */
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, FileSignature, Receipt, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExcecaoKind } from "@/hooks/usePainelExcecoes";

interface Chip {
  kind: ExcecaoKind;
  label: string;
  icon: typeof AlertTriangle;
  hint: string;
}

const CHIPS: Chip[] = [
  {
    kind: "nc",
    label: "NCs críticas",
    icon: AlertTriangle,
    hint: "Não conformidades críticas abertas",
  },
  {
    kind: "form",
    label: "Formalizações paradas",
    icon: FileSignature,
    hint: "Aguardando assinatura há mais de 5 dias úteis",
  },
  {
    kind: "pag",
    label: "Faturas vencidas",
    icon: Receipt,
    hint: "Pagamentos com vencimento passado",
  },
  {
    kind: "atv",
    label: "Atividades sem responsável",
    icon: UserX,
    hint: "Próximos 14 dias sem responsável definido",
  },
];

interface Props {
  counts: Record<ExcecaoKind, number>;
  isLoading?: boolean;
}

export function ExceptionsBar({ counts, isLoading }: Props) {
  const [params, setParams] = useSearchParams();
  const active = params.get("excecao") as ExcecaoKind | null;

  const toggle = (kind: ExcecaoKind, disabled: boolean) => {
    if (disabled) return;
    const next = new URLSearchParams(params);
    if (active === kind) next.delete("excecao");
    else next.set("excecao", kind);
    setParams(next, { replace: true });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-3"
      role="group"
      aria-label="Exceções do painel"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
        Exceções
      </span>
      {CHIPS.map((chip) => {
        const count = counts[chip.kind];
        const isActive = active === chip.kind;
        const disabled = !isLoading && count === 0;
        const Icon = chip.icon;
        return (
          <button
            key={chip.kind}
            type="button"
            onClick={() => toggle(chip.kind, disabled)}
            disabled={disabled}
            aria-pressed={isActive}
            title={chip.hint}
            className={cn(
              "inline-flex items-center gap-1.5 h-11 md:h-8 px-3 rounded-md border text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "border-primary bg-primary/10 text-foreground"
                : disabled
                  ? "border-border-subtle bg-surface text-muted-foreground/50 cursor-not-allowed"
                  : "border-border-subtle bg-surface text-foreground/80 hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isActive ? "text-primary" : "opacity-70",
              )}
              aria-hidden
            />
            <span>{chip.label}</span>
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-semibold tabular-nums",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : disabled
                    ? "bg-muted/50 text-muted-foreground/60"
                    : "bg-muted text-foreground/80",
              )}
            >
              {isLoading ? "…" : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
