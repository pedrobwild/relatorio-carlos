/**
 * Prazo contratual no Painel de Obras.
 *
 * Regra única para tabela, quadro, kanban, celular e indicadores: quando a
 * obra tem prazo contratual, ele manda (só muda com aditivo aceito). Sem prazo
 * cadastrado, mantém o comportamento anterior baseado na entrega oficial
 * (`planned_end_date`), que é editável e por isso podia esconder atraso.
 */
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import { deadlineHealth, type DeadlineHealth } from "@/lib/contractDeadline";

interface ObraPrazoFields {
  entrega_oficial: string | null;
  entrega_real: string | null;
  prazo_contratual?: ProjectDeadline | null;
}

/** Anexa o prazo contratual a cada obra (sem alterar as demais propriedades). */
export function attachDeadlines<T extends { id: string }>(
  obras: T[],
  deadlines: ProjectDeadline[] | undefined,
): (T & { prazo_contratual: ProjectDeadline | null })[] {
  const byId = new Map<string, ProjectDeadline>();
  for (const d of deadlines ?? []) if (d.project_id) byId.set(d.project_id, d);
  return obras.map((o) => ({ ...o, prazo_contratual: byId.get(o.id) ?? null }));
}

/** Data-limite que o Painel usa: entrega vigente do contrato, senão a oficial. */
export function effectiveDeadline(o: ObraPrazoFields): string | null {
  return o.prazo_contratual?.current_deadline ?? o.entrega_oficial ?? null;
}

/** True quando a obra tem prazo contratual calculado. */
export function hasContractDeadline(o: ObraPrazoFields): boolean {
  return !!o.prazo_contratual?.current_deadline;
}

/** Dias úteis de atraso pelo contrato (null = obra sem prazo contratual). */
export function contractLateDays(o: ObraPrazoFields): number | null {
  if (!hasContractDeadline(o)) return null;
  if (o.entrega_real) return 0;
  return Math.max(0, o.prazo_contratual?.business_days_late ?? 0);
}

/** Situação do prazo da obra. Obra entregue nunca é "atrasada" aqui. */
export function obraPrazoHealth(o: ObraPrazoFields): DeadlineHealth {
  if (!hasContractDeadline(o)) return "sem_prazo";
  if (o.entrega_real) return "no_prazo";
  return deadlineHealth(o.prazo_contratual);
}

/**
 * Risco de prazo para o indicador do topo.
 * - Com contrato: situação "atenção" (folga ≤ máx(5 du, 10% do prazo)).
 * - Sem contrato: regra antiga — entrega oficial nos próximos 7 dias.
 */
export function isPrazoEmRisco(o: ObraPrazoFields, todayIso: string, sevenDaysIso: string): boolean {
  if (o.entrega_real) return false;
  if (hasContractDeadline(o)) return obraPrazoHealth(o) === "atencao";
  if (!o.entrega_oficial) return false;
  return o.entrega_oficial >= todayIso && o.entrega_oficial <= sevenDaysIso;
}

/** Soma da multa acumulada (R$) das obras informadas. */
export function sumAccruedPenalty(obras: ObraPrazoFields[]): number {
  return obras.reduce((acc, o) => acc + (o.prazo_contratual?.penalty_accrued_value ?? 0), 0);
}

/**
 * Comparador por folga: mais atrasada primeiro, depois menor folga; obras
 * entregues e sem prazo contratual vão para o fim.
 */
export function compareByFolga(a: ObraPrazoFields, b: ObraPrazoFields): number {
  const rank = (o: ObraPrazoFields) => {
    if (o.entrega_real) return Number.POSITIVE_INFINITY;
    const r = o.prazo_contratual?.business_days_remaining;
    return r == null ? Number.MAX_SAFE_INTEGER : r;
  };
  const ra = rank(a);
  const rb = rank(b);
  return ra === rb ? 0 : ra < rb ? -1 : 1;
}
