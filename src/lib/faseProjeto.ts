/**
 * Regras puras da FASE DE PROJETO (as seis etapas antes da obra).
 *
 * Sem React e sem banco: recebem as linhas de `project_phase_steps` de uma
 * obra e o dia de hoje, e devolvem o que as telas mostram — em que etapa a
 * obra está, o que está atrasado e o veredito da obra ("Atrasada há 4 dias",
 * "Vence hoje", "Pronta para iniciar").
 *
 * A ordem das etapas é a mesma do enum `project_phase_step` do banco, que o
 * gatilho e a RPC `move_project_to_phase_step` também seguem.
 *
 * Datas são sempre "yyyy-mm-dd" e toda conta de dias passa por
 * `@/lib/hojeDia` (data local, sem o deslocamento de UTC): o resultado é o
 * mesmo no navegador em São Paulo e no CI em UTC.
 */
import type { Database } from "@/integrations/supabase/types";
import { parseISODate, todayISO } from "@/lib/hojeDia";

/** Chave de uma etapa — o enum `project_phase_step` do banco. */
export type PhaseStepKey = Database["public"]["Enums"]["project_phase_step"];

export interface PhaseStepDef {
  key: PhaseStepKey;
  /** Nome completo, para títulos e formulários. */
  label: string;
  /** Nome curto, para colunas, chips e passos de um trilho. */
  shortLabel: string;
}

/** As seis etapas, NA ORDEM do fluxo. */
export const PHASE_STEPS: readonly PhaseStepDef[] = [
  { key: "projeto_3d", label: "Projeto 3D", shortLabel: "3D" },
  { key: "projeto_executivo", label: "Projeto executivo", shortLabel: "Executivo" },
  { key: "medicao_fina", label: "Medição fina in loco", shortLabel: "Medição" },
  { key: "emissao_art", label: "Emissão da ART/RRT", shortLabel: "ART/RRT" },
  { key: "solicitacao_aprovacao", label: "Pedido de aprovação ao condomínio", shortLabel: "Pedido ao condomínio" },
  { key: "aprovacao_condominio", label: "Aprovação do condomínio recebida", shortLabel: "Aprovação" },
] as const;

/** Dias corridos (hoje incluído) em que um prazo já conta como "vence logo". */
export const PHASE_DUE_SOON_DAYS = 3;

/** Regra da empresa: início oficial = N dias úteis após a aprovação do condomínio. */
export const OFFICIAL_START_BUSINESS_DAYS = 5;

/** O que as regras leem de cada linha de `project_phase_steps`. */
export interface PhaseStepRow {
  step: PhaseStepKey;
  done_at: string | null;
  due_date: string | null;
  responsible_user_id: string | null;
  notes: string | null;
}

export interface PhaseStepState extends PhaseStepDef {
  /** Existe linha no banco para esta etapa (algo já foi registrado nela). */
  registered: boolean;
  done: boolean;
  /** Dia em que foi concluída (yyyy-mm-dd) ou null. */
  doneAt: string | null;
  /** Prazo combinado (yyyy-mm-dd) ou null. */
  dueDate: string | null;
  responsibleUserId: string | null;
  notes: string | null;
  /** É a etapa em que a obra está agora (a primeira não concluída). */
  isCurrent: boolean;
  /** Em aberto, com prazo vencido (prazo anterior a hoje). */
  late: boolean;
  /** Dias corridos de atraso; 0 quando não está atrasada. */
  daysLate: number;
  /**
   * Dias corridos até o prazo: 0 = vence hoje, negativo = venceu.
   * null quando a etapa já foi concluída ou não tem prazo.
   */
  daysToDue: number | null;
}

export interface PhaseState {
  /** Sempre as seis etapas, na ordem do fluxo. */
  steps: PhaseStepState[];
  /** Etapa em que a obra está; null = as seis concluídas. */
  current: PhaseStepState | null;
  doneCount: number;
  /** false = nada foi registrado para esta obra ainda (nenhuma linha). */
  registered: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-mm-dd válido, ou null (texto vazio, carimbo com hora, lixo). */
function cleanDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return ISO_DATE.test(day) ? day : null;
}

