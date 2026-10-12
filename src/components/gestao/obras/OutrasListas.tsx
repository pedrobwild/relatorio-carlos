/**
 * Painel de Obras: as duas listas que não são "em execução".
 *
 * - Projetos: obras em fase de projeto. Não há prazo nem cronograma de
 *   execução, então o que a lista mostra é há quanto tempo cada uma está
 *   sem atualização (a mais parada primeiro).
 * - Concluídas: obras entregues, com o resultado contra o contrato.
 */
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ddmm, formatBRL } from "@/lib/obrasPainel";
import {
  PROJETO_PARADO_DIAS,
  resultadoLabel,
  staleLabel,
  type ConcluidaRow,
  type ProjetoRow,
} from "@/lib/painelNovo";
import { ObraFlags } from "@/components/gestao/obras/ObrasList";

const ddmmaa = (iso: string) => `${ddmm(iso)}/${iso.slice(2, 4)}`;

const th = "px-3 py-3";
const thead = "border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const rowClass = "cursor-pointer border-b border-border align-top transition-colors last:border-b-0 hover:bg-muted/50";
const nameButton =
  "block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const cardClass =
  "block w-full rounded-xl border border-border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60";

function Dash({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground" title={label}>
      —<span className="sr-only">{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

function staleTone(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  return days >= PROJETO_PARADO_DIAS ? "font-medium text-warning" : "text-foreground";
}

interface ProjetosProps {
  rows: readonly ProjetoRow[];
  onOpen: (id: string) => void;
}

export function ProjetosTable({ rows, onOpen }: ProjetosProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Obras em fase de projeto, da mais parada para a mais recente</caption>
        <colgroup>
          <col className="w-[32%]" />
          <col className="w-[18%]" />
          <col className="w-[20%]" />
          <col className="w-[13%]" />
          <col />
          <col className="w-10" />
        </colgroup>
        <thead className={thead}>
          <tr>
            <th scope="col" className="px-4 py-3">Projeto</th>
            <th scope="col" className={th}>Responsável</th>
            <th scope="col" className={th}>Etapa</th>
            <th scope="col" className={th}>Na etapa</th>
            <th scope="col" className={th}>Última atualização</th>
            <th scope="col" className="px-2 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={rowClass} onClick={() => onOpen(r.id)}>
              <th scope="row" className="px-4 py-3 font-normal">
                <button
                  type="button"
                  className={nameButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.id);
                  }}
                >
                  <span className="block truncate font-medium text-foreground">{r.name}</span>
                  {r.customer && <span className="block truncate text-xs text-muted-foreground">{r.customer}</span>}
                </button>
                <ObraFlags cadastro={r} />
              </th>
              <td className="truncate px-3 py-3 text-sm text-foreground">{r.responsible ?? <Dash label="Sem responsável" />}</td>
              <td className="truncate px-3 py-3 text-sm text-foreground">{r.etapa ?? <Dash label="Sem etapa" />}</td>
              <td className="px-3 py-3 text-sm tabular-nums text-foreground">
                {r.daysInEtapa == null ? <Dash label="Início da etapa não registrado" /> : `${r.daysInEtapa} ${r.daysInEtapa === 1 ? "dia" : "dias"}`}
              </td>
              <td className={cn("px-3 py-3 text-sm tabular-nums", staleTone(r.staleDays))}>{staleLabel(r.staleDays)}</td>
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

export function ProjetosCards({ rows, onOpen }: ProjetosProps) {
  return (
    <ul className="space-y-2" aria-label="Obras em fase de projeto, da mais parada para a mais recente">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" className={cardClass} onClick={() => onOpen(r.id)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[r.responsible ?? "Sem responsável", r.etapa ?? "Sem etapa"].join(" · ")}
                </span>
                <ObraFlags cadastro={r} />
              </div>
              <span className={cn("shrink-0 text-right text-sm tabular-nums", staleTone(r.staleDays))}>
                {staleLabel(r.staleDays)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Concluídas
// ---------------------------------------------------------------------------

const RESULTADO_TONE: Record<ConcluidaRow["resultado"], string> = {
  no_prazo: "text-success",
  atrasada: "font-medium text-destructive",
  sem_prazo: "text-muted-foreground",
  sem_entrega: "text-muted-foreground",
};

interface ConcluidasProps {
  rows: readonly ConcluidaRow[];
  onOpen: (id: string) => void;
}

export function ConcluidasTable({ rows, onOpen }: ConcluidasProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Obras concluídas, da entrega mais recente para a mais antiga</caption>
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col />
          <col className="w-[13%]" />
          <col className="w-10" />
        </colgroup>
        <thead className={thead}>
          <tr>
            <th scope="col" className="px-4 py-3">Obra</th>
            <th scope="col" className={th}>Responsável</th>
            <th scope="col" className={th}>Contrato</th>
            <th scope="col" className={th}>Entregue</th>
            <th scope="col" className={th}>Resultado</th>
            <th scope="col" className={th}>Multa</th>
            <th scope="col" className="px-2 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={rowClass} onClick={() => onOpen(r.id)}>
              <th scope="row" className="px-4 py-3 font-normal">
                <button
                  type="button"
                  className={nameButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.id);
                  }}
                >
                  <span className="block truncate font-medium text-foreground">{r.name}</span>
                  {r.customer && <span className="block truncate text-xs text-muted-foreground">{r.customer}</span>}
                </button>
              </th>
              <td className="truncate px-3 py-3 text-sm text-foreground">{r.responsible ?? <Dash label="Sem responsável" />}</td>
              <td className="px-3 py-3 text-sm tabular-nums text-foreground">{r.deadline ? ddmmaa(r.deadline) : <Dash label="Sem prazo cadastrado" />}</td>
              <td className="px-3 py-3 text-sm tabular-nums text-foreground">{r.deliveredOn ? ddmmaa(r.deliveredOn) : <Dash label="Sem data de entrega" />}</td>
              <td className={cn("px-3 py-3 text-sm", RESULTADO_TONE[r.resultado])}>{resultadoLabel(r)}</td>
              <td className="px-3 py-3 text-sm tabular-nums text-foreground">
                {r.penalty != null && r.penalty > 0 ? formatBRL(r.penalty) : <Dash label="Sem multa" />}
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

export function ConcluidasCards({ rows, onOpen }: ConcluidasProps) {
  return (
    <ul className="space-y-2" aria-label="Obras concluídas, da entrega mais recente para a mais antiga">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" className={cardClass} onClick={() => onOpen(r.id)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.responsible ?? "Sem responsável"}
                  {r.deliveredOn && ` · entregue ${ddmmaa(r.deliveredOn)}`}
                </span>
              </div>
              <span className={cn("shrink-0 text-right text-sm", RESULTADO_TONE[r.resultado])}>{resultadoLabel(r)}</span>
            </div>
            {r.penalty != null && r.penalty > 0 && (
              <p className="mt-2 border-t border-border pt-2 text-sm text-destructive">Multa {formatBRL(r.penalty)}</p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
