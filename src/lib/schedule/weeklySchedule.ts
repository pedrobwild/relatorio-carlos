/**
 * Geração do cronograma a partir de um template SEMANAL (modelos da PCO).
 *
 * Regras (todas com dia útil de `businessDays.ts`):
 * - Semana 1 vai do início até a sexta da mesma semana; com menos de 3 dias
 *   úteis, vai até a sexta seguinte. As demais vão de segunda a sexta.
 *   Feriado encurta a semana e não empurra as seguintes.
 * - Fim pelo contrato = addBusinessDays(início, prazo − 1).
 * - Folga: semanas inteiras que cabem ANTES da última semana do modelo sem
 *   passar do fim pelo contrato.
 */

import {
  addBusinessDays,
  countBusinessDaysInclusive,
  isHoliday,
  isNonBusinessDay,
} from "@/lib/businessDays";
import { toLocalISODate } from "@/lib/localDate";
import { evaluateShowIf } from "./showIf";

export const SLACK_DESCRIPTION = "Folga para repasses e atrasos";

export interface WeeklyTemplateActivity {
  description: string;
  week?: number;
  weekEnd?: number;
  kind?: "execucao" | "marco";
  showIf?: string;
  note?: string;
  purchases?: unknown[];
  durationDays?: number;
  weight?: number;
}

export interface ScheduleModel {
  type: "weekly";
  weeks: number;
  default_contract_business_days?: number;
  [extra: string]: unknown;
}

export interface CalendarWeek {
  /** Início de calendário (o próprio início na S1; segunda nas demais). */
  calStart: Date;
  /** Sexta da semana. */
  calEnd: Date;
  firstBusinessDay: Date | null;
  lastBusinessDay: Date | null;
  businessDays: number;
  /** Feriados em dia de semana dentro da semana (ISO). */
  holidays: string[];
}

export interface PlannedItem {
  id: string;
  description: string;
  kind: "execucao" | "marco";
  /** Semana gerada (1-based) em que a atividade começa. */
  week: number;
  /** Semana gerada em que termina (>= week). */
  weekEnd: number;
  note?: string;
  purchases?: unknown[];
  showIf?: string;
}

export interface PlannedWeek {
  index: number;
  label: string;
  isSlack: boolean;
  calStart: string;
  calEnd: string;
  firstBusinessDay: string | null;
  lastBusinessDay: string | null;
  businessDays: number;
  holidays: string[];
}

export interface WeeklyPlanAlert {
  kind: "overrun" | "delivery_non_business";
  message: string;
  /** Exige confirmação antes de cadastrar. */
  blocking: boolean;
}

export interface WeeklyPlan {
  weeks: PlannedWeek[];
  items: PlannedItem[];
  contractEnd: string;
  /** Semanas de folga que cabem (independente do toggle). */
  slackAvailable: number;
  /** Semanas de folga efetivamente usadas. */
  slackUsed: number;
  delivery: string | null;
  alerts: WeeklyPlanAlert[];
}

