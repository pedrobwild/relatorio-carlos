/**
 * Painel de Obras: lista das obras em execução ordenada por risco.
 * Computador = tabela; celular = um cartão por obra.
 *
 * Cada linha responde: em que etapa a obra está (pelo cronograma interno),
 * o que deveria estar acontecendo agora, o que vem na semana que vem, a
 * entrega e a folga, e o aviso mais importante.
 *
 * Com `onOpen` (escritório), tocar na obra abre a gaveta e a célula "Semana"
 * leva à Semana daquela obra. Sem `onOpen` (gestor no modo simples), tocar na
 * obra leva direto à Semana.
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
  type ObraCadastro,
  type ObraRisk,
  type ObraRow,
} from "@/lib/obrasPainel";
import { relationshipFlag } from "@/lib/painelNovo";
import { AgoraCell, EtapaCell, ITEM_DOT, ITEM_LEGEND, ProximaSemanaCell } from "@/components/gestao/obras/ObraAndamentoCells";
import type { PainelRelacionamento } from "@/hooks/usePainelObras";

export const RISK_DOT: Record<ObraRisk, string> = {
  vermelho: "bg-destructive",
  amarelo: "bg-warning",
  verde: "bg-success",
  sem_prazo: "bg-muted-foreground/50",
};

/** Cor do número da folga: só pela folga (o ponto mostra o risco geral). */
export function slackTone(slack: number | null): string {
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
  /** Endereço da Semana daquela obra. */
  weekHref: (row: ObraRow) => string;
  /** Abre a gaveta da obra. Sem isto, tocar na obra leva à Semana. */
  onOpen?: (row: ObraRow) => void;
  /** Esconde o cabeçalho da tabela (grupos do Board depois do primeiro). */
  headless?: boolean;
}

const RELATIONSHIP_TONE: Record<Exclude<PainelRelacionamento, "Normal">, string> = {
  Atrito: "border-warning/30 bg-warning/10 text-warning",
  Insatisfeito: "border-destructive/20 bg-destructive/10 text-destructive",
  Crítico: "border-destructive/20 bg-destructive/10 text-destructive",
};

/** Marcações digitadas que merecem aparecer: obra paralisada e cliente em atrito. */
export function ObraFlags({ cadastro }: { cadastro?: Pick<ObraCadastro, "paused" | "relationship"> }) {
  const rel = relationshipFlag(cadastro?.relationship);
  if (!cadastro?.paused && !rel) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {cadastro?.paused && (
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          Paralisada
        </span>
      )}
      {rel && (
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", RELATIONSHIP_TONE[rel])}>
          Cliente: {rel.toLowerCase()}
        </span>
      )}
    </span>
  );
}

/** Segunda linha do nome: cliente e responsável (a etapa tem coluna própria). */
function subtitleOf(row: ObraRow): string {
  return [row.customer, row.responsible ?? "sem responsável"].filter(Boolean).join(" · ");
}