/** Dias corridos de `from` até `to` (negativo se `to` é anterior). */
function daysBetween(from: string, to: string): number {
  // Math.round absorve a hora a mais/a menos de uma virada de horário de verão.
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

/**
 * Estado da fase de projeto de uma obra.
 *
 * @param rows  linhas de `project_phase_steps` da obra (em qualquer ordem;
 *              etapa sem linha = ainda não registrada, em aberto).
 * @param today dia de referência (yyyy-mm-dd); padrão: hoje no aparelho.
 */
export function phaseState(
  rows: ReadonlyArray<PhaseStepRow> | null | undefined,
  today: string = todayISO(),
): PhaseState {
  const byStep = new Map<PhaseStepKey, PhaseStepRow>();
  for (const row of rows ?? []) {
    if (!byStep.has(row.step)) byStep.set(row.step, row);
  }

  const steps: PhaseStepState[] = [];
  let current: PhaseStepState | null = null;
  let doneCount = 0;

  for (const def of PHASE_STEPS) {
    const row = byStep.get(def.key);
    const doneAt = cleanDate(row?.done_at);
    const dueDate = cleanDate(row?.due_date);
    const done = doneAt !== null;
    const daysToDue = !done && dueDate ? daysBetween(today, dueDate) : null;
    const late = daysToDue !== null && daysToDue < 0;
    const isCurrent = !done && current === null;

    const step: PhaseStepState = {
      ...def,
      registered: !!row,
      done,
      doneAt,
      dueDate,
      responsibleUserId: row?.responsible_user_id ?? null,
      notes: row?.notes ?? null,
      isCurrent,
      late,
      daysLate: late && daysToDue !== null ? -daysToDue : 0,
      daysToDue,
    };

    if (done) doneCount += 1;
    if (isCurrent) current = step;
    steps.push(step);
  }

  return { steps, current, doneCount, registered: byStep.size > 0 };
}

export type PhaseVerdictKind =
  /** A etapa atual passou do prazo. */
  | "atrasada"
  /** A etapa atual vence hoje ou nos próximos PHASE_DUE_SOON_DAYS dias. */
  | "vence_logo"
  /** A etapa atual tem prazo e ele está longe. */
  | "no_prazo"
  /** A etapa atual não tem prazo combinado. */
  | "sem_prazo"
  /** As seis etapas concluídas. */
  | "pronta";

export interface PhaseVerdict {
  verdict: PhaseVerdictKind;
  /** Texto curto para o card/linha da obra. */
  text: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Veredito da obra na fase de projeto. Só o prazo da etapa ATUAL decide:
 * uma etapa futura com prazo vencido aparece atrasada na lista de etapas
 * (`PhaseStepState.late`), mas não muda o veredito da obra.
 */
export function phaseVerdict(state: PhaseState): PhaseVerdict {
  const current = state.current;
  if (!current) return { verdict: "pronta", text: "Pronta para iniciar" };
  if (current.daysToDue === null) return { verdict: "sem_prazo", text: "Sem prazo" };

  if (current.late) {
    const n = current.daysLate;
    return { verdict: "atrasada", text: `Atrasada há ${n} ${plural(n, "dia", "dias")}` };
  }

  const n = current.daysToDue;
  if (n <= PHASE_DUE_SOON_DAYS) {
    const text = n === 0 ? "Vence hoje" : n === 1 ? "Vence amanhã" : `Vence em ${n} dias`;
    return { verdict: "vence_logo", text };
  }
  return { verdict: "no_prazo", text: "No prazo" };
}

/** Nome completo de uma etapa ("Emissão da ART/RRT"). */
export function phaseStepLabel(key: PhaseStepKey): string {
  return PHASE_STEPS.find((s) => s.key === key)?.label ?? key;
}

/** "yyyy-mm-dd" → "dd/mm/aaaa", sem passar por Date (não há fuso para errar). */
function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * "Início oficial: 16/10/2026 (5 dias úteis após a aprovação)".
 * A data vem de `projects.date_official_start`, calculada pelo banco quando
 * a aprovação do condomínio é registrada. Sem data válida devolve null.
 */
export function officialStartText(dateISO: string | null | undefined): string | null {
  const day = cleanDate(dateISO);
  if (!day) return null;
  return `Início oficial: ${formatDateBR(day)} (${OFFICIAL_START_BUSINESS_DAYS} dias úteis após a aprovação)`;
}
