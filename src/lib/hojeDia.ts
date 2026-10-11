/**
 * Regras puras da tela Hoje (Fase 3).
 *
 * Mantidas fora dos componentes para serem testáveis e para que as telas
 * Semana e o fechamento de semana usem exatamente as mesmas contas.
 */
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";

/** yyyy-mm-dd no fuso local (o navegador do gestor, em São Paulo). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Interpreta yyyy-mm-dd como data local (sem o deslocamento de UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftISODate(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Aceita só yyyy-mm-dd válido vindo da URL; senão volta para hoje. */
export function normalizeDateParam(value: string | null | undefined, now: Date = new Date()): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayISO(now);
  const d = parseISODate(value);
  return toISODate(d) === value ? value : todayISO(now);
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Hoje", "Ontem", "Amanhã" ou "quarta, 14/10". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const today = todayISO(now);
  if (iso === today) return "Hoje";
  if (iso === shiftISODate(today, -1)) return "Ontem";
  if (iso === shiftISODate(today, 1)) return "Amanhã";
  return longDayLabel(iso);
}

export function longDayLabel(iso: string): string {
  const d = parseISODate(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]}, ${dd}/${mm}`;
}

/**
 * Só dá para confirmar o que já aconteceu ou está acontecendo: hoje ou dias
 * anteriores. Dia futuro é planejamento, não confirmação.
 */
export function canConfirmOn(iso: string, now: Date = new Date()): boolean {
  return iso <= todayISO(now);
}

/** Quem vai fazer, em linguagem de obra. */
export function whoLabel(
  a: Pick<OpsDayAssignment, "user_id" | "worker_name" | "fornecedor">,
  staffNameById: ReadonlyMap<string, string>,
): string {
  const parts: string[] = [];
  if (a.user_id) parts.push(staffNameById.get(a.user_id) ?? "Equipe interna");
  if (a.worker_name?.trim()) parts.push(a.worker_name.trim());
  if (a.fornecedor?.nome) parts.push(a.fornecedor.nome);
  return parts.length > 0 ? parts.join(" · ") : "Sem responsável";
}

export interface DayCounts {
  total: number;
  done: number;
  notDone: number;
  pending: number;
}

export function countDay(items: ReadonlyArray<Pick<OpsDayAssignment, "outcome">>): DayCounts {
  let done = 0;
  let notDone = 0;
  for (const i of items) {
    if (i.outcome === "feito") done += 1;
    else if (i.outcome === "nao_feito") notDone += 1;
  }
  return { total: items.length, done, notDone, pending: items.length - done - notDone };
}

export interface ObraDayGroup extends DayCounts {
  projectId: string;
  projectName: string;
  items: OpsDayAssignment[];
}

/**
 * Agrupa por obra. A ordem é FIXA durante o dia (obra por nome; dentro dela,
 * críticas primeiro, depois etapa e título): marcar "Feito" não pode mudar
 * cards de lugar debaixo do dedo de quem está na obra.
 */
export function groupByObra(items: ReadonlyArray<OpsDayAssignment>): ObraDayGroup[] {
  const map = new Map<string, OpsDayAssignment[]>();
  for (const it of items) {
    const key = it.project_id;
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  const groups: ObraDayGroup[] = [];
  for (const [projectId, list] of map) {
    const sorted = [...list].sort(
      (a, b) =>
        Number(!!b.activity?.is_critical) - Number(!!a.activity?.is_critical) ||
        (a.activity?.stage?.description ?? "").localeCompare(b.activity?.stage?.description ?? "", "pt-BR") ||
        (a.activity?.title ?? "").localeCompare(b.activity?.title ?? "", "pt-BR") ||
        a.id.localeCompare(b.id),
    );
    groups.push({
      projectId,
      projectName: list[0]?.project?.name ?? "Obra",
      items: sorted,
      ...countDay(list),
    });
  }
  return groups.sort(
    (a, b) => a.projectName.localeCompare(b.projectName, "pt-BR") || a.projectId.localeCompare(b.projectId),
  );
}

/** Frase curta para o topo: "3 de 5 confirmados · 1 não feito". */
export function progressPhrase(c: DayCounts): string {
  if (c.total === 0) return "Nada planejado";
  const confirmed = c.done + c.notDone;
  const base = `${confirmed} de ${c.total} confirmado${c.total === 1 ? "" : "s"}`;
  return c.notDone > 0 ? `${base} · ${c.notDone} não feito${c.notDone === 1 ? "" : "s"}` : base;
}

/** "Feito às 14:32" a partir do carimbo do banco. */
export function doneAtLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
