/**
 * Regras puras da tela Obras (Fase 5): "bater o olho e saber como estão as
 * obras". Uma linha por obra, ordenada por risco.
 *
 * - Entrega   = prazo contratual vigente (original + aditivos aceitos), do banco.
 * - Término projetado = fim do cronograma + atraso (dias úteis) da etapa em
 *   aberto mais atrasada. Simples de explicar e conservador: uma etapa que
 *   passou do fim previsto empurra o final da obra pelo mesmo tanto.
 * - Folga     = dias úteis entre o término projetado e a entrega
 *   (positiva = sobra; negativa = atraso que vira multa).
 * - Multa projetada = −folga × % por dia × valor do contrato, com teto.
 *
 * Cores (seção 5 da proposta):
 *   vermelho  folga negativa ou atividade crítica não feita
 *   amarelo   folga 0–2, prazo consumido > avanço + 5 p.p. ou material
 *             faltando para atividade com limite em até 10 dias úteis
 *   verde     folga ≥ 3
 *             (obra com prazo mas sem cronograma nunca é verde: sem etapas
 *             não dá para projetar o término — fica em atenção)
 *   sem_prazo prazo contratual não cadastrado (com etapa atrasada vira
 *             amarelo: sem contrato não dá para medir folga, mas o atraso
 *             não pode ficar escondido no fim da lista)
 *
 * Calendário: seg–sex + feriados nacionais e de SP (mesmo de businessDays.ts).
 * Dias não úteis específicos da obra ainda não entram aqui.
 */
import { isNonBusinessDay } from "@/lib/businessDays";
import { parseISODate, shiftISODate } from "@/lib/hojeDia";
import { ppcOf, weekIsOver } from "@/lib/semanaFechamento";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import type {
  PortfolioActivity,
  PortfolioAssignment,
  PortfolioClosing,
  PortfolioMaterial,
  PortfolioStage,
} from "@/infra/repositories/obrasPanel.repository";
import type { PainelEtapa, PainelRelacionamento } from "@/hooks/usePainelObras";
import type { ObraAndamento } from "@/lib/obraAndamento";

export type ObraRisk = "vermelho" | "amarelo" | "verde" | "sem_prazo";

export const RISK_ORDER: Record<ObraRisk, number> = { vermelho: 0, amarelo: 1, verde: 2, sem_prazo: 3 };

export const RISK_LABEL: Record<ObraRisk, string> = {
  vermelho: "No vermelho",
  amarelo: "Atenção",
  verde: "No prazo",
  sem_prazo: "Sem prazo cadastrado",
};

/** Folga (dias úteis) a partir da qual a obra fica verde. */
export const GREEN_MIN_SLACK = 3;
/** Janela (dias úteis) para material faltando virar alerta. */
export const MATERIAL_WINDOW_DAYS = 10;
/** Diferença (p.p.) entre prazo consumido e avanço que acende amarelo. */
export const CONSUMPTION_GAP_PP = 5;

/**
 * Obra em execução para a tela Obras: ativa (ou pausada) e ainda não entregue.
 * `projects.status` não muda sozinho na entrega (o Painel só grava a
 * "Entrega real"), então obra entregue continuaria na lista acumulando
 * folga negativa e multa projetada todos os dias.
 * Pausada continua na lista (com a marca "Paralisada"): o prazo do contrato
 * segue correndo. Cancelada sai do Painel.
 */
export function isObraEmExecucao(
  d: Pick<ProjectDeadline, "project_id" | "status" | "actual_end_date">,
): boolean {
  return !!d.project_id && (d.status === "active" || d.status === "paused") && !d.actual_end_date;
}

// ---------------------------------------------------------------------------
// Dias úteis em ISO (yyyy-mm-dd)
// ---------------------------------------------------------------------------

export function isBusinessDayISO(iso: string): boolean {
  return !isNonBusinessDay(parseISODate(iso));
}

