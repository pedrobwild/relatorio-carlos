/**
 * Regras puras do fechamento de semana e do PPC (Fase 6).
 *
 * PPC = dias feitos ÷ dias marcados na semana da obra. Cada "dia" é uma
 * alocação (atividade × pessoa × dia). Ninguém digita o indicador: ele sai
 * do Feito / Não feito de cada dia. A semana só fecha quando todos os dias
 * marcados estão confirmados; o retrato gravado é calculado no banco.
 *
 * Nas primeiras semanas o que importa é REGISTRAR o PPC, não o valor —
 * por isso a tela não pinta o número de vermelho.
 */
import { parseISODate, shiftISODate } from "@/lib/hojeDia";
import { OPS_REASON_LABEL } from "@/lib/opsLabels";
import type { OpsAssignment, OpsBlockReason } from "@/infra/repositories/ops.repository";

/** PPC em % inteiro. null quando nada foi marcado. */
export function ppcOf(done: number, planned: number): number | null {
  if (!Number.isFinite(done) || !Number.isFinite(planned) || planned <= 0) return null;
  return Math.round((100 * Math.max(0, Math.min(done, planned))) / planned);
}

export function ppcLabel(ppc: number | null): string {
  return ppc == null ? "—" : `${ppc}%`;
}

/** "8 de 10 dias feitos" */
export function doneOfPlannedLabel(done: number, planned: number): string {
  return `${done} de ${planned} ${planned === 1 ? "dia feito" : "dias feitos"}`;
}

type AssignmentForClosing = Pick<OpsAssignment, "id" | "work_date" | "outcome" | "not_done_reason">;

export interface WeekClosingState<T extends AssignmentForClosing = AssignmentForClosing> {
  planned: number;
  done: number;
  notDone: number;
  /** Dias que já aconteceram (até hoje) e ninguém confirmou. */
  pending: T[];
  /** Dias marcados para depois de hoje: ainda não dá para confirmar. */
  future: T[];
  /** Dias confirmados como não feitos. */
  notDoneItems: T[];
  /** PPC do que está na tela agora (parcial enquanto houver dia sem confirmar). */
  ppc: number | null;
  /** Tudo confirmado e há o que fechar. */
  canClose: boolean;
}

/**
 * Situação da semana para fechar. `assignments` pode vir com dias de outras
 * semanas: só conta o que cai entre a segunda e o domingo (o sábado e o
 * domingo marcados entram, igual ao cálculo do banco).
 */
export function weekClosingState<T extends AssignmentForClosing>(
  assignments: ReadonlyArray<T>,
  monday: string,
  today: string,
): WeekClosingState<T> {
  const sunday = shiftISODate(monday, 6);
  const inWeek = assignments
    .filter((a) => a.work_date >= monday && a.work_date <= sunday)
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
  const done = inWeek.filter((a) => a.outcome === "feito").length;
  const notDoneItems = inWeek.filter((a) => a.outcome === "nao_feito");
  const open = inWeek.filter((a) => a.outcome == null);
  const pending = open.filter((a) => a.work_date <= today);
  const future = open.filter((a) => a.work_date > today);
  return {
    planned: inWeek.length,
    done,
    notDone: notDoneItems.length,
    pending,
    future,
    notDoneItems,
    ppc: ppcOf(done, inWeek.length),
    canClose: inWeek.length > 0 && open.length === 0,
  };
}

/** A semana já começou (dá para fechar)? Semana futura só se planeja. */
export function weekHasStarted(monday: string, today: string): boolean {
  return monday <= today;
}

/** A semana já terminou (passou do domingo)? */
export function weekIsOver(monday: string, today: string): boolean {
  return shiftISODate(monday, 6) < today;
}

/**
 * O retrato gravado não bate mais com os dias da tela (alguém mudou um
 * Feito / Não feito, trocou um motivo ou marcou outro dia depois de fechar).
 */
export function closingIsStale(
  closing: { planned: number; done: number; not_done: number; reasons?: unknown },
  live: Pick<WeekClosingState, "planned" | "done" | "notDone" | "pending" | "future"> &
    Partial<Pick<WeekClosingState, "notDoneItems">>,
): boolean {
  if (
    closing.planned !== live.planned ||
    closing.done !== live.done ||
    closing.not_done !== live.notDone ||
    live.pending.length > 0 ||
    live.future.length > 0
  ) {
    return true;
  }
  // Motivos: só compara quando os dois lados são conhecidos.
  const saved = closing.reasons;
  if (!live.notDoneItems || typeof saved !== "object" || saved === null || Array.isArray(saved)) return false;
  const now = reasonCounts(live.notDoneItems);
  const savedEntries = Object.entries(saved as Record<string, unknown>).filter(([, n]) => Number(n) > 0);
  return (
    savedEntries.length !== now.length ||
    now.some((r) => Number((saved as Record<string, unknown>)[r.reason] ?? 0) !== r.count)
  );
}

export interface ReasonCount {
  reason: OpsBlockReason;
  label: string;
  count: number;
}

/** Motivos do não feito, do mais frequente para o menos. */
export function reasonCounts(items: ReadonlyArray<Pick<OpsAssignment, "not_done_reason">>): ReasonCount[] {
  const counts = new Map<OpsBlockReason, number>();
  for (const a of items) {
    if (!a.not_done_reason) continue;
    counts.set(a.not_done_reason, (counts.get(a.not_done_reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, label: OPS_REASON_LABEL[reason], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

/** "Faltou material (2) · Clima (1)" */
export function reasonsText(reasons: ReadonlyArray<ReasonCount>): string {
  return reasons.map((r) => `${r.label} (${r.count})`).join(" · ");
}

const SHORT_WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "qua 14" */
export function shortDayLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${SHORT_WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

/** "14/10" */
export function ddmmOf(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
