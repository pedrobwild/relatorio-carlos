/**
 * Regras puras do Painel de Obras reformulado (o que não é cálculo de risco;
 * esse fica em `obrasPainel.ts`).
 *
 * O Painel tem três listas:
 *   - Em execução: obras ativas e ainda não entregues, ordenadas por risco.
 *   - Projetos:    obras em fase de projeto (sem cronograma de execução);
 *                  o que importa é em que etapa cada uma está, com quem e
 *                  se o prazo da etapa venceu (regras em `faseProjeto.ts`).
 *   - Concluídas:  obras entregues, com o resultado contra o contrato.
 *
 * E três visões das duas primeiras: lista, board (lista agrupada por etapa)
 * e kanban (colunas por etapa, arrastar muda a etapa). Em Projetos, "etapa"
 * são as seis etapas da fase de projeto.
 */
import { matchesSearch } from "@/lib/searchNormalize";
import { parseISODate } from "@/lib/hojeDia";
import {
  PHASE_DUE_SOON_DAYS,
  PHASE_STEPS,
  phaseState,
  phaseVerdict,
  type PhaseState,
  type PhaseStepKey,
  type PhaseStepRow,
  type PhaseStepState,
  type PhaseVerdict,
} from "@/lib/faseProjeto";
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
  /** Responsável pela obra (o do Painel; na falta, o engenheiro). */
  responsible: string | null;
  /** Etapa antiga do Painel (`painel_etapa`): só aparece em obra sem etapa registrada. */
  etapa: PainelEtapa | null;
  /** Dias corridos desde a última atualização do cadastro (null = desconhecido). */
  staleDays: number | null;
  /** Dias corridos na etapa atual (null = início da etapa não registrado). */
  daysInEtapa: number | null;
  relationship: PainelRelacionamento | null;
  paused: boolean;
  /**
   * As seis etapas da fase de projeto. null = NÃO SE SABE (as etapas ainda
   * não chegaram ou a leitura falhou): a tela mostra um estado neutro, sem
   * afirmar "sem prazo" nem "etapas não registradas".
   */
  phase: PhaseState | null;
  /** Veredito da etapa atual (null quando `phase` é null). */
  verdict: PhaseVerdict | null;
  /** Prazo da etapa atual (yyyy-mm-dd). */
  dueDate: string | null;
  /** Quem responde pela etapa atual; null = a etapa não tem responsável próprio. */
  stepResponsibleId: string | null;
  stepResponsible: string | null;
  /** Início oficial (`projects.date_official_start`): 5 dias úteis após a aprovação do condomínio. */
  officialStart: string | null;
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

/** Nome mostrado quando o responsável da etapa não está mais na equipe ativa. */
export const RESPONSAVEL_FORA_DA_EQUIPE = "Fora da equipe ativa";

/** O que se sabe da fase de projeto de uma obra na hora de montar a linha. */
export interface ProjetoFaseInput {
  /**
   * Linhas de `project_phase_steps` da obra. Lista vazia = nada registrado;
   * `undefined`/`null` = não se sabe (carregando ou a leitura falhou).
   */
  steps: ReadonlyArray<PhaseStepRow> | null | undefined;
  /** Nome de cada pessoa da equipe, por id (para o responsável da etapa). */
  staffNames?: ReadonlyMap<string, string>;
}

export function buildProjetoRow(o: PainelObra, today: string, fase?: ProjetoFaseInput): ProjetoRow {
  const updated = o.ultima_atualizacao ? localDayOf(o.ultima_atualizacao) : null;
  const phase = fase?.steps ? phaseState(fase.steps, today) : null;
  const current = phase?.current ?? null;
  const stepResponsibleId = current?.responsibleUserId ?? null;
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
    phase,
    verdict: phase ? phaseVerdict(phase) : null,
    dueDate: current?.dueDate ?? null,
    stepResponsibleId,
    stepResponsible: stepResponsibleId
      ? (fase?.staffNames?.get(stepResponsibleId) ?? RESPONSAVEL_FORA_DA_EQUIPE)
      : null,
    officialStart: o.inicio_apos_aprovacao?.slice(0, 10) || null,
  };
}