/** Dias úteis em (from, to] — exclui `from`, inclui `to`. 0 se to ≤ from. */
export function businessDaysAfter(from: string, to: string): number {
  if (to <= from) return 0;
  let n = 0;
  let cur = shiftISODate(from, 1);
  while (cur <= to) {
    if (isBusinessDayISO(cur)) n++;
    cur = shiftISODate(cur, 1);
  }
  return n;
}

/** Soma `n` dias úteis a partir de `iso` (n ≥ 0). */
export function addBusinessDaysISO(iso: string, n: number): string {
  let cur = iso;
  let added = 0;
  while (added < n) {
    cur = shiftISODate(cur, 1);
    if (isBusinessDayISO(cur)) added++;
  }
  return cur;
}

/** Diferença assinada em dias úteis: positiva se `a` vem antes de `b`. */
export function businessDiff(a: string, b: string): number {
  return a <= b ? businessDaysAfter(a, b) : -businessDaysAfter(b, a);
}

// ---------------------------------------------------------------------------
// Projeção do término
// ---------------------------------------------------------------------------

export interface Projection {
  /** Fim do cronograma como está (maior fim previsto/real). */
  scheduleEnd: string;
  /** Término projetado considerando a etapa mais atrasada em aberto. */
  projectedEnd: string;
  /** Etapa em aberto mais atrasada (se houver). */
  lateStage: { name: string; days: number } | null;
  /** Todas as etapas têm término real. */
  finished: boolean;
}

export function projectEnd(
  stages: ReadonlyArray<Pick<PortfolioStage, "description" | "planned_end" | "actual_end">>,
  today: string,
): Projection | null {
  const withEnd = stages.filter((s) => s.planned_end);
  if (withEnd.length === 0) return null;
  let scheduleEnd = "";
  let late: Projection["lateStage"] = null;
  let open = 0;
  for (const s of withEnd) {
    const end = s.actual_end ?? s.planned_end;
    if (end > scheduleEnd) scheduleEnd = end;
    if (s.actual_end) continue;
    open++;
    if (s.planned_end < today) {
      const days = businessDaysAfter(s.planned_end, today);
      if (days > 0 && (!late || days > late.days)) late = { name: s.description, days };
    }
  }
  const projectedEnd = late ? addBusinessDaysISO(scheduleEnd, late.days) : scheduleEnd;
  return { scheduleEnd, projectedEnd, lateStage: late, finished: open === 0 };
}

/** Multa se nada mudar, em R$ (null quando o contrato não tem os dados). */
export function projectedPenalty(
  slack: number | null,
  d: Pick<ProjectDeadline, "penalty_pct_per_day" | "penalty_cap_pct" | "contract_value"> | null | undefined,
): number | null {
  if (slack == null || slack >= 0) return slack == null ? null : 0;
  if (!d || d.penalty_pct_per_day == null || d.contract_value == null) return null;
  const pct = Math.min(-slack * Number(d.penalty_pct_per_day), Number(d.penalty_cap_pct ?? 100));
  return Math.round(Number(d.contract_value) * pct) / 100;
}

// ---------------------------------------------------------------------------
// Linha da obra
// ---------------------------------------------------------------------------

export type AlertKind =
  | "finalizada_sem_entrega"
  | "critica_nao_feita"
  | "multa"
  | "etapa_atrasada"
  | "material"
  | "consumo"
  | "sem_cronograma"
  | "sem_prazo";

export interface ObraAlert {
  kind: AlertKind;
  text: string;
  tone: "destructive" | "warning" | "muted";
}

export interface ObraWeek {
  /** Etapas do cronograma que caem na semana e não terminaram. */
  stages: string[];
  /** Dias marcados (alocações) na semana. */
  planned: number;
  done: number;
  notDone: number;
  /** Há algo previsto mas ninguém marcou dia: "não planejada" (cinza). */
  unplanned: boolean;
  /** PPC registrado no fechamento desta semana (null/ausente = semana não fechada). */
  ppc?: number | null;
  /**
   * Semana anterior: o PPC registrado no fechamento, ou `pending` quando teve
   * dia marcado e ninguém fechou (é o que a reunião de segunda cobra).
   */
  previous?: { ppc: number | null; pending: boolean };
}

