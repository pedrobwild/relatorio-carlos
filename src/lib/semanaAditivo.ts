/**
 * Aditivo de prazo "em 2 toques" no fechamento da semana (Fase 6).
 *
 * Ao fechar a semana, os dias "Não feito" são agrupados pelo motivo. Quando o
 * atraso não foi da empresa (cliente, condomínio, clima, projeto de terceiros,
 * material que o cliente fornece), o gestor toca "Não foi nosso" e
 * "Registrar": nasce um RASCUNHO de aditivo (`contract_term_amendments`) com
 * motivo, dias úteis, descrição e as fotos do dia como evidência. O escritório
 * é quem envia ao cliente e marca como aceito; só o aceito mexe no prazo.
 *
 * Regras puras, sem React nem Supabase.
 */
import type { Database } from "@/integrations/supabase/types";
import type { OpsAssignment, OpsBlockReason } from "@/infra/repositories/ops.repository";
import { OPS_REASON_LABEL, OPS_REASONS_EXTERNAL } from "@/lib/opsLabels";
import { shiftISODate } from "@/lib/hojeDia";
import { ddmmOf } from "@/lib/semanaFechamento";
import { weekLabel } from "@/lib/semanaPlan";

export type AmendmentReason = Database["public"]["Enums"]["contract_amendment_reason"];
export type AmendmentStatus = Database["public"]["Enums"]["contract_amendment_status"];

export const AMENDMENT_REASON_LABEL: Record<AmendmentReason, string> = {
  cliente_decisao: "Decisão do cliente",
  cliente_fornecimento: "Material ou serviço do cliente",
  condominio: "Condomínio",
  forca_maior: "Clima ou força maior",
  projeto_terceiros: "Projeto de terceiros",
  outro: "Outro",
};

export const AMENDMENT_STATUS_LABEL: Record<AmendmentStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado ao cliente",
  aceito: "Aceito",
  contestado: "Contestado",
};

/**
 * Motivo do "Não feito" → motivo do aditivo sugerido. "Faltou equipe" é
 * sempre da empresa: não vira aditivo (null).
 */
export const AMENDMENT_REASON_FROM_OPS: Record<OpsBlockReason, AmendmentReason | null> = {
  cliente_decisao: "cliente_decisao",
  condominio: "condominio",
  clima: "forca_maior",
  projeto: "projeto_terceiros",
  material: "cliente_fornecimento",
  outro: "outro",
  equipe: null,
};

/** Limite do campo de dias no rascunho (um aditivo de semana não passa disso). */
export const MAX_AMENDMENT_DAYS = 30;

type NotDoneItem = Pick<OpsAssignment, "id" | "activity_id" | "work_date" | "not_done_reason" | "photo_paths">;

export interface AmendmentCandidate {
  /** Motivo do "Não feito" que agrupa os dias. */
  opsReason: OpsBlockReason;
  /** Motivo sugerido para o aditivo (editável). */
  reason: AmendmentReason;
  /** Costuma não ser da empresa (cliente, condomínio, clima): aparece primeiro. */
  likelyExternal: boolean;
  /** Dias distintos sem execução por esse motivo = dias úteis sugeridos. */
  days: number;
  /** Primeiro dia sem execução (data do evento do aditivo). */
  firstDate: string;
  /** Datas distintas, em ordem. */
  dates: string[];
  /** Atividades afetadas (títulos, sem repetir, na ordem dos dias). */
  activityTitles: string[];
  /** Fotos já tiradas nesses dias (caminhos no bucket ops-photos). */
  photoPaths: string[];
  assignmentIds: string[];
}

/**
 * Agrupa os "Não feito" da semana pelo motivo, sem "Faltou equipe" nem dia
 * sem motivo. Prováveis externos primeiro; depois por número de dias.
 */
export function amendmentCandidates(
  notDone: ReadonlyArray<NotDoneItem>,
  titleOf: (activityId: string) => string,
): AmendmentCandidate[] {
  const groups = new Map<OpsBlockReason, NotDoneItem[]>();
  for (const a of notDone) {
    const r = a.not_done_reason;
    if (!r || !AMENDMENT_REASON_FROM_OPS[r]) continue;
    const list = groups.get(r) ?? [];
    list.push(a);
    groups.set(r, list);
  }
  const out: AmendmentCandidate[] = [];
  for (const [opsReason, items] of groups) {
    const sorted = [...items].sort((x, y) => x.work_date.localeCompare(y.work_date));
    const dates = [...new Set(sorted.map((a) => a.work_date))];
    const titles = [...new Set(sorted.map((a) => titleOf(a.activity_id)))];
    const photos = [...new Set(sorted.flatMap((a) => a.photo_paths ?? []))];
    out.push({
      opsReason,
      reason: AMENDMENT_REASON_FROM_OPS[opsReason] as AmendmentReason,
      likelyExternal: OPS_REASONS_EXTERNAL.has(opsReason),
      days: dates.length,
      firstDate: dates[0],
      dates,
      activityTitles: titles,
      photoPaths: photos,
      assignmentIds: sorted.map((a) => a.id),
    });
  }
  return out.sort(
    (a, b) =>
      Number(b.likelyExternal) - Number(a.likelyExternal) ||
      b.days - a.days ||
      OPS_REASON_LABEL[a.opsReason].localeCompare(OPS_REASON_LABEL[b.opsReason], "pt-BR"),
  );
}

/** "a, b e mais 2" */
function listText(items: ReadonlyArray<string>, max = 3): string {
  if (items.length <= max) {
    return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
  }
  return `${items.slice(0, max).join(", ")} e mais ${items.length - max}`;
}

/**
 * Descrição automática do rascunho, para o escritório e (depois de aceito) o
 * cliente: semana, dias, atividades e motivo. Sem nomes de pessoas.
 * "Semana de 05/10 a 09/10: 2 dias sem execução (05/10, 06/10) em Elétrica do quarto — Aguardando decisão do cliente."
 */
export function amendmentDescription(c: AmendmentCandidate, monday: string): string {
  const daysText = c.days === 1 ? "1 dia sem execução" : `${c.days} dias sem execução`;
  return (
    `Semana de ${weekLabel(monday)}: ${daysText} (${c.dates.map(ddmmOf).join(", ")})` +
    ` em ${listText(c.activityTitles)} — ${OPS_REASON_LABEL[c.opsReason]}.`
  );
}

/** Aditivos com o evento dentro da semana (seg–dom). */
export function amendmentsInWeek<T extends { event_date: string }>(amendments: ReadonlyArray<T>, monday: string): T[] {
  const sunday = shiftISODate(monday, 6);
  return amendments.filter((a) => a.event_date >= monday && a.event_date <= sunday);
}

/** Dias do rascunho dentro do limite (1…MAX). */
export function clampAmendmentDays(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_AMENDMENT_DAYS, Math.max(1, Math.round(n)));
}

/** Quem pode mudar a situação (enviado / aceito / contestado) é o escritório. */
export const AMENDMENT_NEXT_STATUS: Record<AmendmentStatus, AmendmentStatus[]> = {
  rascunho: ["enviado"],
  enviado: ["aceito", "contestado"],
  contestado: ["enviado"],
  aceito: [],
};
