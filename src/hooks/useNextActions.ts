/**
 * useNextActions — cockpit de decisão "O que preciso fazer agora?".
 *
 * Agrega pendências, pagamentos a vencer e formalizações com tácita iminente
 * em uma lista ranqueada de ≤3 ações com CTA, dono e urgência. Usada pelo
 * NextActionsBlock no topo de MinhasObras / Index para responder em < 5s
 * "qual é a próxima ação e de quem é a bola?".
 *
 * Padrão arquitetural:
 * - rankNextActions(): função pura, testável, recebe os 3 datasets já
 *   buscados e devolve a lista ordenada e cortada.
 * - useNextActions(): wrapper React que faz a coleta via hooks existentes
 *   (usePendencias / useClientDashboard / useFormalizacoes). Sem novos
 *   queries ad-hoc — cache e invalidation já existem nos hooks-fonte.
 */
import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useClientDashboard, type UpcomingPayment } from "./useClientDashboard";
import { usePendencias, type PendingItem } from "./usePendencias";
import { useFormalizacoes } from "./useFormalizacoes";

export type NextActionType = "overdue" | "tacit" | "payment" | "approval";
export type NextActionUrgency = "critical" | "high" | "medium";
export type NextActionOwner = "client" | "bwild";

export interface NextAction {
  id: string;
  type: NextActionType;
  urgency: NextActionUrgency;
  title: string;
  impact: string;
  cta: { label: string; href: string };
  owner: NextActionOwner;
  /** Dias relativos ao prazo. Negativo = atrasado, 0 = hoje, positivo = futuro. */
  daysToDeadline?: number;
  projectId?: string;
}

const MAX_ITEMS = 3;
const TACIT_THRESHOLD_DAYS = 3;
const PAYMENT_THRESHOLD_DAYS = 5;

const URGENCY_RANK: Record<NextActionUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const TYPE_TIEBREAKER: Record<NextActionType, number> = {
  overdue: 0,
  tacit: 1,
  payment: 2,
  approval: 3,
};

const formatDeadline = (daysToDeadline: number): string => {
  if (daysToDeadline < 0) {
    const abs = Math.abs(daysToDeadline);
    return abs === 1 ? "há 1 dia" : `há ${abs} dias`;
  }
  if (daysToDeadline === 0) return "hoje";
  if (daysToDeadline === 1) return "em 1 dia";
  return `em ${daysToDeadline} dias`;
};

const buildPendingCta = (
  item: PendingItem,
  projectId: string | undefined,
): { label: string; href: string } => {
  const pendenciasHref = projectId
    ? `/obra/${projectId}/pendencias`
    : "/minhas-obras";
  const targetHref = item.actionUrl ?? pendenciasHref;
  switch (item.type) {
    case "approval_3d":
      return { label: "Aprovar 3D", href: targetHref };
    case "approval_exec":
      return { label: "Aprovar projeto", href: targetHref };
    case "signature":
      return { label: "Assinar agora", href: targetHref };
    case "invoice":
      return { label: "Enviar comprovante", href: targetHref };
    case "extra_purchase":
      return { label: "Decidir compra", href: targetHref };
    case "decision":
    default:
      return { label: "Decidir agora", href: targetHref };
  }
};

const buildPendingTitle = (item: PendingItem): string =>
  item.title?.trim() || "Pendência aberta";

const buildPendingImpact = (
  item: PendingItem,
  daysToDeadline: number,
): string => {
  if (item.impact?.trim()) return item.impact.trim();
  if (daysToDeadline < 0)
    return `Vencida ${formatDeadline(daysToDeadline)} — risco de impacto no cronograma.`;
  if (daysToDeadline <= 2)
    return `Prazo ${formatDeadline(daysToDeadline)} — sem decisão a obra para de avançar.`;
  return "Sem decisão, etapas dependentes ficam bloqueadas.";
};

const pickPendingUrgency = (daysToDeadline: number): NextActionUrgency => {
  if (daysToDeadline < 0) return "critical";
  if (daysToDeadline <= 2) return "high";
  return "medium";
};

const pendingOwner = (item: PendingItem): NextActionOwner => {
  // Aprovações, assinaturas, decisões e envio de comprovante são do cliente.
  // Compras extras são propostas pela BWild — cliente decide. Default = client.
  switch (item.type) {
    case "approval_3d":
    case "approval_exec":
    case "signature":
    case "decision":
    case "invoice":
    case "extra_purchase":
      return "client";
    default:
      return "bwild";
  }
};

interface RankInputs {
  pendingItems: PendingItem[];
  upcomingPayments: UpcomingPayment[];
  tacitFormalizations: Array<{
    id: string;
    title: string | null;
    project_id: string | null;
    deadline_iso: string;
  }>;
  /** Quando o usuário está dentro de uma obra, alguns CTAs podem usar paths relativos. */
  scopedProjectId?: string;
  /** Data de referência — injetável para testes. */
  now?: Date;
}

