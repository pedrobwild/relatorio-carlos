/**
 * Mapeamentos centralizados de domínio → StatusTone semântico.
 *
 * Use junto com `<StatusBadge tone={...}>` do design system premium.
 * Garante consistência visual (mesmo verde/amarelo/vermelho para a
 * mesma intenção em todas as telas de gestão).
 *
 * Tons:
 *  - neutral: rascunhos, indefinidos
 *  - info:    em andamento, aguardando ação
 *  - success: ok, concluído, aprovado
 *  - warning: atenção, atrito, revisão
 *  - danger:  bloqueio, atraso, crítico, recusado
 *  - muted:   pausado, arquivado, cancelado
 */
import type { StatusTone } from "@/components/ui-premium";

/* ───────── Projeto / Obra ───────── */

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  completed: "Concluída",
  paused: "Pausada",
  cancelled: "Cancelada",
};

export const PROJECT_STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  active: "success",
  completed: "info",
  paused: "warning",
  cancelled: "muted",
};

/* ───────── Severidade (NCs, tickets CS) ───────── */

export const SEVERITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const SEVERITY_TONE: Record<string, StatusTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

/* ───────── Prioridade (orçamentos, atividades) ───────── */

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_TONE: Record<string, StatusTone> = {
  low: "muted",
  normal: "neutral",
  high: "warning",
  urgent: "danger",
};

/* ───────── Auditoria (ação CRUD) ───────── */

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: "Criado",
  update: "Atualizado",
  delete: "Removido",
};

export const AUDIT_ACTION_TONE: Record<string, StatusTone> = {
  create: "success",
  update: "info",
  delete: "danger",
};

/* ───────── Orçamento (status interno) ───────── */

export const BUDGET_STATUS_LABEL: Record<string, string> = {
  requested: "Solicitado",
  in_progress: "Em Produção",
  review: "Revisão",
  waiting_info: "Aguardando Info",
  blocked: "Bloqueado",
  ready: "Pronto",
  sent_to_client: "Enviado ao Cliente",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
};

export const BUDGET_STATUS_TONE: Record<string, StatusTone> = {
  requested: "neutral",
  in_progress: "info",
  review: "warning",
  waiting_info: "warning",
  blocked: "danger",
  ready: "success",
  sent_to_client: "success",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

/* ───────── Compras (calendário simplificado) ───────── */

export const PURCHASE_CAL_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  delivered: "Concluído",
  delayed: "Atrasado",
};

export const PURCHASE_CAL_TONE: Record<string, StatusTone> = {
  pending: "warning",
  approved: "info",
  delivered: "success",
  delayed: "danger",
};

/* ───────── Fornecedores ───────── */

export const SUPPLIER_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  rascunho: "Rascunho",
};

export const SUPPLIER_STATUS_TONE: Record<string, StatusTone> = {
  ativo: "success",
  inativo: "muted",
  rascunho: "warning",
};

/* ───────── Helpers ───────── */

export function getTone<T extends string>(
  map: Record<string, StatusTone>,
  key: T | null | undefined,
  fallback: StatusTone = "neutral",
): StatusTone {
  if (!key) return fallback;
  return map[key] ?? fallback;
}

export function getLabel<T extends string>(
  map: Record<string, string>,
  key: T | null | undefined,
  fallback = "—",
): string {
  if (!key) return fallback;
  return map[key] ?? key;
}
