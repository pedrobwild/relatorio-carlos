/**
 * ObrasResumoGeral — visão geral do portfólio no topo do Painel de Obras.
 *
 * Responde "quantas obras temos e como estão": total em destaque e a
 * distribuição em andamento / atrasadas / paralisadas / entregues. Os quatro
 * grupos são mutuamente exclusivos e somam o total. Cada cartão de situação
 * filtra a lista abaixo (aba + filtro de status).
 *
 * Design tokens semânticos apenas — nenhuma cor hardcoded.
 */
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Hammer,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";

export type ResumoSituacaoId =
  | "em_andamento"
  | "atrasadas"
  | "paralisadas"
  | "entregues";

export interface ObrasResumoCounts {
  total: number;
  em_andamento: number;
  atrasadas: number;
  paralisadas: number;
  entregues: number;
}

interface Props {
  counts: ObrasResumoCounts;
  active: ResumoSituacaoId | null;
  onSelect: (id: ResumoSituacaoId) => void;
  isLoading?: boolean;
}

const SITUACOES: Array<{
  id: ResumoSituacaoId;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    id: "em_andamento",
    label: "Em andamento",
    hint: "Ativas, dentro do prazo",
    icon: Hammer,
    tone: "text-primary",
  },
  {
    id: "atrasadas",
    label: "Atrasadas",
    hint: "Prazo vencido sem entrega",
    icon: AlertTriangle,
    tone: "text-destructive",
  },
  {
    id: "paralisadas",
    label: "Paralisadas",
    hint: "Marcadas como paralisadas",
    icon: PauseCircle,
    tone: "text-warning",
  },
  {
    id: "entregues",
    label: "Entregues",
    hint: "Concluídas",
    icon: CheckCircle2,
    tone: "text-success",
  },
];

export function ObrasResumoGeral({ counts, active, onSelect, isLoading }: Props) {
  return (
    <section
      aria-label="Visão geral das obras"
      className="mb-3 grid grid-cols-2 lg:grid-cols-5 gap-2"
    >
      <div className="col-span-2 lg:col-span-1 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Total de obras
          </span>
          <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        </div>
        <span className="text-4xl font-bold tabular-nums leading-none text-foreground">
          {isLoading ? "–" : counts.total}
        </span>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Ativas e entregues
        </p>
      </div>

      {SITUACOES.map((s) => {
        const value = counts[s.id];
        const isActive = active === s.id;
        const pct =
          counts.total > 0 ? Math.round((value / counts.total) * 100) : 0;
        const Icon = s.icon;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-pressed={isActive}
            aria-label={`${s.label}: ${value} de ${counts.total} obras. Clique para filtrar.`}
            className={cn(
              "text-left rounded-lg border border-border-subtle bg-card px-4 py-3",
              "transition-all hover:border-border hover:bg-accent/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive && "border-primary/50 bg-primary/5 ring-2 ring-primary/30",
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                {s.label}
              </span>
              <Icon className={cn("h-4 w-4 shrink-0", s.tone)} aria-hidden />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-3xl font-semibold tabular-nums leading-none",
                  value === 0 ? "text-muted-foreground" : s.tone,
                )}
              >
                {isLoading ? "–" : value}
              </span>
              {!isLoading && counts.total > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
              {s.hint}
            </p>
          </button>
        );
      })}
    </section>
  );
}