export function rankNextActions(inputs: RankInputs): NextAction[] {
  const now = inputs.now ?? new Date();
  const actions: NextAction[] = [];

  for (const item of inputs.pendingItems) {
    if (item.status !== "pending") continue;
    if (!item.dueDate) continue;
    const due = parseISO(item.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const days = differenceInCalendarDays(due, now);
    // Ignora itens com folga grande — não competem por slot no cockpit.
    if (days > 7) continue;
    const projectId =
      item.referenceType === "project"
        ? item.referenceId
        : inputs.scopedProjectId;
    actions.push({
      id: `pending:${item.id}`,
      type: days < 0 ? "overdue" : "approval",
      urgency: pickPendingUrgency(days),
      title: buildPendingTitle(item),
      impact: buildPendingImpact(item, days),
      cta: buildPendingCta(item, projectId),
      owner: pendingOwner(item),
      daysToDeadline: days,
      projectId,
    });
  }

  for (const tacit of inputs.tacitFormalizations) {
    const due = parseISO(tacit.deadline_iso);
    if (Number.isNaN(due.getTime())) continue;
    const days = differenceInCalendarDays(due, now);
    if (days > TACIT_THRESHOLD_DAYS) continue;
    const href = tacit.project_id
      ? `/obra/${tacit.project_id}/formalizacoes/${tacit.id}`
      : "/minhas-obras";
    actions.push({
      id: `tacit:${tacit.id}`,
      type: "tacit",
      urgency: days <= 0 ? "critical" : "high",
      title: tacit.title?.trim() || "Aprovação tácita iminente",
      impact:
        days <= 0
          ? "O prazo contratual venceu — o documento será aprovado automaticamente."
          : `Sem manifestação ${formatDeadline(days)}, o documento é aprovado automaticamente.`,
      cta: { label: "Aprovar ou solicitar revisão", href },
      owner: "client",
      daysToDeadline: days,
      projectId: tacit.project_id ?? undefined,
    });
  }

  for (const payment of inputs.upcomingPayments) {
    if (!payment.due_date) continue;
    const due = parseISO(payment.due_date);
    if (Number.isNaN(due.getTime())) continue;
    const days = differenceInCalendarDays(due, now);
    if (days > PAYMENT_THRESHOLD_DAYS) continue;
    const projectId = payment.project_id ?? inputs.scopedProjectId;
    const href = projectId
      ? `/obra/${projectId}?tab=financeiro`
      : "/minhas-obras";
    actions.push({
      id: `payment:${payment.id}`,
      type: days < 0 ? "overdue" : "payment",
      urgency: days < 0 ? "critical" : days <= 2 ? "high" : "medium",
      title: `Pagamento ${payment.description || `#${payment.installment_number}`}`,
      impact:
        days < 0
          ? `Vencido ${formatDeadline(days)} — pode gerar juros e multa contratual.`
          : `Vence ${formatDeadline(days)} — evite multa por atraso.`,
      cta: { label: "Ver no Financeiro", href },
      owner: "client",
      daysToDeadline: days,
      projectId,
    });
  }

  actions.sort((a, b) => {
    const urgencyDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    const aDays = a.daysToDeadline ?? Number.POSITIVE_INFINITY;
    const bDays = b.daysToDeadline ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;
    return TYPE_TIEBREAKER[a.type] - TYPE_TIEBREAKER[b.type];
  });

  return actions.slice(0, MAX_ITEMS);
}

export interface UseNextActionsResult {
  actions: NextAction[];
  isLoading: boolean;
  /** True quando a busca terminou e nenhuma ação está pendente. */
  isEmpty: boolean;
}

/**
 * Hook React que monta a lista de próximas ações para o cockpit.
 *
 * Quando `projectId` é fornecido, escopa os dados ao projeto. Caso contrário,
 * agrega pendências e pagamentos de todas as obras do cliente.
 */
export function useNextActions(projectId?: string): UseNextActionsResult {
  const { pendingItems, isLoading: pendenciasLoading } = usePendencias({
    projectId,
  });
  const dashboard = useClientDashboard();
  const formalizacoes = useFormalizacoes(projectId ? { projectId } : undefined);

  const tacitFormalizations = useMemo(() => {
    const rows = formalizacoes.data ?? [];
    const result: Array<{
      id: string;
      title: string | null;
      project_id: string | null;
      deadline_iso: string;
    }> = [];
    for (const row of rows) {
      if (row.status !== "pending_signatures") continue;
      if (!row.id) continue;
      // O prazo de tácita vem da view; usamos locked_at / last_activity_at /
      // created_at como fallback enquanto o backend não expõe deadline_iso.
      const deadlineIso =
        (row as { tacit_deadline?: string | null }).tacit_deadline ??
        row.locked_at ??
        row.last_activity_at ??
        row.created_at ??
        null;
      if (!deadlineIso) continue;
      result.push({
        id: row.id,
        title: row.title ?? null,
        project_id: row.project_id ?? null,
        deadline_iso: deadlineIso,
      });
    }
    return result;
  }, [formalizacoes.data]);

  const actions = useMemo(
    () =>
      rankNextActions({
        pendingItems,
        upcomingPayments: projectId
          ? dashboard.upcomingPayments.filter((p) => p.project_id === projectId)
          : dashboard.upcomingPayments,
        tacitFormalizations,
        scopedProjectId: projectId,
      }),
    [pendingItems, dashboard.upcomingPayments, tacitFormalizations, projectId],
  );

  const isLoading =
    pendenciasLoading || dashboard.isLoading || formalizacoes.isLoading;

  return {
    actions,
    isLoading,
    isEmpty: !isLoading && actions.length === 0,
  };
}
