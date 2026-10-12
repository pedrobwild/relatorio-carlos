/**
 * Regras puras do Painel de Obras reformulado (o que não é cálculo de risco;
 * esse fica em `obrasPainel.ts`).
 *
 * O Painel tem três listas:
 *   - Em execução: obras ativas e ainda não entregues, ordenadas por risco.
 *   - Projetos:    obras em fase de projeto (sem cronograma de execução);
 *                  o que importa é há quanto tempo estão paradas.
 *   - Concluídas:  obras entregues, com o resultado contra o contrato.
 *
 * E três visões das duas primeiras: lista, board (lista agrupada por etapa)
 * e kanban (colunas por etapa, arrastar muda a etapa).
 */
import { matchesSearch } from "@/lib/searchNormalize";
import { parseISODate } from "@/lib/hojeDia";
import { toLocalISODate } from "@/lib/localDate";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import {
  ETAPA_OPTIONS,
  type PainelEtapa,
  type PainelObra,
  type PainelRelacionamento,
} from "@/hooks/usePainelObras";
import type { ObraCadastro, ObraRisk, ObraRow } from "@/lib/obrasPainel";

export type PainelLista = "execucao" | "projetos" | "concluidas";
export type PainelVisao = "lista" | "board" | "kanban";

export const LISTA_LABEL: Record<PainelLista, string> = {
  execucao: "Em execução",
  projetos: "Projetos",
  concluidas: "Concluídas",
};

export const VISAO_LABEL: Record<PainelVisao, string> = {
  lista: "Lista",
  board: "Board",
  kanban: "Kanban",
};

/** Lê a lista da URL. Aceita os parâmetros do painel antigo (`fase`, `aba`). */
export function listaFromParams(params: URLSearchParams): PainelLista {
  if (params.get("aba") === "concluidas") return "concluidas";
  if (params.get("fase") === "projetos") return "projetos";
  return "execucao";
}

export function visaoFromParams(params: URLSearchParams): PainelVisao {
  const v = params.get("view");
  return v === "board" || v === "kanban" ? v : "lista";
}

/** Cadastro digitado da obra, no formato que a linha usa. */
export function cadastroOf(o: Pick<PainelObra, "etapa" | "relacionamento" | "status"> | null | undefined): ObraCadastro {
  return {
    etapa: o?.etapa ?? null,
    relationship: o?.relacionamento ?? null,
    paused: o?.status === "Paralisada",
  };
}