/**
 * Cadastro que o escritório mantém à mão. São os únicos campos digitados da
 * tela; a situação (cor) nunca sai daqui — é sempre calculada.
 */
export interface ObraCadastro {
  etapa: PainelEtapa | null;
  /** Clima com o cliente. null = não informado. */
  relationship: PainelRelacionamento | null;
  /** Obra paralisada: a única marcação manual de situação que sobrou. */
  paused: boolean;
}

export interface ObraRow {
  id: string;
  name: string;
  customer: string | null;
  responsibleId: string | null;
  responsible: string | null;
  /** Entrega vigente (contrato + aditivos aceitos). */
  deadline: string | null;
  /** Término projetado a partir do cronograma INTERNO (o que a equipe executa). */
  projectedEnd: string | null;
  /**
   * Maior fim previsto do cronograma interno (sem projeção de atraso). A
   * gaveta compara com a entrega prevista do cronograma do cliente.
   * Ausente em quem monta a linha sem etapas.
   */
  internalPlannedEnd?: string | null;
  /** Dias úteis de folga (null = sem prazo ou sem cronograma). */
  slack: number | null;
  penalty: number | null;
  progress: number | null;
  consumed: number | null;
  week: ObraWeek;
  alerts: ObraAlert[];
  risk: ObraRisk;
  /** Etapa, relacionamento e "paralisada" (ausente em quem monta a linha sem cadastro). */
  cadastro?: ObraCadastro;
  /**
   * Andamento pelo cronograma interno: etapa atual, o que deveria estar
   * acontecendo hoje e o que começa na semana que vem (ver `obraAndamento.ts`).
   * Ausente em quem monta a linha sem ele.
   */
  andamento?: ObraAndamento;
  /** Dias marcados (alocações) na semana que vem. Ausente = não se sabe. */
  nextWeekPlanned?: number;
}

