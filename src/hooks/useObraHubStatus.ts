import { useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { usePendencias, type PendingItem } from './usePendencias';
import { useFormalizacoes } from './useFormalizacoes';
import { useProjectPayments } from './useProjectPayments';
import { useDocuments } from './useDocuments';
import type { HubSectionId } from '@/config/obraHub';

export type SectionStatus = {
  /** Short, human-readable description shown under the section label. */
  sublabel?: string;
  /** Number badge (e.g. "3 pendentes"). */
  count?: number;
  /** Highlight as needing attention (overdue / pending signature / unpaid). */
  isUrgent?: boolean;
};

export type ObraHubStatus = {
  isLoading: boolean;
  /** Per-section status used by HubSection cards. */
  byId: Partial<Record<HubSectionId, SectionStatus>>;
  /** Single most urgent pending item to surface in the "Próximo passo" card. */
  nextAction: PendingItem | null;
};

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function pickNextAction(items: PendingItem[]): PendingItem | null {
  if (items.length === 0) return null;
  const open = items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
  // Earliest due date first; items without a due date sink to the end.
  const sorted = [...open].sort((a, b) => {
    const dateA = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
    const dateB = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
    return dateA - dateB;
  });
  return sorted[0] ?? null;
}

/**
 * Aggregates per-section status badges for the Hub da Obra.
 * Composes domain hooks rather than re-querying — each underlying hook is
 * already cached by react-query and shared with the rest of the app.
 */
export function useObraHubStatus(projectId: string | undefined): ObraHubStatus {
  const { pendingItems, stats: pendingStats, isLoading: pendingLoading } =
    usePendencias({ projectId });
  const { data: formalizations = [], isLoading: formalizationsLoading } =
    useFormalizacoes(projectId ? { projectId } : undefined);
  const { data: payments = [], isLoading: paymentsLoading } =
    useProjectPayments(projectId);
  const { documents, loading: documentsLoading } = useDocuments(projectId);

  const isLoading =
    pendingLoading || formalizationsLoading || paymentsLoading || documentsLoading;

  const nextAction = useMemo(() => pickNextAction(pendingItems), [pendingItems]);

  const byId = useMemo<Partial<Record<HubSectionId, SectionStatus>>>(() => {
    const today = new Date();

    // Pendências
    const pendenciasStatus: SectionStatus = {
      count: pendingStats.total,
      sublabel:
        pendingStats.total === 0
          ? 'Nenhuma pendência'
          : pluralize(pendingStats.total, 'pendência', 'pendências'),
      isUrgent: pendingStats.overdueCount > 0 || pendingStats.urgentCount > 0,
    };

    // Formalizações
    const pendingFormalizations = formalizations.filter(
      (f) => f.status === 'pending_signatures'
    ).length;
    const formalizacoesStatus: SectionStatus = {
      count: pendingFormalizations,
      sublabel:
        pendingFormalizations === 0
          ? formalizations.length > 0
            ? 'Tudo assinado'
            : undefined
          : pluralize(pendingFormalizations, 'aguardando assinatura', 'aguardando assinaturas'),
      isUrgent: pendingFormalizations > 0,
    };

    // Financeiro — earliest unpaid installment.
    // Compare with day granularity so an installment due today only flips to
    // overdue tomorrow, regardless of the current time of day.
    const unpaid = payments.filter((p) => !p.paid_at);
    const overduePayments = unpaid.filter(
      (p) => p.due_date && differenceInCalendarDays(parseISO(p.due_date), today) < 0
    );
    const nextDue = unpaid
      .filter((p): p is typeof p & { due_date: string } => p.due_date !== null)
      .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime())[0];

    let financeiroSublabel: string | undefined;
    if (overduePayments.length > 0) {
      financeiroSublabel = `${overduePayments.length} em atraso`;
    } else if (nextDue?.due_date) {
      const days = differenceInCalendarDays(parseISO(nextDue.due_date), today);
      financeiroSublabel =
        days <= 0 ? 'Vence hoje' : days === 1 ? 'Vence amanhã' : `Próximo em ${days} dias`;
    } else if (unpaid.length === 0 && payments.length > 0) {
      financeiroSublabel = 'Em dia';
    }

    const financeiroStatus: SectionStatus = {
      count: unpaid.length,
      sublabel: financeiroSublabel,
      isUrgent: overduePayments.length > 0,
    };

    // Documentos — count "new since approval pending"
    const pendingDocs = documents.filter((d) => d.status === 'pending').length;
    const documentosStatus: SectionStatus = {
      count: pendingDocs,
      sublabel:
        documents.length === 0
          ? undefined
          : pendingDocs === 0
            ? `${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}`
            : pluralize(pendingDocs, 'aguardando aprovação', 'aguardando aprovação'),
      isUrgent: pendingDocs > 0,
    };

    return {
      pendencias: pendenciasStatus,
      formalizacoes: formalizacoesStatus,
      financeiro: financeiroStatus,
      documentos: documentosStatus,
    };
  }, [pendingStats, formalizations, payments, documents]);

  return { isLoading, byId, nextAction };
}