/** Legenda das cores das etapas (abaixo da tabela). */
export function EtapaLegend({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {ITEM_LEGEND.map((l) => (
        <span key={l.state} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", ITEM_DOT[l.state])} />
          {l.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-0.5 bg-foreground" />
        hoje
      </span>
    </p>
  );
}

function SlackCell({ row, end = false, dot = true }: { row: ObraRow; end?: boolean; dot?: boolean }) {
  const title =
    row.projectedEnd && row.deadline
      ? `Término projetado ${ddmm(row.projectedEnd)} · entrega ${ddmm(row.deadline)} (dias úteis)`
      : undefined;
  return (
    <div title={title}>
      <span className={cn("flex items-center gap-2", end && "justify-end")}>
        {dot && <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", RISK_DOT[row.risk])} />}
        <span className={cn("whitespace-nowrap font-semibold tabular-nums", slackTone(row.slack))}>
          {row.slack == null ? (row.risk === "sem_prazo" ? "Sem prazo" : "—") : slackLabel(row.slack)}
        </span>
        {dot && <span className="sr-only">{RISK_LABEL[row.risk]}</span>}
      </span>
      {row.projectedEnd && row.slack != null && (
        <span className="mt-0.5 block text-xs text-muted-foreground">termina {ddmm(row.projectedEnd)}</span>
      )}
    </div>
  );
}

/** Até duas linhas: dois avisos, ou o mais importante e "+N avisos". */
function AlertCell({ alerts }: { alerts: readonly ObraAlert[] }) {
  if (alerts.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const max = alerts.length > 2 ? 1 : 2;
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

export function ObrasTable({ rows, weekHref, onOpen, headless = false }: ObrasListProps) {
  const navigate = useNavigate();
  const open = (r: ObraRow) => (onOpen ? onOpen(r) : navigate(weekHref(r)));
  const nameClass = "block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Obras em execução, da mais arriscada para a mais tranquila</caption>
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[17%]" />
          <col className="w-[22%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
          <col />
          <col className="w-10" />
        </colgroup>
        <thead
          className={cn(
            headless
              ? "sr-only"
              : "border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          )}
        >
          <tr>
            <th scope="col" className="px-4 py-3">Obra</th>
            <th scope="col" className="px-3 py-3">Etapa</th>
            <th scope="col" className="px-3 py-3">Deveria estar acontecendo</th>
            <th scope="col" className="px-3 py-3">Próxima semana</th>
            <th scope="col" className="px-3 py-3">Entrega · folga</th>
            <th scope="col" className="px-3 py-3">Alerta</th>
            <th scope="col" className="px-2 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const subtitle = subtitleOf(r);
            const nameInner = (
              <>
                <span className="block truncate font-medium text-foreground">{r.name}</span>
                {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
              </>
            );
            return (
              <tr
                key={r.id}
                className={cn(
                  "cursor-pointer border-b border-border align-top transition-colors last:border-b-0 hover:bg-muted/50",
                  r.week.unplanned && "bg-muted/20",
                )}
                onClick={() => open(r)}
              >
                <th scope="row" className="py-3 pl-4 pr-3 font-normal">
                  <span className="flex items-start gap-2.5">
                  <span aria-hidden="true" className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", RISK_DOT[r.risk])} />
                  <span className="min-w-0 flex-1">
                  <span className="sr-only">{RISK_LABEL[r.risk]}. </span>
                  {onOpen ? (
                    <button
                      type="button"
                      className={nameClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r);
                      }}
                    >
                      {nameInner}
                    </button>
                  ) : (
                    <Link to={weekHref(r)} onClick={(e) => e.stopPropagation()} className={nameClass}>
                      {nameInner}
                    </Link>
                  )}
                  <ObraFlags cadastro={r.cadastro} />
                  </span>
                  </span>
                </th>
                <td className="px-3 py-3">
                  <EtapaCell row={r} />
                </td>
                <td className="px-3 py-3">
                  {onOpen ? (
                    <Link
                      to={weekHref(r)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Semana de ${r.name}`}
                      title="Abrir a semana desta obra"
                      className="-m-1 block rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <AgoraCell row={r} />
                    </Link>
                  ) : (
                    <AgoraCell row={r} />
                  )}
                </td>
                <td className="px-3 py-3">
                  <ProximaSemanaCell row={r} />
                </td>
                <td className="px-3 py-3 text-sm">
                  <span className="block tabular-nums text-foreground">{r.deadline ? ddmm(r.deadline) : "—"}</span>
                  <SlackCell row={r} dot={false} />
                </td>
                <td className="px-3 py-3">
                  <AlertCell alerts={r.alerts} />
                </td>
                <td className="px-2 py-3 text-muted-foreground">
                  <ChevronRight className="mt-0.5 h-4 w-4" aria-hidden="true" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ObrasCards({ rows, weekHref, onOpen }: ObrasListProps) {
  const cardClass = (r: ObraRow) =>
    cn(
      "block w-full rounded-xl border border-border bg-card p-3 text-left transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60",
      r.week.unplanned && "bg-muted/30",
    );
  return (
    <ul className="space-y-2" aria-label="Obras em execução, da mais arriscada para a mais tranquila">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.responsible ?? "Sem responsável"}
                  {r.deadline && ` · entrega ${ddmm(r.deadline)}`}
                </span>
                <ObraFlags cadastro={r.cadastro} />
              </div>
              <div className="shrink-0 text-right text-sm">
                <SlackCell row={r} end />
              </div>
            </div>
            <div className="mt-2 space-y-2 border-t border-border pt-2">
              <EtapaCell row={r} />
              <div>
                <span className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Agora</span>
                <AgoraCell row={r} max={2} />
              </div>
              <div>
                <span className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Próxima semana
                </span>
                <ProximaSemanaCell row={r} max={2} />
              </div>
            </div>
            {r.alerts.length > 0 && (
              <div className="mt-2">
                <AlertCell alerts={r.alerts} />
              </div>
            )}
          </>
        );
        return (
          <li key={r.id}>
            {onOpen ? (
              <button type="button" className={cardClass(r)} onClick={() => onOpen(r)}>
                {body}
              </button>
            ) : (
              <Link to={weekHref(r)} className={cardClass(r)}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