export interface BuildRowInput {
  deadline: ProjectDeadline;
  name?: string | null;
  customer?: string | null;
  responsibleId?: string | null;
  responsible?: string | null;
  progress?: number | null;
  cadastro?: ObraCadastro;
  stages: readonly PortfolioStage[];
  activities: readonly PortfolioActivity[];
  materials: readonly PortfolioMaterial[];
  weekAssignments: readonly PortfolioAssignment[];
  week: { from: string; to: string };
  today: string;
  /** Fechamento desta semana, se já foi fechada. */
  closing?: Pick<PortfolioClosing, "planned" | "done"> | null;
  /** Fechamento da semana anterior. */
  previousClosing?: Pick<PortfolioClosing, "planned" | "done"> | null;
  /** Dias marcados na semana anterior (para saber se havia o que fechar). */
  previousPlanned?: number;
  /**
   * false = os fechamentos ainda não chegaram (ou a consulta falhou). Sem
   * saber, o Painel não acusa ninguém de não ter fechado a semana.
   */
  closingsKnown?: boolean;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const formatBRL = (v: number) => BRL.format(v);

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
function shortDay(iso: string, today: string): string {
  const d = parseISODate(iso);
  const diff = (d.getTime() - parseISODate(today).getTime()) / 86_400_000;
  return diff >= 0 && diff < 7 ? WEEKDAY[d.getDay()] : ddmm(iso);
}

/** Folga em texto curto: "+6 dias", "−4 dias", "0 dia". */
export function slackLabel(slack: number | null): string {
  if (slack == null) return "—";
  const abs = Math.abs(slack);
  const sign = slack > 0 ? "+" : slack < 0 ? "−" : "";
  return `${sign}${abs} ${abs === 1 || abs === 0 ? "dia" : "dias"}`;
}

export function buildObraRow(input: BuildRowInput): ObraRow {
  const { deadline: d, stages, activities, materials, weekAssignments, week, today } = input;
  const id = d.project_id ?? "";
  const current = d.current_deadline ?? null;
  const progress = input.progress == null ? null : Number(input.progress);
  const consumed = d.pct_prazo_consumido == null ? null : Number(d.pct_prazo_consumido);

  const proj = projectEnd(stages, today);
  let slack: number | null = null;
  if (current && proj) slack = businessDiff(proj.projectedEnd, current);
  else if (current && d.business_days_remaining != null && d.business_days_remaining < 0) {
    slack = d.business_days_remaining;
  }
  const penalty = projectedPenalty(slack, d);

  // Semana ---------------------------------------------------------------
  const stageNames = stages
    .filter((s) => s.planned_start <= week.to && s.planned_end >= week.from && !(s.actual_end && s.actual_end < week.from))
    .filter((s) => !s.actual_end)
    .map((s) => s.description);
  const planned = weekAssignments.length;
  const done = weekAssignments.filter((a) => a.outcome === "feito").length;
  const notDone = weekAssignments.filter((a) => a.outcome === "nao_feito").length;
  const openActivities = activities.filter((a) => a.status !== "bloqueada");
  // Obra paralisada não é cobrada por "semana não planejada".
  const paused = input.cadastro?.paused === true;
  const unplanned = !paused && planned === 0 && (stageNames.length > 0 || openActivities.length > 0);

  // Alertas --------------------------------------------------------------
  const alerts: ObraAlert[] = [];
  // Etapa "Finalizada" sem entrega real: para o contrato a obra não foi
  // entregue, então folga e multa seguem correndo. Vem primeiro porque é o
  // que resolve a linha (registrar a data).
  if (input.cadastro?.etapa === "Finalizada") {
    alerts.push({
      kind: "finalizada_sem_entrega",
      tone: "warning",
      text: "Etapa finalizada: falta registrar a entrega real",
    });
  }
  const stageEnd = new Map(stages.map((s) => [s.id, s.planned_end]));
  const critical = activities.filter((a) => a.is_critical && Number(a.assignments_not_done ?? 0) > 0);
  if (critical.length > 0) {
    alerts.push({
      kind: "critica_nao_feita",
      tone: "destructive",
      text: critical.length === 1 ? `Crítica não feita: ${critical[0].title ?? "atividade"}` : `${critical.length} críticas não feitas`,
    });
  }
  if (penalty != null && penalty > 0) {
    alerts.push({ kind: "multa", tone: "destructive", text: `${formatBRL(penalty)} de multa se nada mudar` });
  }
  if (proj?.lateStage) {
    alerts.push({
      kind: "etapa_atrasada",
      tone: proj.lateStage.days >= GREEN_MIN_SLACK ? "destructive" : "warning",
      text: `${proj.lateStage.name} atrasada ${proj.lateStage.days} ${proj.lateStage.days === 1 ? "dia" : "dias"}`,
    });
  }
  const horizon = addBusinessDaysISO(today, MATERIAL_WINDOW_DAYS);
  const actById = new Map(activities.map((a) => [a.id, a]));
  const urgent: { m: PortfolioMaterial; limit: string }[] = [];
  for (const m of materials) {
    const act = actById.get(m.activity_id);
    const limit = m.needed_by ?? act?.late_finish ?? (act?.stage_id ? stageEnd.get(act.stage_id) : null) ?? null;
    if (limit && limit <= horizon) urgent.push({ m, limit });
  }
  urgent.sort((a, b) => a.limit.localeCompare(b.limit));
  if (urgent.length > 0) {
    const first = urgent[0];
    const more = urgent.length > 1 ? ` +${urgent.length - 1}` : "";
    alerts.push({
      kind: "material",
      tone: "warning",
      text: `Falta material: ${first.m.description} (${shortDay(first.limit, today)})${more}`,
    });
  }
  if (consumed != null && progress != null && consumed > progress + CONSUMPTION_GAP_PP) {
    alerts.push({
      kind: "consumo",
      tone: "warning",
      text: `${Math.round(consumed)}% do prazo com ${Math.round(progress)}% de avanço`,
    });
  }
  const consumptionGap = alerts.some((a) => a.kind === "consumo");
  if (!current) alerts.push({ kind: "sem_prazo", tone: "muted", text: "Prazo do contrato não cadastrado" });
  else if (!proj) alerts.push({ kind: "sem_cronograma", tone: "warning", text: "Sem cronograma: não dá para projetar o término" });

  // Risco ----------------------------------------------------------------
  let risk: ObraRisk;
  if (!current) risk = critical.length > 0 ? "vermelho" : proj?.lateStage ? "amarelo" : "sem_prazo";
  else if ((slack != null && slack < 0) || critical.length > 0) risk = "vermelho";
  else if (
    (slack != null && slack < GREEN_MIN_SLACK) ||
    consumptionGap ||
    urgent.length > 0 ||
    !proj ||
    (slack == null && d.business_days_remaining != null && d.business_days_remaining < GREEN_MIN_SLACK)
  )
    risk = "amarelo";
  else risk = "verde";

  return {
    id,
    name: input.name ?? d.project_name ?? "Obra",
    customer: input.customer ?? null,
    responsibleId: input.responsibleId ?? null,
    responsible: input.responsible ?? null,
    deadline: current,
    projectedEnd: proj?.projectedEnd ?? null,
    internalPlannedEnd: stages.reduce<string | null>(
      (acc, st) => (st.planned_end && (!acc || st.planned_end > acc) ? st.planned_end : acc),
      null,
    ),
    slack,
    penalty,
    progress,
    consumed,
    week: {
      stages: stageNames,
      planned,
      done,
      notDone,
      unplanned,
      ppc: input.closing ? ppcOf(input.closing.done, input.closing.planned) : null,
      previous: {
        ppc: input.previousClosing ? ppcOf(input.previousClosing.done, input.previousClosing.planned) : null,
        // Só cobra o fechamento de semana que já terminou: olhando a semana
        // seguinte (ou no fim de semana), a "anterior" ainda está em andamento.
        pending:
          input.closingsKnown !== false &&
          !input.previousClosing &&
          (input.previousPlanned ?? 0) > 0 &&
          weekIsOver(shiftISODate(week.from, -7), today),
      },
    },
    alerts,
    risk,
    cadastro: input.cadastro,
  };
}

/** Vermelho → amarelo → verde → sem prazo; dentro, menor folga primeiro. */
export function sortByRisk(rows: readonly ObraRow[]): ObraRow[] {
  return [...rows].sort((a, b) => {
    const r = RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
    if (r !== 0) return r;
    const sa = a.slack ?? Number.POSITIVE_INFINITY;
    const sb = b.slack ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export interface PortfolioSummary {
  active: number;
  red: number;
  yellow: number;
  unplanned: number;
  /** Obras que tiveram dia marcado na semana anterior e não fecharam a semana. */
  unclosed: number;
  noDeadline: number;
  /** Soma das multas projetadas conhecidas. */
  penaltyTotal: number;
  /** Obras no vermelho sem valor/percentual de multa no contrato. */
  penaltyUnknown: number;
}

export function summarize(rows: readonly ObraRow[]): PortfolioSummary {
  return {
    active: rows.length,
    red: rows.filter((r) => r.risk === "vermelho").length,
    yellow: rows.filter((r) => r.risk === "amarelo").length,
    unplanned: rows.filter((r) => r.week.unplanned).length,
    unclosed: rows.filter((r) => r.week.previous?.pending).length,
    noDeadline: rows.filter((r) => r.risk === "sem_prazo" || !r.deadline).length,
    penaltyTotal: rows.reduce((s, r) => s + (r.penalty ?? 0), 0),
    penaltyUnknown: rows.filter((r) => r.slack != null && r.slack < 0 && r.penalty == null).length,
  };
}

/** Agrupa por project_id. */
export function groupBy<T extends { project_id: string | null }>(list: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    if (!x.project_id) continue;
    const arr = m.get(x.project_id);
    if (arr) arr.push(x);
    else m.set(x.project_id, [x]);
  }
  return m;
}

