/**
 * Regras puras da tela Semana (Fase 4).
 *
 * - Grade da semana: linhas = atividades agrupadas pela ETAPA do cliente,
 *   colunas = dias úteis (seg–sex; sábado só se houver algo marcado).
 * - Data-limite: célula planejada depois do limite fica ⚠ antes de atrasar.
 * - "Planejar semana": proposta automática = o que sobrou da semana anterior
 *   + atividades sem dia + etapas do cronograma previstas para a semana
 *   que ainda não têm atividade. O gestor só ajusta quem e quais dias.
 */
import { isHoliday } from "@/lib/businessDays";
import { parseISODate, shiftISODate, toISODate, todayISO } from "@/lib/hojeDia";
import { isOpsActivityClosed } from "@/lib/opsLabels";
import type {
  OpsActivityView,
  OpsAssignment,
  OpsMaterial,
  OpsStageOption,
} from "@/infra/repositories/ops.repository";

// ---------------------------------------------------------------------------
// Semana e dias
// ---------------------------------------------------------------------------

/** Segunda-feira da semana de `iso`. */
export function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toISODate(d);
}

/**
 * Semana "atual" para planejar: de segunda a sexta é a própria semana; no
 * sábado e no domingo já é a semana que vai começar.
 */
export function planningMonday(now: Date = new Date()): string {
  const today = todayISO(now);
  const dow = now.getDay();
  return dow === 0 || dow === 6 ? shiftISODate(mondayOf(today), 7) : mondayOf(today);
}

/** Aceita qualquer data válida da URL e devolve a segunda-feira; senão, a semana atual de planejamento. */
export function normalizeWeekParam(value: string | null | undefined, now: Date = new Date()): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && toISODate(parseISODate(value)) === value) {
    return mondayOf(value);
  }
  return planningMonday(now);
}

const SHORT_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface WeekDay {
  iso: string;
  /** "Seg 12" */
  label: string;
  /** Feriado nacional ou de São Paulo. */
  holiday: boolean;
  isToday: boolean;
}

export function weekDays(monday: string, opts: { includeSaturday?: boolean; now?: Date } = {}): WeekDay[] {
  const today = todayISO(opts.now);
  const n = opts.includeSaturday ? 6 : 5;
  return Array.from({ length: n }, (_, i) => {
    const iso = shiftISODate(monday, i);
    const d = parseISODate(iso);
    return {
      iso,
      label: `${SHORT_WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`,
      holiday: isHoliday(d),
      isToday: iso === today,
    };
  });
}

/** Intervalo de consulta (seg–dom, para pegar sábado/domingo marcados). */
export function weekRange(monday: string): { from: string; to: string } {
  return { from: monday, to: shiftISODate(monday, 6) };
}

