/**
 * Rótulos PT-BR da camada de Operação, fonte única para as telas
 * Hoje / Semana. Linguagem de obra, sem jargão de sistema.
 */
import type {
  OpsActivityStatus,
  OpsBlockReason,
  OpsMaterialStatus,
} from "@/infra/repositories/ops.repository";

export const OPS_STATUS_LABEL: Record<OpsActivityStatus, string> = {
  planejada: "Planejada",
  pronta: "Pronta para começar",
  em_execucao: "Em execução",
  concluida: "Concluída",
  aprovada: "Aprovada",
  refazer: "Refazer",
  bloqueada: "Bloqueada",
};

/** Lista fixa de motivos (usada em "Não feito" e em "Bloqueada"). */
export const OPS_REASON_LABEL: Record<OpsBlockReason, string> = {
  material: "Faltou material",
  equipe: "Faltou equipe",
  cliente_decisao: "Aguardando decisão do cliente",
  condominio: "Condomínio",
  projeto: "Problema de projeto",
  clima: "Clima",
  outro: "Outro",
};

/** Motivos que não são responsabilidade da empresa: candidatos a aditivo de prazo. */
export const OPS_REASONS_EXTERNAL: ReadonlySet<OpsBlockReason> = new Set([
  "cliente_decisao",
  "condominio",
  "clima",
]);

export const OPS_MATERIAL_LABEL: Record<OpsMaterialStatus, string> = {
  pendente: "Pendente",
  comprado: "Comprado",
  na_obra: "Na obra",
};

/** Atividade já encerrada (não aparece como pendente nas telas). */
export function isOpsActivityClosed(status: OpsActivityStatus): boolean {
  return status === "aprovada" || status === "concluida" || status === "refazer";
}
