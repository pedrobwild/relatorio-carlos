/**
 * WeightProgress — barra de validação da soma de pesos das atividades.
 *
 * Cockpit do Cronograma (Bloco 4): a soma dos `weight` de todas as
 * atividades de uma obra deve ser 100%. Sem isso, a curva S fica errada.
 *
 *   - 100%        → `success` ("Soma OK")
 *   - 95–99 / 101–105 → `warning` ("Quase lá — ajuste")
 *   - fora disso  → `danger`  ("Soma inválida")
 */
import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge, type StatusTone } from "@/components/ui-premium";
import { cn } from "@/lib/utils";

export interface WeightProgressProps {
  /** Soma de pesos atual (em pontos percentuais — escala 0-100). */
  total: number;
  /** Classe extra para o container externo. */
  className?: string;
}

interface State {
  tone: StatusTone;
  label: string;
  tooltip: string;
  fillClass: string;
}

function evaluate(total: number): State {
  if (total === 100) {
    return {
      tone: "success",
      label: "Soma OK",
      tooltip: "A soma dos pesos é exatamente 100%. Curva S calibrada.",
      fillClass: "bg-success",
    };
  }
  if ((total >= 95 && total < 100) || (total > 100 && total <= 105)) {
    return {
      tone: "warning",
      label: "Quase lá",
      tooltip:
        "A soma dos pesos está próxima de 100%. Ajuste para evitar distorção na curva S.",
      fillClass: "bg-warning",
    };
  }
  return {
    tone: "danger",
    label: "Soma inválida",
    tooltip:
      "A soma dos pesos precisa ser 100%. Valores muito acima ou abaixo distorcem a curva S e o avanço financeiro.",
    fillClass: "bg-destructive",
  };
}

export function WeightProgress({ total, className }: WeightProgressProps) {
  const state = useMemo(() => evaluate(total), [total]);
  const clamped = Math.max(0, Math.min(120, total));
  // Map 0-120 onto 0-100% width so >100 is still visible against the 100 mark.
  const widthPct = (clamped / 120) * 100;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-3 select-none",
              className,
            )}
            data-testid="weight-progress"
            data-state={state.tone}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pesos</span>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  state.tone === "success" && "text-success",
                  state.tone === "warning" && "text-warning",
                  state.tone === "danger" && "text-destructive",
                )}
              >
                {total.toFixed(1)}%
              </span>
            </div>
            <div className="relative h-2 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width]",
                  state.fillClass,
                )}
                style={{ width: `${widthPct}%` }}
              />
              {/* 100% reference tick (at 100/120 of width) */}
              <div
                aria-hidden
                className="absolute inset-y-0 w-px bg-foreground/40"
                style={{ left: `${(100 / 120) * 100}%` }}
              />
            </div>
            <StatusBadge tone={state.tone} size="sm">
              {state.label}
            </StatusBadge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {state.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
