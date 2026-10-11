/**
 * Célula "Prazo" do Painel de Obras (staff-only).
 *
 * Linha 1: situação (No prazo / Atenção / Atrasada) + dias úteis.
 * Linha 2: data de entrega vigente.
 * Tooltip: contrato, aditivos, dias decorridos, multa acumulada e aviso
 * quando o prazo ainda não foi conferido com o contrato.
 */
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import { DEADLINE_HEALTH_LABEL, type DeadlineHealth } from "@/lib/contractDeadline";
import { obraPrazoHealth } from "@/lib/painelPrazo";
import { cn } from "@/lib/utils";

const CHIP: Record<DeadlineHealth, string> = {
  sem_prazo: "bg-muted text-muted-foreground border border-border-subtle",
  no_prazo: "bg-success/10 text-success border border-success/25",
  atencao: "bg-warning/10 text-warning border border-warning/30",
  atrasada: "bg-destructive/10 text-destructive border border-destructive/20",
};

const fmt = (iso: string | null | undefined, pattern = "dd/MM/yy") =>
  iso ? format(parseISO(iso), pattern, { locale: ptBR }) : "—";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function prazoResumo(d: ProjectDeadline | null | undefined, entregue: boolean): string {
  if (!d?.current_deadline) return "Sem prazo contratual";
  if (entregue) return (d.business_days_late ?? 0) > 0 ? `Entregue com ${d.business_days_late} du de atraso` : "Entregue no prazo";
  if ((d.business_days_late ?? 0) > 0) return `${d.business_days_late} du de atraso`;
  const r = d.business_days_remaining ?? 0;
  return r === 0 ? "Vence hoje" : `${r} du de folga`;
}

interface Props {
  obra: {
    entrega_oficial: string | null;
    entrega_real: string | null;
    prazo_contratual?: ProjectDeadline | null;
  };
}

export function PrazoContratualCell({ obra }: Props) {
  const d = obra.prazo_contratual;
  const health = obraPrazoHealth(obra);
  const entregue = !!obra.entrega_real;

  if (!d?.current_deadline) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="painel-prazo-cell" data-health="sem_prazo">
        Sem prazo
      </span>
    );
  }

  const label = entregue ? "Entregue" : DEADLINE_HEALTH_LABEL[health];
  const hasAditivo = (d.amendment_business_days ?? 0) > 0;
  const multa = d.penalty_accrued_value ?? 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-start gap-0.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          data-testid="painel-prazo-cell"
          data-health={entregue ? "entregue" : health}
          aria-label={`Prazo contratual: ${label}, ${prazoResumo(d, entregue)}, entrega ${fmt(d.current_deadline, "dd/MM/yyyy")}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium leading-none", CHIP[entregue ? "no_prazo" : health])}>
              {label}
            </span>
            {!d.contract_terms_confirmed && (
              <span className="text-[11px] text-muted-foreground" aria-hidden>
                *
              </span>
            )}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {prazoResumo(d, entregue)} · {fmt(d.current_deadline)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[280px] text-xs">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Contrato</dt>
          <dd>
            {d.contract_business_days} du · entrega {fmt(d.contract_deadline, "dd/MM/yyyy")}
          </dd>
          {hasAditivo && (
            <>
              <dt className="text-muted-foreground">Aditivos</dt>
              <dd>
                +{d.amendment_business_days} du · vigente {fmt(d.current_deadline, "dd/MM/yyyy")}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Decorridos</dt>
          <dd>
            {d.business_days_elapsed} de {d.current_business_days} du
          </dd>
          {multa > 0 && (
            <>
              <dt className="text-muted-foreground">Multa</dt>
              <dd className="font-medium text-destructive">{brl(multa)}</dd>
            </>
          )}
        </dl>
        {(d.amendments_pending ?? 0) > 0 && (
          <p className="mt-1.5 text-muted-foreground">{d.amendments_pending} aditivo(s) aguardando aceite.</p>
        )}
        {!d.contract_terms_confirmed && (
          <p className="mt-1.5 text-muted-foreground">* Prazo preenchido a partir do cronograma; conferir com o contrato.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