function atMidnight(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Sexta-feira da semana de `d` (se sábado/domingo, a sexta seguinte). */
function fridayOf(d: Date): Date {
  const day = d.getDay(); // 0 dom … 6 sáb
  const delta = day === 6 ? 6 : day === 0 ? 5 : 5 - day;
  return addDays(d, delta);
}

function describeRange(start: Date, end: Date): CalendarWeek {
  let first: Date | null = null;
  let last: Date | null = null;
  let count = 0;
  const holidays: string[] = [];
  for (let c = new Date(start); c <= end; c = addDays(c, 1)) {
    const dow = c.getDay();
    if (dow !== 0 && dow !== 6 && isHoliday(c)) holidays.push(toLocalISODate(c));
    if (!isNonBusinessDay(c)) {
      count++;
      if (!first) first = new Date(c);
      last = new Date(c);
    }
  }
  return {
    calStart: new Date(start),
    calEnd: new Date(end),
    firstBusinessDay: first,
    lastBusinessDay: last,
    businessDays: count,
    holidays,
  };
}

export function buildCalendarWeeks(startInput: Date, count: number): CalendarWeek[] {
  const start = atMidnight(startInput);
  const weeks: CalendarWeek[] = [];
  if (count <= 0) return weeks;
  let end = fridayOf(start);
  let w1 = describeRange(start, end);
  if (w1.businessDays < 3) {
    end = addDays(end, 7);
    w1 = describeRange(start, end);
  }
  weeks.push(w1);
  let monday = addDays(end, 3);
  while (weeks.length < count) {
    const friday = addDays(monday, 4);
    weeks.push(describeRange(monday, friday));
    monday = addDays(monday, 7);
  }
  return weeks;
}

export function contractEndDate(start: Date, businessDays: number): Date {
  return addBusinessDays(atMidnight(start), Math.max(0, businessDays - 1));
}

/** Semanas inteiras de folga que cabem antes da última semana do modelo. */
export function computeSlack(
  start: Date,
  modelWeeks: number,
  contractEnd: Date,
): number {
  const weeks = buildCalendarWeeks(start, modelWeeks + 60);
  let slack = 0;
  for (let k = 1; k < 60; k++) {
    const last = weeks[modelWeeks - 1 + k]?.lastBusinessDay;
    if (!last || last > contractEnd) break;
    slack = k;
  }
  return slack;
}

export interface GenerateOptions {
  start: Date;
  contractBusinessDays: number;
  useSlack: boolean;
  conditions: Record<string, string | undefined>;
}

let idSeq = 0;
function newId(): string {
  idSeq += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${idSeq}`;
}

export function generateWeeklyPlan(
  model: ScheduleModel,
  activities: WeeklyTemplateActivity[],
  opts: GenerateOptions,
): WeeklyPlan {
  const N = Math.max(1, Math.round(model.weeks));
  const contractEnd = contractEndDate(opts.start, opts.contractBusinessDays);
  const slackAvailable = computeSlack(opts.start, N, contractEnd);
  const slackUsed = opts.useSlack ? slackAvailable : 0;
  const total = N + slackUsed;

  const mapWeek = (w: number) => {
    const clamped = Math.min(Math.max(1, Math.round(w)), N);
    return clamped >= N ? clamped + slackUsed : clamped;
  };

  const items: PlannedItem[] = activities
    .filter((a) => a.description?.trim())
    .filter((a) => evaluateShowIf(a.showIf, opts.conditions))
    .map((a) => {
      const week = mapWeek(a.week ?? 1);
      const weekEnd = Math.max(week, mapWeek(a.weekEnd ?? a.week ?? 1));
      return {
        id: newId(),
        description: a.description.trim(),
        kind: a.kind === "marco" ? "marco" : "execucao",
        week,
        weekEnd,
        note: a.note,
        purchases: a.purchases,
        showIf: a.showIf,
      };
    });

  return finalizePlan(opts.start, total, N, slackUsed, slackAvailable, contractEnd, items);
}

/** Recalcula semanas/alertas mantendo os itens (usado após editar a prévia). */
export function finalizePlan(
  start: Date,
  totalWeeks: number,
  modelWeeks: number,
  slackUsed: number,
  slackAvailable: number,
  contractEnd: Date,
  items: PlannedItem[],
): WeeklyPlan {
  const cal = buildCalendarWeeks(start, totalWeeks);
  const slackStart = modelWeeks; // índice 1-based da 1ª folga
  const weeks: PlannedWeek[] = cal.map((w, i) => {
    const index = i + 1;
    const isSlack = index >= slackStart && index < slackStart + slackUsed;
    return {
      index,
      label: `Semana ${index}`,
      isSlack,
      calStart: toLocalISODate(w.calStart),
      calEnd: toLocalISODate(w.calEnd),
      firstBusinessDay: w.firstBusinessDay ? toLocalISODate(w.firstBusinessDay) : null,
      lastBusinessDay: w.lastBusinessDay ? toLocalISODate(w.lastBusinessDay) : null,
      businessDays: w.businessDays,
      holidays: w.holidays,
    };
  });

  const lastWeek = cal[cal.length - 1];
  const deliveryDate = lastWeek?.lastBusinessDay ?? null;
  const alerts: WeeklyPlanAlert[] = [];
  if (deliveryDate && deliveryDate > contractEnd) {
    const over = countBusinessDaysInclusive(addDays(contractEnd, 1), deliveryDate);
    alerts.push({
      kind: "overrun",
      blocking: true,
      message: `O cronograma passa ${over} ${over === 1 ? "dia útil" : "dias úteis"} do fim pelo contrato (${fmtBR(contractEnd)}).`,
    });
  }
  if (lastWeek && isNonBusinessDay(lastWeek.calEnd)) {
    alerts.push({
      kind: "delivery_non_business",
      blocking: false,
      message: `A sexta da última semana (${fmtBR(lastWeek.calEnd)}) é feriado. A entrega fica em ${deliveryDate ? fmtBR(deliveryDate) : "data a definir"}.`,
    });
  }

  return {
    weeks,
    items,
    contractEnd: toLocalISODate(contractEnd),
    slackAvailable,
    slackUsed,
    delivery: deliveryDate ? toLocalISODate(deliveryDate) : null,
    alerts,
  };
}

export function fmtBR(d: Date | string): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

/** Descrição da semana para o cronograma do cliente. */
export function weekClientDescription(plan: WeeklyPlan, weekIndex: number): string {
  const week = plan.weeks[weekIndex - 1];
  const exec = plan.items
    .filter((i) => i.kind === "execucao" && i.week === weekIndex)
    .map((i) => i.description);
  if (exec.length > 0) return exec.join(" / ");
  if (week?.isSlack) return SLACK_DESCRIPTION;
  return "Continuidade dos serviços";
}

/** Pesos iguais somando 100 (a última linha absorve o arredondamento). */
export function equalWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((100 / n) * 100) / 100;
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] = Math.round((100 - base * (n - 1)) * 100) / 100;
  return arr;
}

export interface WeeklyRows {
  client: {
    weekIndex: number;
    etapa: string;
    description: string;
    planned_start: string;
    planned_end: string;
    weight: number;
    sort_order: number;
  }[];
  internal: {
    weekIndex: number;
    description: string;
    kind: "execucao" | "marco";
    planned_start: string;
    planned_end: string;
    notes: string | null;
    sort_order: number;
  }[];
}

/** Linhas a gravar: uma por semana (cliente) + uma por atividade/marco (interno). */
export function buildWeeklyRows(plan: WeeklyPlan): WeeklyRows {
  const usable = plan.weeks.filter((w) => w.firstBusinessDay && w.lastBusinessDay);
  const weights = equalWeights(usable.length);
  const client = usable.map((w, i) => ({
    weekIndex: w.index,
    etapa: w.label,
    description: weekClientDescription(plan, w.index),
    planned_start: w.firstBusinessDay!,
    planned_end: w.lastBusinessDay!,
    weight: weights[i],
    sort_order: i,
  }));
  const byIndex = new Map(plan.weeks.map((w) => [w.index, w]));
  const internal = [...plan.items]
    .sort((a, b) => a.week - b.week)
    .map((it, i) => {
      const s = byIndex.get(it.week);
      const e = byIndex.get(it.weekEnd) ?? s;
      const notes = [it.kind === "marco" ? "Marco interno" : null, it.note ?? null]
        .filter(Boolean)
        .join(" · ");
      return {
        weekIndex: it.week,
        description: it.description,
        kind: it.kind,
        planned_start: s?.firstBusinessDay ?? s?.calStart ?? plan.contractEnd,
        planned_end: e?.lastBusinessDay ?? e?.calEnd ?? plan.contractEnd,
        notes: notes || null,
        sort_order: i,
      };
    });
  return { client, internal };
}

export function isWeeklyModel(model: unknown): model is ScheduleModel {
  return (
    !!model &&
    typeof model === "object" &&
    (model as ScheduleModel).type === "weekly" &&
    typeof (model as ScheduleModel).weeks === "number"
  );
}
