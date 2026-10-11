/**
 * Regras puras de leitura do prazo contratual (Fase 1).
 * O cálculo de dias úteis vive no banco (`v_project_deadlines`); aqui só
 * classificamos e formatamos para a interface.
 */
import type { ContractStartTrigger, ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";

export type DeadlineHealth = "sem_prazo" | "no_prazo" | "atencao" | "atrasada";

/** Folga mínima (dias úteis) abaixo da qual a obra entra em atenção. */
export const ATTENTION_MIN_DAYS = 5;
/** Fração do prazo restante abaixo da qual a obra entra em atenção. */
export const ATTENTION_FRACTION = 0.1;

export function deadlineHealth(
  d: Pick<ProjectDeadline, "current_deadline" | "business_days_remaining" | "current_business_days"> | null | undefined,
): DeadlineHealth {
  if (!d || !d.current_deadline || d.business_days_remaining == null) return "sem_prazo";
  if (d.business_days_remaining < 0) return "atrasada";
  const total = d.current_business_days ?? 0;
  const threshold = Math.max(ATTENTION_MIN_DAYS, Math.ceil(total * ATTENTION_FRACTION));
  return d.business_days_remaining <= threshold ? "atencao" : "no_prazo";
}

export const DEADLINE_HEALTH_LABEL: Record<DeadlineHealth, string> = {
  sem_prazo: "Prazo não cadastrado",
  no_prazo: "No prazo",
  atencao: "Atenção ao prazo",
  atrasada: "Atrasada",
};

export const START_TRIGGER_LABEL: Record<ContractStartTrigger, string> = {
  inicio_oficial: "Início oficial da obra",
  assinatura: "Assinatura do contrato",
  liberacao_condominio: "Liberação do condomínio",
  entrega_chaves: "Entrega das chaves",
  outro: "Outro",
};

/** Converte texto do formulário (aceita vírgula) em número ou null. */
export function parseDecimal(value: string): number | null {
  const raw = value.trim();
  // "1.234,5" (pt-BR) → 1234.5 ; "0.5" → 0.5 ; "0,5" → 0.5
  const v = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Valida os termos antes de salvar. Retorna a mensagem de erro ou null. */
export function validateContractTerms(t: {
  contract_business_days: number | null;
  contract_start_date: string | null;
  penalty_pct_per_day: number | null;
  penalty_cap_pct: number | null;
}): string | null {
  if (t.contract_business_days != null && (!Number.isInteger(t.contract_business_days) || t.contract_business_days <= 0)) {
    return "Dias úteis do contrato deve ser um número inteiro maior que zero.";
  }
  if (t.contract_business_days != null && !t.contract_start_date) {
    return "Informe a data do gatilho de início para calcular a entrega.";
  }
  if (t.penalty_pct_per_day != null && t.penalty_pct_per_day < 0) {
    return "A multa por dia não pode ser negativa.";
  }
  if (t.penalty_cap_pct != null && (t.penalty_cap_pct < 0 || t.penalty_cap_pct > 100)) {
    return "O teto da multa deve estar entre 0% e 100%.";
  }
  return null;
}