/** "12/10 a 16/10" */
export function weekLabel(monday: string): string {
  const fmt = (iso: string) => {
    const d = parseISODate(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return `${fmt(monday)} a ${fmt(shiftISODate(monday, 4))}`;
}

/** Sábado entra na grade só se tiver algo marcado nele. */
export function hasSaturday(assignments: ReadonlyArray<Pick<OpsAssignment, "work_date">>, monday: string): boolean {
  const sat = shiftISODate(monday, 5);
  return assignments.some((a) => a.work_date === sat);
}

// ---------------------------------------------------------------------------
// Quem faz
// ---------------------------------------------------------------------------

export type WhoValue = { user_id: string; worker_name: null } | { user_id: null; worker_name: string };

/** Texto digitado → usuário interno (se bater com o nome) ou nome livre. */
export function parseWho(
  text: string,
  staff: ReadonlyArray<{ id: string; nome: string }>,
): WhoValue | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return null;
  const hit = staff.find((s) => s.nome.trim().toLowerCase() === t.toLowerCase());
  return hit ? { user_id: hit.id, worker_name: null } : { user_id: null, worker_name: t };
}

/** Nome curto para a célula: primeiro nome do usuário ou o nome livre. */
export function shortWho(
  a: Pick<OpsAssignment, "user_id" | "worker_name" | "fornecedor_id">,
  staffNameById: ReadonlyMap<string, string>,
): string {
  if (a.worker_name?.trim()) return a.worker_name.trim();
  if (a.user_id) {
    const full = staffNameById.get(a.user_id);
    return full ? full.split(" ")[0] : "Equipe";
  }
  if (a.fornecedor_id) return "Prestador";
  return "Sem nome";
}

/** Texto para preencher o campo "quem" a partir de uma alocação. */
export function whoText(
  a: Pick<OpsAssignment, "user_id" | "worker_name"> | null | undefined,
  staffNameById: ReadonlyMap<string, string>,
): string {
  if (!a) return "";
  if (a.worker_name?.trim()) return a.worker_name.trim();
  if (a.user_id) return staffNameById.get(a.user_id) ?? "";
  return "";
}

/** Sugestões do campo "quem": equipe interna + nomes já usados na obra. */
export function whoSuggestions(
  staff: ReadonlyArray<{ nome: string }>,
  assignments: ReadonlyArray<Pick<OpsAssignment, "worker_name">>,
): string[] {
  const set = new Set<string>();
  for (const a of assignments) if (a.worker_name?.trim()) set.add(a.worker_name.trim());
  for (const s of staff) if (s.nome?.trim()) set.add(s.nome.trim());
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Grade da semana
// ---------------------------------------------------------------------------

/** Data-limite da atividade: a própria (quando calculada) ou o fim previsto da etapa. */
export function limitFor(
  activity: Pick<OpsActivityView, "late_finish">,
  stage: Pick<OpsStageOption, "planned_end"> | null | undefined,
): string | null {
  return activity.late_finish ?? stage?.planned_end ?? null;
}

export function isAfterLimit(workDate: string, limit: string | null): boolean {
  return !!limit && workDate > limit;
}

function overlaps(start: string | null | undefined, end: string | null | undefined, from: string, to: string) {
  if (!start || !end) return false;
  return start <= to && end >= from;
}

export interface ActivityWeekRow {
  activity: OpsActivityView;
  /** Alocações por dia (yyyy-mm-dd) dentro da semana. */
  cells: Record<string, OpsAssignment[]>;
  limit: string | null;
  inWeek: number;
}

export interface StageWeekSection {
  stageId: string | null;
  stageName: string;
  sortOrder: number;
  stage: OpsStageOption | null;
  /** A etapa está prevista no cronograma para esta semana. */
  plannedThisWeek: boolean;
  rows: ActivityWeekRow[];
}

export function buildWeekGrid(input: {
  stages: ReadonlyArray<OpsStageOption>;
  activities: ReadonlyArray<OpsActivityView>;
  assignments: ReadonlyArray<OpsAssignment>;
  days: ReadonlyArray<WeekDay>;
}): StageWeekSection[] {
  const { stages, activities, assignments, days } = input;
  if (days.length === 0) return [];
  const from = days[0].iso;
  const to = days[days.length - 1].iso;
  const dayset = new Set(days.map((d) => d.iso));

  const byActivity = new Map<string, OpsAssignment[]>();
  for (const a of assignments) {
    if (!dayset.has(a.work_date)) continue;
    const list = byActivity.get(a.activity_id);
    if (list) list.push(a);
    else byActivity.set(a.activity_id, [a]);
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const sections = new Map<string, StageWeekSection>();
  const sectionFor = (stageId: string | null): StageWeekSection => {
    const key = stageId ?? "__sem_etapa__";
    let sec = sections.get(key);
    if (!sec) {
      const st = stageId ? stageById.get(stageId) ?? null : null;
      sec = {
        stageId,
        stageName: st?.description ?? "Sem etapa",
        sortOrder: st?.sort_order ?? Number.MAX_SAFE_INTEGER,
        stage: st,
        plannedThisWeek: !!st && overlaps(st.planned_start, st.planned_end, from, to),
        rows: [],
      };
      sections.set(key, sec);
    }
    return sec;
  };

  // Etapas previstas para a semana entram mesmo sem atividade (convite a planejar).
  for (const st of stages) {
    if (overlaps(st.planned_start, st.planned_end, from, to) && !st.actual_end) sectionFor(st.id);
  }

  for (const act of activities) {
    if (!act.id) continue;
    const list = byActivity.get(act.id) ?? [];
    const stageId = act.stage_id ?? null;
    const st = stageId ? stageById.get(stageId) : undefined;
    const open = !!act.status && !isOpsActivityClosed(act.status);
    const stagePlanned = !!st && overlaps(st.planned_start, st.planned_end, from, to);
    const ownPlanned = overlaps(act.planned_start, act.planned_end, from, to);
    const neverScheduled = (act.assignments_total ?? 0) === 0;
    // Aberta, sem nenhum dia marcado e que já devia ter começado: precisa
    // aparecer para ganhar dia. É o caso de "+ Atividade" numa etapa cujo
    // período do cronograma já passou e do retrabalho criado pelo "Refazer".
    const start = act.planned_start ?? st?.planned_start ?? null;
    const waitingForDay = open && neverScheduled && (!start || start <= to);
    // Concluída sem dia nenhum não tem outra semana onde aparecer; sem isto
    // não haveria como chegar no "Aprovar / Refazer".
    const waitingForReview = act.status === "concluida" && neverScheduled;
    if (list.length === 0 && !(open && (stagePlanned || ownPlanned)) && !waitingForDay && !waitingForReview) continue;
    const cells: Record<string, OpsAssignment[]> = {};
    for (const a of list) (cells[a.work_date] ??= []).push(a);
    sectionFor(stageId).rows.push({ activity: act, cells, limit: limitFor(act, st), inWeek: list.length });
  }

  return [...sections.values()]
    .map((s) => ({
      ...s,
      rows: s.rows.sort(
        (a, b) =>
          (a.activity.sort_order ?? 0) - (b.activity.sort_order ?? 0) ||
          (a.activity.title ?? "").localeCompare(b.activity.title ?? "", "pt-BR"),
      ),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.stageName.localeCompare(b.stageName, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Faixas de resumo
// ---------------------------------------------------------------------------

export interface WeekMaterialSummary {
  total: number;
  onSite: number;
  missing: { id: string; description: string; neededBy: string | null }[];
}

/** Material das atividades que têm dia marcado na semana. */
export function weekMaterialSummary(
  materials: ReadonlyArray<OpsMaterial>,
  activityIdsInWeek: ReadonlySet<string>,
): WeekMaterialSummary {
  const relevant = materials.filter((m) => activityIdsInWeek.has(m.activity_id));
  const missing = relevant
    .filter((m) => m.status !== "na_obra")
    .sort((a, b) => (a.needed_by ?? "9999").localeCompare(b.needed_by ?? "9999"))
    .map((m) => ({ id: m.id, description: m.description, neededBy: m.needed_by }));
  return { total: relevant.length, onSite: relevant.length - missing.length, missing };
}

export interface WeekCounts {
  planned: number;
  done: number;
  notDone: number;
  /** Dias que já passaram (ou hoje) e ninguém confirmou. */
  unconfirmed: number;
}

export function weekCounts(
  assignments: ReadonlyArray<Pick<OpsAssignment, "work_date" | "outcome">>,
  days: ReadonlyArray<WeekDay>,
  now: Date = new Date(),
): WeekCounts {
  const today = todayISO(now);
  const dayset = new Set(days.map((d) => d.iso));
  let planned = 0;
  let done = 0;
  let notDone = 0;
  let unconfirmed = 0;
  for (const a of assignments) {
    if (!dayset.has(a.work_date)) continue;
    planned += 1;
    if (a.outcome === "feito") done += 1;
    else if (a.outcome === "nao_feito") notDone += 1;
    else if (a.work_date <= today) unconfirmed += 1;
  }
  return { planned, done, notDone, unconfirmed };
}

// ---------------------------------------------------------------------------
// Planejar semana (proposta automática)
// ---------------------------------------------------------------------------

export type ProposalKind = "sobrou" | "continua" | "sem_dia" | "cronograma";

export const PROPOSAL_KIND_LABEL: Record<ProposalKind, string> = {
  sobrou: "Sobrou da semana passada",
  continua: "Em execução",
  sem_dia: "Ainda sem dia",
  cronograma: "Prevista no cronograma",
};

export interface WeekProposal {
  key: string;
  kind: ProposalKind;
  /** null quando a atividade ainda não existe (etapa do cronograma sem atividade). */
  activityId: string | null;
  stageId: string;
  stageName: string;
  stageSort: number;
  title: string;
  days: string[];
  who: Pick<OpsAssignment, "user_id" | "worker_name"> | null;
}

/** Dias úteis da lista que caem dentro de [start, end]. */
export function overlapDays(start: string | null | undefined, end: string | null | undefined, workingDays: readonly string[]) {
  if (!start || !end) return [];
  return workingDays.filter((d) => d >= start && d <= end);
}

const KIND_ORDER: Record<ProposalKind, number> = { sobrou: 0, continua: 1, sem_dia: 2, cronograma: 3 };

export function proposeWeek(input: {
  stages: ReadonlyArray<OpsStageOption>;
  activities: ReadonlyArray<OpsActivityView>;
  /** Alocações da semana anterior. */
  previous: ReadonlyArray<OpsAssignment>;
  /** Alocações já marcadas na semana que está sendo planejada. */
  current: ReadonlyArray<OpsAssignment>;
  /** Dias úteis da semana planejada (sem feriados), em ordem. */
  workingDays: readonly string[];
}): WeekProposal[] {
  const { stages, activities, previous, current, workingDays } = input;
  if (workingDays.length === 0) return [];
  const first = workingDays[0];
  const last = workingDays[workingDays.length - 1];
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const scheduled = new Set(current.map((a) => a.activity_id));
  const prevByActivity = new Map<string, OpsAssignment[]>();
  for (const a of previous) {
    const list = prevByActivity.get(a.activity_id);
    if (list) list.push(a);
    else prevByActivity.set(a.activity_id, [a]);
  }

  const out: WeekProposal[] = [];
  const stagesWithActivity = new Set<string>();

  for (const act of activities) {
    if (!act.id) continue;
    if (act.stage_id) stagesWithActivity.add(act.stage_id);
    if (!act.status || isOpsActivityClosed(act.status) || act.status === "bloqueada") continue;
    if (!act.stage_id || scheduled.has(act.id)) continue;
    const st = stageById.get(act.stage_id);
    const base = {
      activityId: act.id,
      stageId: act.stage_id,
      stageName: st?.description ?? act.stage_name ?? "Etapa",
      stageSort: st?.sort_order ?? act.stage_sort_order ?? 0,
      title: act.title ?? "Atividade",
    };
    const prev = (prevByActivity.get(act.id) ?? []).sort((a, b) => a.work_date.localeCompare(b.work_date));
    const lastPrev = prev[prev.length - 1];
    const lastWho = lastPrev ? { user_id: lastPrev.user_id, worker_name: lastPrev.worker_name } : null;
    const leftover = prev.filter((a) => a.outcome !== "feito").length;

    if (leftover > 0) {
      out.push({ ...base, key: `sobrou:${act.id}`, kind: "sobrou", days: workingDays.slice(0, Math.min(leftover, workingDays.length)), who: lastWho });
      continue;
    }
    if (act.status === "em_execucao" && prev.length > 0) {
      out.push({ ...base, key: `continua:${act.id}`, kind: "continua", days: workingDays.slice(0, Math.min(prev.length, workingDays.length)), who: lastWho });
      continue;
    }
    // Já teve dia marcado, mas não na semana passada (feriado, obra parada,
    // semana que ninguém planejou): continua aberta, então volta para a lista
    // em vez de sumir das sugestões.
    if ((act.assignments_total ?? 0) > 0 && act.last_work_date && act.last_work_date < first) {
      const owed = (act.assignments_not_done ?? 0) + (act.assignments_pending ?? 0);
      const who = act.responsible_user_id ? { user_id: act.responsible_user_id, worker_name: null } : null;
      out.push({
        ...base,
        key: `${owed > 0 ? "sobrou" : "continua"}:${act.id}`,
        kind: owed > 0 ? "sobrou" : "continua",
        days: workingDays.slice(0, Math.min(Math.max(1, owed), workingDays.length)),
        who,
      });
      continue;
    }
    if ((act.assignments_total ?? 0) === 0) {
      const start = act.planned_start ?? st?.planned_start ?? null;
      const end = act.planned_end ?? st?.planned_end ?? null;
      if (!start || !end || start > last) continue; // sem data ou só para o futuro
      let days = overlapDays(start, end, workingDays);
      if (days.length === 0 && end < first) days = [first]; // já devia ter acontecido
      if (days.length === 0) continue;
      out.push({
        ...base,
        key: `sem_dia:${act.id}`,
        kind: "sem_dia",
        days,
        who: act.responsible_user_id ? { user_id: act.responsible_user_id, worker_name: null } : null,
      });
    }
  }

  for (const st of stages) {
    if (stagesWithActivity.has(st.id) || st.actual_end) continue;
    const days = overlapDays(st.planned_start, st.planned_end, workingDays);
    if (days.length === 0) continue;
    out.push({
      key: `cronograma:${st.id}`,
      kind: "cronograma",
      activityId: null,
      stageId: st.id,
      stageName: st.description,
      stageSort: st.sort_order,
      title: st.description,
      days,
      who: null,
    });
  }

  return out.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.stageSort - b.stageSort ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
}