/** Quem aparece como responsável na linha: o da etapa atual; na falta, o da obra. */
export const projetoResponsavel = (r: Pick<ProjetoRow, "stepResponsible" | "responsible">): string | null =>
  r.stepResponsible ?? r.responsible;

/** Etapas registradas e conhecidas (false também quando ainda não se sabe). */
export const projetoRegistrado = (r: Pick<ProjetoRow, "phase">): boolean => !!r.phase?.registered;

/**
 * Ordem da lista de Projetos (faixa, depois o critério dentro dela):
 *   0. etapa atrasada — mais dias de atraso primeiro;
 *   1. vence logo — o prazo mais próximo primeiro;
 *   2. sem etapa registrada, sem prazo ou etapas desconhecidas — a mais
 *      parada primeiro (sem data de atualização vai para o topo), como antes;
 *   3. no prazo — o prazo mais próximo primeiro;
 *   4. pronta para iniciar.
 * Empate: nome.
 */
function sortRank(r: ProjetoRow): number {
  if (!projetoRegistrado(r)) return 2;
  switch (r.verdict?.verdict) {
    case "atrasada":
      return 0;
    case "vence_logo":
      return 1;
    case "no_prazo":
      return 3;
    case "pronta":
      return 4;
    default:
      return 2;
  }
}

