/**
 * CriticidadeBadge — badge compacto para uso na tabela do Painel de Obras.
 *
 * Usa o breakdown de `calculateObraSeverity` para colorir o badge (tom
 * semântico) e expor o detalhamento do score num Tooltip. Quando o status
 * manual da obra diverge da classificação calculada, mostra ícone de
 * divergência com aviso no tooltip.
 */
import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  severityLabel,
  severityTone,
  type SeverityBreakdown,
} from "@/lib/calculateObraSeverity";

interface Props {
  breakdown: SeverityBreakdown;
  /** Status manual salvo (para detectar divergência). */
  manualStatus?: string | null;
}

const pillClass: Record<
  ReturnType<typeof severityTone>,
  string
> = {
  destructive: "bg-destructive/10 text-destructive border border-destructive/25",
  warning: "bg-warning/10 text-warning border border-warning/25",
  success: "bg-success/10 text-success border border-success/25",
};

function iconFor(tone: ReturnType<typeof severityTone>) {
  return tone === "destructive"
    ? ShieldAlert
    : tone === "warning"
      ? ShieldQuestion
      : ShieldCheck;
}

export function CriticidadeBadge({ breakdown, manualStatus }: Props) {
  const tone = severityTone(breakdown.level);
  const Icon = iconFor(tone);
  const label = severityLabel(breakdown.level);

  // Divergência: manual "Em dia" mas calculada crítica/atenção; ou manual
  // "Atrasado" mas calculada saudável — indicar sem esconder o cálculo.
  const divergent =
    (manualStatus === "Em dia" && breakdown.level !== "saudavel") ||
    (manualStatus === "Atrasado" && breakdown.level === "saudavel");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] font-semibold tabular-nums",
            pillClass[tone],
          )}
          aria-label={`Criticidade ${label}, score ${breakdown.score}`}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          <span>{label}</span>
          <span className="opacity-70">· {breakdown.score}</span>
          {divergent && (
            <AlertTriangle
              className="h-3 w-3 shrink-0 opacity-80"
              aria-hidden
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs">
        <div className="font-semibold mb-1">
          {label} · score {breakdown.score}/100
        </div>
        <ul className="space-y-0.5 text-muted-foreground">
          <li>Prazo: {breakdown.components.prazo} / 35</li>
          <li>Financeiro (EAC): {breakdown.components.financeiro} / 30</li>
          <li>Pendências vencidas: {breakdown.components.pendencias} / 15</li>
          <li>Compras críticas: {breakdown.components.compras} / 10</li>
          <li>
            Desatualização: {breakdown.components.desatualizacao} / 10
          </li>
        </ul>
        {breakdown.criticalReasons.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50">
            <div className="font-medium text-foreground mb-0.5">
              Gatilhos críticos:
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {breakdown.criticalReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {divergent && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50 text-warning">
            Status manual "{manualStatus}" diverge do calculado.
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
