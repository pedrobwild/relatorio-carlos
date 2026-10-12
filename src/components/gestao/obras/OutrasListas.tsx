/**
 * Painel de Obras: as duas listas que não são "em execução".
 *
 * - Projetos: obras em fase de projeto. Cada linha mostra em que etapa a obra
 *   está (das seis da fase de projeto), a situação do prazo dessa etapa, o
 *   prazo e quem responde por ela. Obra sem etapa registrada mostra a etapa
 *   antiga do Painel e há quanto tempo está sem atualização. Quando as etapas
 *   não chegaram (ou a leitura falhou), a linha fica neutra: não afirma "sem
 *   prazo" nem "etapas não registradas".
 * - Concluídas: obras entregues, com o resultado contra o contrato.
 */
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ddmm, formatBRL } from "@/lib/obrasPainel";
import { officialStartText } from "@/lib/faseProjeto";
import {
  ETAPAS_NAO_REGISTRADAS,
  PROJETO_PARADO_DIAS,
  projetoEtapaInfo,
  projetoResponsavel,
  resultadoLabel,
  staleHint,
  type ConcluidaRow,
  type ProjetoRow,
} from "@/lib/painelNovo";
import { ObraFlags } from "@/components/gestao/obras/ObrasList";
import { FaseChip } from "@/components/gestao/obras/FaseChip";

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

const ETAPAS_NAO_CARREGADAS = "Etapas não carregadas";
const PROJETOS_LABEL = "Obras em fase de projeto: etapa atrasada primeiro, depois as que vencem logo";

/** Segunda linha da etapa: avanço, início oficial ou há quanto tempo está parada. */
function etapaDetail(r: ProjetoRow): { text: string; warn: boolean } {
  const info = projetoEtapaInfo(r);
  if (info.registered) {
    const start = r.verdict?.verdict === "pronta" ? officialStartText(r.officialStart) : null;
    return { text: start ?? info.progress ?? "", warn: false };
  }
  const stale = staleHint(r.staleDays);
  const warn = r.staleDays != null && r.staleDays >= PROJETO_PARADO_DIAS;
  // Obra com a etapa antiga do Painel: deixa claro que as etapas novas não
  // foram registradas (só quando se sabe disso).
  const unregistered = r.phase && info.title !== ETAPAS_NAO_REGISTRADAS;
  return { text: unregistered ? `${ETAPAS_NAO_REGISTRADAS} · ${stale.toLowerCase()}` : stale, warn };
}

/** Texto do traço na coluna "Prazo" (para leitor de tela e dica). */
function semPrazoLabel(r: ProjetoRow): string {
  if (!r.phase) return ETAPAS_NAO_CARREGADAS;
  return r.verdict?.verdict === "pronta" ? "Todas as etapas concluídas" : "Sem prazo";
}

interface ProjetosProps {
  rows: readonly ProjetoRow[];
  onOpen: (id: string) => void;
}

export function ProjetosTable({ rows, onOpen }: ProjetosProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">{PROJETOS_LABEL}</caption>
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[26%]" />
          <col className="w-[19%]" />
          <col className="w-[10%]" />
          <col />
          <col className="w-10" />
        </colgroup>
        <thead className={thead}>
          <tr>
            <th scope="col" className="px-4 py-3">Projeto</th>
            <th scope="col" className={th}>Etapa</th>
            <th scope="col" className={th}>Situação</th>
            <th scope="col" className={th}>Prazo</th>
            <th scope="col" className={th}>Responsável</th>
            <th scope="col" className="px-2 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const info = projetoEtapaInfo(r);
            const detail = etapaDetail(r);
            return (
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
                <td className="px-3 py-3 text-sm text-foreground">
                  <span className="block truncate">{info.title ?? <Dash label={ETAPAS_NAO_CARREGADAS} />}</span>
                  {detail.text && (
                    <span className={cn("block text-xs tabular-nums", detail.warn ? "font-medium text-warning" : "text-muted-foreground")}>
                      {detail.text}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-sm">
                  {r.verdict ? <FaseChip verdict={r.verdict} /> : <Dash label={ETAPAS_NAO_CARREGADAS} />}
                </td>
                <td className="px-3 py-3 text-sm tabular-nums text-foreground">
                  {r.dueDate ? ddmmaa(r.dueDate) : <Dash label={semPrazoLabel(r)} />}
                </td>
                <td className="truncate px-3 py-3 text-sm text-foreground">
                  {projetoResponsavel(r) ?? <Dash label="Sem responsável" />}
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

export function ProjetosCards({ rows, onOpen }: ProjetosProps) {
  return (
    <ul className="space-y-2" aria-label={PROJETOS_LABEL}>
      {rows.map((r) => {
        const info = projetoEtapaInfo(r);
        const detail = etapaDetail(r);
        const etapa = [info.title, info.registered ? info.progress : null].filter(Boolean).join(" · ");
        return (
          <li key={r.id}>
            <button type="button" className={cardClass} onClick={() => onOpen(r.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{r.name}</span>
                  {r.customer && <span className="block truncate text-xs text-muted-foreground">{r.customer}</span>}
                </div>
                {r.verdict && <FaseChip verdict={r.verdict} className="mt-0.5 shrink-0" />}
              </div>
              {etapa && <span className="mt-1.5 block text-sm text-foreground">{etapa}</span>}
              {/* Com etapas registradas o avanço já está na linha de cima; aqui só o início oficial. */}
              {detail.text && detail.text !== info.progress && (
                <span className={cn("block text-xs tabular-nums", detail.warn ? "font-medium text-warning" : "text-muted-foreground")}>
                  {detail.text}
                </span>
              )}
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {[r.dueDate ? `Prazo ${ddmmaa(r.dueDate)}` : null, projetoResponsavel(r) ?? "Sem responsável"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <ObraFlags cadastro={r} />
            </button>
          </li>
        );
      })}
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
