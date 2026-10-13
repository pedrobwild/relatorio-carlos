/**
 * Painel de Obras: lista das obras em execução ordenada por risco.
 * Computador = tabela; celular = um cartão por obra.
 *
 * Cada linha responde, em uma linha por pergunta e sem siglas: onde a obra
 * está (pelo cronograma interno), o que deveria estar acontecendo agora, o
 * que vem na semana que vem, a entrega e o que fazer agora.
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
  type ObraCadastro,
  type ObraRisk,
  type ObraRow,
} from "@/lib/obrasPainel";
import { relationshipFlag } from "@/lib/painelNovo";
import { AgoraCell, EtapaCell, ITEM_LEGEND, PassoCell, ProximaSemanaCell } from "@/components/gestao/obras/ObraAndamentoCells";
import { folgaTexto } from "@/lib/proximoPasso";
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

/** Legenda das cores (abaixo da tabela). */
export function EtapaLegend({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {ITEM_LEGEND.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", l.dot)} />
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

/** Entrega do contrato e quanto sobra (ou falta), em palavras. */
function EntregaCell({ row, end = false }: { row: ObraRow; end?: boolean }) {
  const folga = folgaTexto(row.slack);
  const title =
    row.projectedEnd && row.deadline
      ? `Pelo cronograma termina ${ddmm(row.projectedEnd)}; o contrato pede ${ddmm(row.deadline)} (contando só dias úteis)`
      : undefined;
  return (
    <div title={title} className={cn("text-sm", end && "text-right")}>
      <span className="block tabular-nums text-foreground">
        {row.deadline ? ddmm(row.deadline) : <span className="text-muted-foreground">Sem prazo</span>}
      </span>
      {folga && (
        <span className={cn("block whitespace-nowrap text-xs font-medium tabular-nums", slackTone(row.slack))}>{folga}</span>
      )}
    </div>
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
          <col className="w-[21%]" />
          <col className="w-[17%]" />
          <col className="w-[15%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
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
            <th scope="col" className="px-3 py-3">Onde está</th>
            <th scope="col" className="px-3 py-3">Agora</th>
            <th scope="col" className="px-3 py-3">Semana que vem</th>
            <th scope="col" className="px-3 py-3">Entrega</th>
            <th scope="col" className="px-3 py-3">O que fazer</th>
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
                className="cursor-pointer border-b border-border align-top transition-colors last:border-b-0 hover:bg-muted/50"
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
                  <AgoraCell row={r} />
                </td>
                <td className="px-3 py-3">
                  <ProximaSemanaCell row={r} />
                </td>
                <td className="px-3 py-3">
                  <EntregaCell row={r} />
                </td>
                <td className="px-3 py-3">
                  <Link
                    to={weekHref(r)}
                    onClick={(e) => e.stopPropagation()}
                    title="Abrir a semana desta obra"
                    className="-m-1 block rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PassoCell row={r} />
                  </Link>
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
  const cardClass = cn(
    "block w-full rounded-xl border border-border bg-card p-3 text-left transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60",
  );
  return (
    <ul className="space-y-2" aria-label="Obras em execução, da mais arriscada para a mais tranquila">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden="true" className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", RISK_DOT[r.risk])} />
                <div className="min-w-0">
                  <span className="sr-only">{RISK_LABEL[r.risk]}. </span>
                  <span className="block truncate font-medium text-foreground">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{subtitleOf(r)}</span>
                  <ObraFlags cadastro={r.cadastro} />
                </div>
              </div>
              <EntregaCell row={r} end />
            </div>
            <div className="mt-2 border-t border-border pt-2">
              <EtapaCell row={r} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Agora</dt>
                <dd>
                  <AgoraCell row={r} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Semana que vem</dt>
                <dd>
                  <ProximaSemanaCell row={r} />
                </dd>
              </div>
            </dl>
            <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2">
              <span className="block text-xs text-muted-foreground">O que fazer</span>
              <PassoCell row={r} />
            </div>
          </>
        );
        return (
          <li key={r.id}>
            {onOpen ? (
              <button type="button" className={cardClass} onClick={() => onOpen(r)}>
                {body}
              </button>
            ) : (
              <Link to={weekHref(r)} className={cardClass}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
