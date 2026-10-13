/**
 * Rascunho da gaveta do Cronograma interno: valores do formulário e a
 * validação/normalização antes de gravar. Fora do componente para ser
 * testável e para o componente só exportar componentes.
 */
import type { InternalScheduleItemWithRefs } from "@/infra/repositories/internalSchedule.repository";
import { validateItemDates } from "@/lib/internalSchedule";

export interface InternalItemDraft {
  description: string;
  etapa: string;
  detailed_description: string;
  notes: string;
  planned_start: string;
  planned_end: string;
  weight: string;
  predecessor_ids: string[];
  responsible_user_id: string | null;
  fornecedor_id: string | null;
}

/** O que a gaveta devolve ao salvar (já normalizado para o banco). */
export interface InternalItemValues {
  description: string;
  etapa: string | null;
  detailed_description: string | null;
  notes: string | null;
  planned_start: string;
  planned_end: string;
  weight: number;
  predecessor_ids: string[];
  responsible_user_id: string | null;
  fornecedor_id: string | null;
}

export type SheetMode =
  | { kind: "edit"; item: InternalScheduleItemWithRefs }
  | { kind: "create"; parent: InternalScheduleItemWithRefs | null; defaults: Partial<InternalItemDraft> };

export function draftFrom(item: InternalScheduleItemWithRefs | null, defaults: Partial<InternalItemDraft> = {}): InternalItemDraft {
  return {
    description: item?.description ?? defaults.description ?? "",
    etapa: item?.etapa ?? defaults.etapa ?? "",
    detailed_description: item?.detailed_description ?? defaults.detailed_description ?? "",
    notes: item?.notes ?? defaults.notes ?? "",
    planned_start: item?.planned_start ?? defaults.planned_start ?? "",
    planned_end: item?.planned_end ?? defaults.planned_end ?? "",
    weight: String(item?.weight ?? defaults.weight ?? "0"),
    predecessor_ids: item?.predecessor_ids ?? defaults.predecessor_ids ?? [],
    responsible_user_id: item?.responsible_user_id ?? defaults.responsible_user_id ?? null,
    fornecedor_id: item?.fornecedor_id ?? defaults.fornecedor_id ?? null,
  };
}

/** Valida e normaliza o rascunho. Retorna a mensagem de erro ou os valores. */
export function normalizeDraft(d: InternalItemDraft): { error: string } | { values: InternalItemValues } {
  const description = d.description.trim();
  if (!description) return { error: "Informe a descrição." };
  const dateError = validateItemDates({ planned_start: d.planned_start, planned_end: d.planned_end });
  if (dateError) return { error: dateError };
  const weight = Number(String(d.weight).replace(",", "."));
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) return { error: "O peso vai de 0 a 100." };
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  return {
    values: {
      description,
      etapa: orNull(d.etapa),
      detailed_description: orNull(d.detailed_description),
      notes: orNull(d.notes),
      planned_start: d.planned_start,
      planned_end: d.planned_end,
      weight: Math.round(weight * 100) / 100,
      predecessor_ids: d.predecessor_ids,
      responsible_user_id: d.responsible_user_id,
      fornecedor_id: d.fornecedor_id,
    },
  };
}