/** Relacionamento que merece aparecer na linha (o normal fica em silêncio). */
export function relationshipFlag(r: PainelRelacionamento | null | undefined): PainelRelacionamento | null {
  return r && r !== "Normal" ? r : null;
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

export function searchObraRows(rows: readonly ObraRow[], query: string): ObraRow[] {
  if (!query.trim()) return [...rows];
  return rows.filter((r) => matchesSearch(query, [r.name, r.customer, r.responsible, r.cadastro?.etapa]));
}

// ---------------------------------------------------------------------------
// Projetos (fase de projeto)
// ---------------------------------------------------------------------------

/** Dias sem atualização a partir dos quais o projeto é destacado como parado. */
export const PROJETO_PARADO_DIAS = 14;

export interface ProjetoRow {
  id: string;
  name: string;
  customer: string | null;
  responsibleId: string | null;
  responsible: string | null;
  etapa: PainelEtapa | null;
  /** Dias corridos desde a última atualização do cadastro (null = desconhecido). */
  staleDays: number | null;
  /** Dias corridos na etapa atual (null = início da etapa não registrado). */
  daysInEtapa: number | null;
  relationship: PainelRelacionamento | null;
  paused: boolean;
}

/** Dias corridos entre duas datas de calendário (yyyy-mm-dd). Nunca negativo. */
function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Dia local de um carimbo de data/hora (o banco guarda em UTC). */
function localDayOf(timestamp: string): string | null {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : toLocalISODate(d);
}

export function buildProjetoRow(o: PainelObra, today: string): ProjetoRow {
  const updated = o.ultima_atualizacao ? localDayOf(o.ultima_atualizacao) : null;
  return {
    id: o.id,
    name: o.nome,
    customer: o.customer_name,
    responsibleId: o.responsavel_id,
    responsible: o.responsavel_nome ?? o.engineer_name ?? null,
    etapa: o.etapa,
    staleDays: updated ? daysBetween(updated, today) : null,
    daysInEtapa: o.inicio_etapa ? daysBetween(o.inicio_etapa.slice(0, 10), today) : null,
    relationship: o.relacionamento,
    paused: o.status === "Paralisada",
  };
}

/** Mais parado primeiro (sem data de atualização vai para o topo); depois nome. */
export function sortProjetos(rows: readonly ProjetoRow[]): ProjetoRow[] {
  return [...rows].sort((a, b) => {
    const sa = a.staleDays ?? Number.POSITIVE_INFINITY;
    const sb = b.staleDays ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sb - sa;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function searchProjetos(rows: readonly ProjetoRow[], query: string): ProjetoRow[] {
  if (!query.trim()) return [...rows];
  return rows.filter((r) => matchesSearch(query, [r.name, r.customer, r.responsible, r.etapa]));
}

export function staleLabel(days: number | null): string {
  if (days == null) return "Sem registro";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

// ---------------------------------------------------------------------------
// Concluídas
// ---------------------------------------------------------------------------

export type ConcluidaResultado = "no_prazo" | "atrasada" | "sem_prazo" | "sem_entrega";

export interface ConcluidaRow {
  id: string;
  name: string;
  customer: string | null;
  responsibleId: string | null;
  responsible: string | null;
  /** Entrega vigente do contrato (com aditivos aceitos). */
  deadline: string | null;
  deliveredOn: string | null;
  resultado: ConcluidaResultado;
  /** Dias úteis de atraso na entrega (0 quando no prazo ou sem prazo). */
  lateDays: number;
  /** Multa pelo atraso, em R$ (null quando o contrato não tem os dados). */
  penalty: number | null;
}

/** Obra entregue ou encerrada (fora da fase de projeto). */
export function isObraConcluida(
  d: Pick<ProjectDeadline, "project_id" | "status" | "actual_end_date">,
): boolean {
  return !!d.project_id && (!!d.actual_end_date || d.status === "completed");
}

export function buildConcluidaRow(d: ProjectDeadline, o: PainelObra | undefined): ConcluidaRow {
  const lateDays = Math.max(0, Number(d.business_days_late ?? 0));
  const hasDeadline = !!d.current_deadline && !!d.actual_end_date;
  return {
    id: d.project_id ?? "",
    name: o?.nome ?? d.project_name ?? "Obra",
    customer: o?.customer_name ?? null,
    responsibleId: o?.responsavel_id ?? null,
    responsible: o?.responsavel_nome ?? o?.engineer_name ?? null,
    deadline: d.current_deadline ?? null,
    deliveredOn: d.actual_end_date ?? null,
    resultado: !d.actual_end_date ? "sem_entrega" : !d.current_deadline ? "sem_prazo" : lateDays > 0 ? "atrasada" : "no_prazo",
    lateDays: hasDeadline ? lateDays : 0,
    penalty: hasDeadline && lateDays > 0 && d.penalty_accrued_value != null ? Number(d.penalty_accrued_value) : null,
  };
}

/** Entregue mais recentemente primeiro; sem data de entrega no fim. */
export function sortConcluidas(rows: readonly ConcluidaRow[]): ConcluidaRow[] {
  return [...rows].sort((a, b) => {
    const da = a.deliveredOn ?? "";
    const db = b.deliveredOn ?? "";
    if (da !== db) return da < db ? 1 : -1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function searchConcluidas(rows: readonly ConcluidaRow[], query: string): ConcluidaRow[] {
  if (!query.trim()) return [...rows];
  return rows.filter((r) => matchesSearch(query, [r.name, r.customer, r.responsible]));
}

export function resultadoLabel(r: Pick<ConcluidaRow, "resultado" | "lateDays">): string {
  if (r.resultado === "sem_entrega") return "Sem data de entrega";
  if (r.resultado === "sem_prazo") return "Sem prazo cadastrado";
  if (r.resultado === "no_prazo") return "No prazo";
  return `${r.lateDays} ${r.lateDays === 1 ? "dia útil" : "dias úteis"} de atraso`;
}

// ---------------------------------------------------------------------------
// Board e Kanban: agrupar por etapa
// ---------------------------------------------------------------------------

/** Chave de coluna/grupo: uma etapa, ou "sem etapa". */
export type EtapaKey = PainelEtapa | "__sem_etapa__";
export const SEM_ETAPA: EtapaKey = "__sem_etapa__";

export const etapaKeyOf = (etapa: PainelEtapa | null | undefined): EtapaKey => etapa ?? SEM_ETAPA;
export const etapaOfKey = (key: EtapaKey): PainelEtapa | null => (key === SEM_ETAPA ? null : key);
export const etapaKeyLabel = (key: EtapaKey): string => (key === SEM_ETAPA ? "Sem etapa" : key);

/** Etapas que sempre aparecem como coluna no Kanban, mesmo vazias (alvo de arrastar). */
export const KANBAN_ETAPAS: Record<Exclude<PainelLista, "concluidas">, PainelEtapa[]> = {
  execucao: ["Planejamento", "Mobilização", "Execução", "Vistoria", "Vistoria reprovada", "Finalizada"],
  projetos: ["Projeto 3D", "Projeto Executivo", "Executivo Aprovado", "Medição", "Executivo", "Emissão RRT", "Condomínio"],
};

export interface EtapaGroup<T> {
  key: EtapaKey;
  label: string;
  items: T[];
}

/**
 * Agrupa por etapa na ordem do ciclo da obra. Etapas de `always` aparecem
 * mesmo vazias; "Sem etapa" vem primeiro quando tem itens (é o que falta
 * cadastrar) e some quando está vazia.
 */
export function groupByEtapa<T>(
  items: readonly T[],
  etapaOf: (item: T) => PainelEtapa | null | undefined,
  always: readonly PainelEtapa[] = [],
): EtapaGroup<T>[] {
  const buckets = new Map<EtapaKey, T[]>();
  for (const item of items) {
    const key = etapaKeyOf(etapaOf(item));
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  const out: EtapaGroup<T>[] = [];
  const semEtapa = buckets.get(SEM_ETAPA);
  if (semEtapa?.length) out.push({ key: SEM_ETAPA, label: etapaKeyLabel(SEM_ETAPA), items: semEtapa });
  for (const etapa of ETAPA_OPTIONS) {
    const list = buckets.get(etapa);
    if (list?.length || always.includes(etapa)) out.push({ key: etapa, label: etapa, items: list ?? [] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cartão do Kanban (mesmo formato para obra em execução e projeto)
// ---------------------------------------------------------------------------

export interface KanbanCardData {
  id: string;
  name: string;
  customer: string | null;
  responsible: string | null;
  etapa: PainelEtapa | null;
  /** Cor da situação (null = não se aplica, ex.: projeto). */
  risk: ObraRisk | null;
  /** Linha principal: folga e entrega, ou tempo parado. */
  headline: string;
  headlineTone: "destructive" | "warning" | "success" | "muted";
  /** Aviso mais importante, se houver. */
  alert: string | null;
  paused: boolean;
  relationship: PainelRelacionamento | null;
}
