/**
 * Tela Obras (Fase 5): lista das obras ordenada por risco.
 * Computador = tabela de 6 colunas; celular = um cartão por obra.
 * Tocar na obra abre a Semana daquela obra.
 */
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ddmm,
  GREEN_MIN_SLACK,
  RISK_LABEL,
  slackLabel,
  type ObraAlert,
  type ObraRisk,
  type ObraRow,
} from "@/lib/obrasPainel";

export const RISK_DOT: Record<ObraRisk, string> = {
  vermelho: "bg-destructive",
  amarelo: "bg-warning",
  verde: "bg-success",
  sem_prazo: "bg-muted-foreground/50",
};

/** Cor do número da folga: só pela folga (o ponto mostra o risco geral). */
function slackTone(slack: number | null): string {
  if (slack == null) return "text-muted-foreground";
  if (slack < 0) return "text-destructive";
  if (slack < GREEN_MIN_SLACK) return "text-warning";
  return "text-success";
}

const ALERT_TONE: Record<ObraAlert["tone"], string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

export interface ObrasListProps {
  rows: readonly ObraRow[];
  /** Para onde a obra leva (a Semana daquela obra). */
  hrefFor: (row: ObraRow) => string;
}

function SlackCell({ row, end = false }: { row: ObraRow; end?: boolean }) {
  const title =
    row.projectedEnd && row.deadline
      ? `Término projetado ${ddmm(row.projectedEnd)} · entrega ${ddmm(row.deadline)} (dias úteis)`
      : undefined;
  return (
    <div title={title}>
      <span className={cn("flex items-center gap-2", end && "justify-end")}>
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", RISK_DOT[row.risk])} />
        <span className={cn("whitespace-nowrap font-semibold tabular-nums", slackTone(row.slack))}>
          {row.slack == null ? (row.risk === "sem_prazo" ? "Sem prazo" : "—") : slackLabel(row.slack)}
        </span>
        <span className="sr-only">{RISK_LABEL[row.risk]}</span>
      </span>
      {row.projectedEnd && row.slack != null && (
        <span className="mt-0.5 block text-xs text-muted-foreground">termina {ddmm(row.projectedEnd)}</span>
      )}
    </div>
  );
}

function WeekCell({ row }: { row: ObraRow }) {
  const w = row.week;
  if (w.unplanned) {
    return (
      <div className="text-muted-foreground">
        <span className="flex items-center gap-1.5 text-sm">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          Não planejada
        </span>
        {w.stages.length > 0 && <span className="mt-0.5 block truncate text-xs">{stageList(w.stages)}</span>}
      </div>
    );
  }
  if (w.planned === 0 && w.stages.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <span className="block truncate text-sm text-foreground" title={w.stages.join(", ")}>
        {w.stages.length > 0 ? stageList(w.stages) : "Atividades da equipe"}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
        {w.planned} {w.planned === 1 ? "dia marcado" : "dias marcados"}
        {w.done > 0 && ` · ${w.done} feito${w.done === 1 ? "" : "s"}`}
        {w.notDone > 0 && <span className="text-destructive">{` · ${w.notDone} não feito${w.notDone === 1 ? "" : "s"}`}</span>}
      </span>
    </div>
  );
}

function stageList(stages: readonly string[]): string {
  if (stages.length <= 2) return stages.join(", ");
  return `${stages.slice(0, 2).join(", ")} +${stages.length - 2}`;
}

function AlertCell({ alerts, max = 2 }: { alerts: readonly ObraAlert[]; max?: number }) {
  if (alerts.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const shown = alerts.slice(0, max);
  const rest = alerts.length - shown.length;
  return (
    <ul className="space-y-0.5 text-sm">
      {shown.map((a) => (
        <li key={a.kind} className={cn("leading-snug", ALERT_TONE[a.tone], a.tone !== "muted" && "font-medium")}>
          {a.text}
        </li>
      ))}
      {rest > 0 && (
        <li className="text-xs text-muted-foreground" title={alerts.slice(max).map((a) => a.text).join(" · ")}>
          +{rest} {rest === 1 ? "aviso" : "avisos"}
        </li>
      )}
    </ul>
  );
}

export function ObrasTable({ rows, hrefFor }: ObrasListProps) {
  const navigate = useNavigate();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Obras ativas, da mais arriscada para a mais tranquila</caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[19%]" />
          <col />
          <col className="w-10" />
        </colgroup>
        <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">Obra</th>
            <th scope="col" className="px-3 py-3">Responsável</th>
            <th scope="col" className="px-3 py-3">Entrega</th>
            <th scope="col" className="px-3 py-3">Folga</th>
            <th scope="col" className="px-3 py-3">Semana</th>
            <th scope="col" className="px-3 py-3">Alerta</th>
            <th scope="col" className="px-2 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={cn(
                "cursor-pointer border-b border-border align-top transition-colors last:border-b-0 hover:bg-muted/50",
                r.week.unplanned && "bg-muted/20",
              )}
              onClick={() => navigate(hrefFor(r))}
            >
              <th scope="row" className="px-4 py-3 font-normal">
                <Link
                  to={hrefFor(r)}
                  onClick={(e) => e.stopPropagation()}
                  className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate font-medium text-foreground">{r.name}</span>
                  {r.customer && <span className="block truncate text-xs text-muted-foreground">{r.customer}</span>}
                </Link>
              </th>
              <td className="truncate px-3 py-3 text-sm text-foreground">
                {r.responsible ?? (
                  <span className="text-muted-foreground" title="Sem responsável">
                    —<span className="sr-only">Sem responsável</span>
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-sm tabular-nums text-foreground">{r.deadline ? ddmm(r.deadline) : "—"}</td>
              <td className="px-3 py-3 text-sm">
                <SlackCell row={r} />
              </td>
              <td className="px-3 py-3">
                <WeekCell row={r} />
              </td>
              <td className="px-3 py-3">
                <AlertCell alerts={r.alerts} />
              </td>
              <td className="px-2 py-3 text-muted-foreground">
                <ChevronRight className="mt-0.5 h-4 w-4" aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ObrasCards({ rows, hrefFor }: ObrasListProps) {
  return (
    <ul className="space-y-2" aria-label="Obras ativas, da mais arriscada para a mais tranquila">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            to={hrefFor(r)}
            className={cn(
              "block w-full rounded-xl border border-border bg-card p-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60",
              r.week.unplanned && "bg-muted/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.responsible ?? "Sem responsável"}
                  {r.deadline && ` · entrega ${ddmm(r.deadline)}`}
                </span>
              </div>
              <div className="shrink-0 text-right text-sm">
                <SlackCell row={r} end />
              </div>
            </div>
            <div className="mt-2 border-t border-border pt-2">
              <WeekCell row={r} />
            </div>
            {r.alerts.length > 0 && (
              <div className="mt-2">
                <AlertCell alerts={r.alerts} />
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