export function sortProjetos(rows: readonly ProjetoRow[]): ProjetoRow[] {
  const stale = (r: ProjetoRow) => r.staleDays ?? Number.POSITIVE_INFINITY;
  const toDue = (r: ProjetoRow) => r.phase?.current?.daysToDue ?? 0;
  return [...rows].sort((a, b) => {
    const ra = sortRank(a);
    const rb = sortRank(b);
    if (ra !== rb) return ra - rb;
    // Atrasada e "vence logo"/"no prazo" usam a mesma conta: dias até o prazo
    // (negativo = atraso), do menor para o maior.
    const diff = ra === 2 ? stale(b) - stale(a) : ra === 4 ? 0 : toDue(a) - toDue(b);
    // Infinity - Infinity = NaN: duas obras sem data de atualização empatam.
    if (diff && !Number.isNaN(diff)) return diff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function searchProjetos(rows: readonly ProjetoRow[], query: string): ProjetoRow[] {
  if (!query.trim()) return [...rows];
  return rows.filter((r) => {
    const current = r.phase?.current;
    return matchesSearch(query, [
      r.name,
      r.customer,
      r.responsible,
      r.stepResponsible,
      // A etapa antiga só aparece (e só é achada) em obra sem etapa registrada.
      projetoRegistrado(r) ? null : r.etapa,
      current && projetoRegistrado(r) ? current.label : null,
      current && projetoRegistrado(r) ? current.shortLabel : null,
      r.verdict?.verdict === "pronta" ? r.verdict.text : null,
    ]);
  });
}

/** O que a linha mostra na coluna "Etapa". */
export interface ProjetoEtapaInfo {
  /** Etapa atual, "Todas as etapas concluídas", etapa antiga… null = nada a mostrar. */
  title: string | null;
  /** "2 de 6 concluídas" (só com etapas registradas). */
  progress: string | null;
  /** false = `title` é a etapa antiga do Painel ou um aviso, não uma etapa do fluxo. */
  registered: boolean;
}

export const ETAPAS_NAO_REGISTRADAS = "Etapas não registradas";

export function projetoEtapaInfo(r: Pick<ProjetoRow, "phase" | "etapa">): ProjetoEtapaInfo {
  const phase = r.phase;
  // Não se sabe: no máximo a etapa antiga, que vem do cadastro da obra.
  if (!phase) return { title: r.etapa, progress: null, registered: false };
  if (!phase.registered) return { title: r.etapa ?? ETAPAS_NAO_REGISTRADAS, progress: null, registered: false };
  const total = phase.steps.length;
  const progress = `${phase.doneCount} de ${total} concluídas`;
  return { title: phase.current ? phase.current.label : "Todas as etapas concluídas", progress, registered: true };
}

/**
 * Situação de UMA etapa em aberto (para a lista de etapas da gaveta): mesmo
 * texto do veredito da obra ("Atrasada há 4 dias", "Vence amanhã"). Etapa
 * concluída não tem situação.
 */
export function stepVerdict(step: PhaseStepState): PhaseVerdict | null {
  if (step.done) return null;
  return phaseVerdict({ steps: [step], current: step, doneCount: 0, registered: true });
}

export interface ProjetosResumo {
  late: number;
  dueSoon: number;
  noDeadline: number;
}

/**
 * Contagem para a linha acima da lista. null = não se sabe (nenhuma obra com
 * as etapas conhecidas). "Sem prazo" inclui as obras sem etapa registrada.
 */
export function summarizeProjetos(rows: readonly ProjetoRow[]): ProjetosResumo | null {
  const known = rows.filter((r) => r.verdict);
  if (known.length === 0) return null;
  const count = (v: PhaseVerdict["verdict"]) => known.filter((r) => r.verdict?.verdict === v).length;
  return { late: count("atrasada"), dueSoon: count("vence_logo"), noDeadline: count("sem_prazo") };
}

/** "2 com etapa atrasada · 1 vence em até 3 dias · 5 sem prazo" (sem as partes zeradas). */
export function projetosResumoText(rows: readonly ProjetoRow[]): string | null {
  const s = summarizeProjetos(rows);
  if (!s) return null;
  const parts: string[] = [];
  if (s.late > 0) parts.push(`${s.late} com etapa atrasada`);
  if (s.dueSoon > 0) {
    parts.push(`${s.dueSoon} ${s.dueSoon === 1 ? "vence" : "vencem"} em até ${PHASE_DUE_SOON_DAYS} dias`);
  }
  if (s.noDeadline > 0) parts.push(`${s.noDeadline} sem prazo`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Frase de há quanto tempo o cadastro não muda, para a linha de obra sem etapa registrada. */
export function staleHint(days: number | null): string {
  if (days == null) return "Sem registro de atualização";
  if (days === 0) return "Atualizada hoje";
  if (days === 1) return "Atualizada ontem";
  return `Há ${days} dias sem atualização`;
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

/**
 * Etapas que sempre aparecem como coluna no Kanban da lista em execução,
 * mesmo vazias (alvo de arrastar). Projetos não usa as etapas do Painel:
 * agrupa pelas etapas da fase de projeto (`groupByFase`).
 */
export const KANBAN_ETAPAS: { execucao: PainelEtapa[] } = {
  execucao: ["Planejamento", "Mobilização", "Execução", "Vistoria", "Vistoria reprovada", "Finalizada"],
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
// Board e Kanban de Projetos: agrupar pelas etapas da fase de projeto
// ---------------------------------------------------------------------------

/** Obra em fase de projeto sem nenhuma etapa registrada. */
export const FASE_SEM_REGISTRO = "__sem_registro__";
/** As seis etapas concluídas. */
export const FASE_PRONTA = "__pronta__";
/** Etapas desconhecidas (ainda carregando, ou a leitura falhou). */
export const FASE_DESCONHECIDA = "__desconhecida__";

/** Coluna/grupo de Projetos: uma das seis etapas ou um dos três casos acima. */
export type FaseKey =
  | PhaseStepKey
  | typeof FASE_SEM_REGISTRO
  | typeof FASE_PRONTA
  | typeof FASE_DESCONHECIDA;

const FASE_KEY_LABEL: Record<Exclude<FaseKey, PhaseStepKey>, string> = {
  [FASE_SEM_REGISTRO]: "Sem etapa registrada",
  [FASE_PRONTA]: "Pronta para iniciar",
  [FASE_DESCONHECIDA]: "Etapas não carregadas",
};

export function faseKeyLabel(key: FaseKey): string {
  const step = PHASE_STEPS.find((s) => s.key === key);
  return step ? step.label : FASE_KEY_LABEL[key as Exclude<FaseKey, PhaseStepKey>];
}

/** É uma das seis etapas (e não "sem registro", "pronta" ou "desconhecida")? */
export function isPhaseStepKey(key: string): key is PhaseStepKey {
  return PHASE_STEPS.some((s) => s.key === key);
}

export function faseKeyOf(r: Pick<ProjetoRow, "phase">): FaseKey {
  if (!r.phase) return FASE_DESCONHECIDA;
  if (!r.phase.registered) return FASE_SEM_REGISTRO;
  return r.phase.current ? r.phase.current.key : FASE_PRONTA;
}

export interface FaseGroup<T> {
  key: FaseKey;
  label: string;
  items: T[];
}

/**
 * Agrupa as obras em fase de projeto: "Etapas não carregadas" e "Sem etapa
 * registrada" (só quando têm itens), as seis etapas na ordem do fluxo e
 * "Pronta para iniciar". Com `always`, as seis etapas e "Pronta para iniciar"
 * aparecem mesmo vazias (colunas do Kanban, alvo de arrastar).
 */
export function groupByFase<T extends Pick<ProjetoRow, "phase">>(
  items: readonly T[],
  { always = false }: { always?: boolean } = {},
): FaseGroup<T>[] {
  const buckets = new Map<FaseKey, T[]>();
  for (const item of items) {
    const key = faseKeyOf(item);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  const out: FaseGroup<T>[] = [];
  for (const key of [FASE_DESCONHECIDA, FASE_SEM_REGISTRO] as const) {
    const list = buckets.get(key);
    if (list?.length) out.push({ key, label: faseKeyLabel(key), items: list });
  }
  for (const key of [...PHASE_STEPS.map((s) => s.key), FASE_PRONTA] as FaseKey[]) {
    const list = buckets.get(key);
    if (list?.length || always) out.push({ key, label: faseKeyLabel(key), items: list ?? [] });
  }
  return out;
}

/**
 * A aprovação do condomínio já tem data. Mover a obra de etapa reabriria a
 * aprovação (a RPC reabre a etapa de destino e as seguintes) e, com ela, o
 * início oficial: isso só se faz pela gaveta, de propósito.
 */
export function aprovacaoRegistrada(r: Pick<ProjetoRow, "phase">): boolean {
  return !!r.phase?.steps.find((s) => s.key === "aprovacao_condominio")?.done;
}

/**
 * O que a RPC `move_project_to_phase_step` faz, aplicado às linhas em memória
 * (para a tela mudar na hora, antes de o banco responder): as etapas
 * anteriores a `step` ficam concluídas — hoje, se ainda não tinham data —, e
 * `step` e as seguintes ficam em aberto. Prazo, responsável e observação não
 * mudam. `blank` cria a linha de uma etapa que ainda não tinha registro.
 */
export function moveStepsLocally<T extends PhaseStepRow>(
  rows: readonly T[],
  step: PhaseStepKey,
  today: string,
  blank: (step: PhaseStepKey) => T,
): T[] {
  const target = PHASE_STEPS.findIndex((s) => s.key === step);
  if (target < 0) return [...rows];
  const byStep = new Map(rows.map((r) => [r.step, r]));
  const out: T[] = [];
  PHASE_STEPS.forEach((def, index) => {
    const row = byStep.get(def.key);
    if (index < target) {
      const base = row ?? blank(def.key);
      out.push(base.done_at ? base : { ...base, done_at: today });
    } else if (row) {
      out.push(row.done_at ? { ...row, done_at: null } : row);
    } else if (index === target) {
      // A etapa de destino passa a existir, em aberto: é o que tira a obra de
      // "sem etapa registrada" quando o destino é a primeira etapa.
      out.push(blank(def.key));
    }
  });
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
  /** Situação da etapa atual, para a etiqueta do cartão (só projetos). */
  fase?: PhaseVerdict | null;
  /** Cartão que não arrasta mesmo quando a coluna permite (o motivo fica na gaveta). */
  locked?: boolean;
}
