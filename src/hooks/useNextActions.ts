/**
 * useNextActions — hook do "cockpit de decisão" (Bloco 1 / Issue #18).
 *
 * Responde à pergunta "o que eu preciso fazer agora?" agregando até 3
 * ações ranqueadas a partir de:
 *  - pendências em atraso ou urgentes (`usePendencias`)
 *  - pagamentos próximos do vencimento (derivado de `useClientDashboard`
 *    no modo agregado, ou `useProjectPayments` no modo per-project)
 *
 * Ranking (ordem decrescente de criticidade):
 *  1. overdue   — atrasado (pendência ou pagamento vencido)
 *  2. tacit     — aprovação tácita iminente (≤3 dias)
 *  3. payment   — pagamento vencendo em ≤7 dias
 *  4. approval  — pendências de assinatura/decisão urgentes
 *
 * A lógica de ranqueamento (`buildNextActions`) é exportada como função
 * pura para facilitar testes (Vitest) sem precisar montar o React tree.
 */
import { useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { usePendencias, type PendingItem } from './usePendencias';
import { useClientDashboard, type UpcomingPayment } from './useClientDashboard';
import { useProjectPayments, type ProjectPayment } from './useProjectPayments';

export type NextActionType = 'overdue' | 'tacit' | 'payment' | 'approval';
export type NextActionUrgency = 'critical' | 'high' | 'medium';
export type NextActionOwner = 'client' | 'bwild';

export interface NextAction {
  id: string;
  type: NextActionType;
  urgency: NextActionUrgency;
  title: string;
  impact: string;
  cta: { label: string; href: string };
  owner: NextActionOwner;
  /** Project context, when available (used for analytics + multi-project copy). */
  projectId?: string;
  projectName?: string;
}

const TYPE_RANK: Record<NextActionType, number> = {
  overdue: 0,
  tacit: 1,
  payment: 2,
  approval: 3,
};

const URGENCY_RANK: Record<NextActionUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const MAX_ITEMS = 3;
const PAYMENT_URGENT_WINDOW_DAYS = 7;
const TACIT_IMMINENT_WINDOW_DAYS = 3;

/** Tipos de pendência que demandam decisão/assinatura do cliente. */
const APPROVAL_TYPES = new Set(['signature', 'approval_3d', 'approval_exec', 'decision']);

interface BuildOptions {
  pendencias: PendingItem[];
  payments: Array<{
    id: string;
    description: string;
    amount: number;
    due_date: string | null;
    project_id?: string;
    project_name?: string;
  }>;
  pendingProjectMap?: Map<string, { name: string }>;
  /** Caminho base do projeto para CTAs (ex: "/obra/<id>") ou rota agregada. */
  pathFor: (kind: 'pendencia' | 'pagamento' | 'formalizacao', projectId?: string) => string;
  /** Data de referência (para deixar a função pura/testável). */
  now?: Date;
}

/**
 * Lógica pura de ranqueamento — testada isoladamente.
 * Retorna no máximo `MAX_ITEMS` ações, ordenadas por (tipo, urgência, prazo).
 */
export function buildNextActions(opts: BuildOptions): NextAction[] {
  const now = opts.now ?? new Date();
  const items: NextAction[] = [];

  for (const p of opts.pendencias) {
    if (!p.dueDate) continue;
    const due = parseISO(p.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const days = differenceInCalendarDays(due, now);

    const projectName = p.referenceId
      ? opts.pendingProjectMap?.get(p.referenceId)?.name
      : undefined;

    if (days < 0) {
      items.push({
        id: `pendencia:${p.id}`,
        type: 'overdue',
        urgency: 'critical',
        title: p.title,
        impact: p.impact || `Atrasado há ${Math.abs(days)} dia(s) — pode bloquear próximas etapas.`,
        cta: { label: 'Resolver agora', href: opts.pathFor('pendencia', p.referenceId) },
        owner: 'client',
        projectId: p.referenceId,
        projectName,
      });
      continue;
    }

    // Tácita iminente: pendência do tipo aprovação executiva próxima do prazo
    if (p.type === 'approval_exec' && days <= TACIT_IMMINENT_WINDOW_DAYS) {
      items.push({
        id: `tacit:${p.id}`,
        type: 'tacit',
        urgency: 'critical',
        title: p.title,
        impact:
          p.impact ||
          `Em ${days} dia(s) o projeto será aprovado tacitamente se você não se manifestar.`,
        cta: { label: 'Aprovar ou solicitar revisão', href: opts.pathFor('formalizacao', p.referenceId) },
        owner: 'client',
        projectId: p.referenceId,
        projectName,
      });
      continue;
    }

    if (APPROVAL_TYPES.has(p.type) && days <= 5) {
      items.push({
        id: `approval:${p.id}`,
        type: 'approval',
        urgency: days <= 2 ? 'high' : 'medium',
        title: p.title,
        impact: p.impact || `Aguardando sua decisão até ${formatShortDate(p.dueDate)}.`,
        cta: { label: 'Abrir', href: opts.pathFor('pendencia', p.referenceId) },
        owner: 'client',
        projectId: p.referenceId,
        projectName,
      });
    }
  }

  for (const pay of opts.payments) {
    if (!pay.due_date) continue;
    const due = parseISO(pay.due_date);
    if (Number.isNaN(due.getTime())) continue;
    const days = differenceInCalendarDays(due, now);

    if (days < 0) {
      items.push({
        id: `payment-overdue:${pay.id}`,
        type: 'overdue',
        urgency: 'critical',
        title: paymentTitle(pay, 'venceu'),
        impact: `Pagamento vencido há ${Math.abs(days)} dia(s).`,
        cta: { label: 'Ver financeiro', href: opts.pathFor('pagamento', pay.project_id) },
        owner: 'client',
        projectId: pay.project_id,
        projectName: pay.project_name,
      });
    } else if (days <= PAYMENT_URGENT_WINDOW_DAYS) {
      items.push({
        id: `payment:${pay.id}`,
        type: 'payment',
        urgency: days <= 2 ? 'high' : 'medium',
        title: paymentTitle(pay, 'vence'),
        impact: `Vence em ${days === 0 ? 'hoje' : `${days} dia(s)`}.`,
        cta: { label: 'Ver financeiro', href: opts.pathFor('pagamento', pay.project_id) },
        owner: 'client',
        projectId: pay.project_id,
        projectName: pay.project_name,
      });
    }
  }

  items.sort((a, b) => {
    const t = TYPE_RANK[a.type] - TYPE_RANK[b.type];
    if (t !== 0) return t;
    return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  });

  return items.slice(0, MAX_ITEMS);
}

function paymentTitle(p: { description: string; project_name?: string }, verb: string): string {
  const base = p.description || 'Parcela';
  return p.project_name ? `${base} (${p.project_name}) — ${verb}` : `${base} — ${verb}`;
}

function formatShortDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

/**
 * Hook React: agrega dados das fontes existentes e devolve as próximas ações.
 *
 * @param projectId  Quando informado, escopo per-project (pendências do
 *                   projeto + parcelas do projeto). Quando ausente, modo
 *                   agregado (pendências do usuário + parcelas próximas
 *                   já consolidadas em useClientDashboard).
 */
export function useNextActions(projectId?: string): {
  actions: NextAction[];
  isLoading: boolean;
} {
  const { sortedItems: pendencias, isLoading: pendLoading } = usePendencias({ projectId });

  const { upcomingPayments, projects, isLoading: dashLoading } = useClientDashboard();
  const { data: projectPayments = [], isLoading: payLoading } = useProjectPayments(projectId);

  const actions = useMemo(() => {
    const projectMap = new Map<string, { name: string }>();
    for (const p of projects) projectMap.set(p.id, { name: p.name });

    const payments = projectId
      ? projectPaymentsToInput(projectPayments, projectMap.get(projectId)?.name, projectId)
      : (upcomingPayments as UpcomingPayment[]).map((p) => ({
          id: p.id,
          description: p.description,
          amount: p.amount,
          due_date: p.due_date,
          project_id: p.project_id,
          project_name: p.project_name,
        }));

    return buildNextActions({
      pendencias,
      payments,
      pendingProjectMap: projectMap,
      pathFor: (kind, pid) => buildPath(kind, pid ?? projectId),
    });
  }, [pendencias, upcomingPayments, projectPayments, projectId, projects]);

  return {
    actions,
    isLoading: pendLoading || (projectId ? payLoading : dashLoading),
  };
}

function projectPaymentsToInput(
  list: ProjectPayment[],
  projectName: string | undefined,
  projectId: string,
) {
  return list
    .filter((p) => !p.paid_at && p.due_date)
    .map((p) => ({
      id: p.id,
      description: p.description,
      amount: p.amount,
      due_date: p.due_date,
      project_id: projectId,
      project_name: projectName,
    }));
}

function buildPath(kind: 'pendencia' | 'pagamento' | 'formalizacao', projectId?: string): string {
  if (!projectId) {
    if (kind === 'pagamento') return '/minhas-obras';
    return '/minhas-obras';
  }
  switch (kind) {
    case 'pendencia':
      return `/obra/${projectId}/pendencias`;
    case 'pagamento':
      return `/obra/${projectId}/financeiro`;
    case 'formalizacao':
      return `/obra/${projectId}/formalizacoes`;
  }
}
