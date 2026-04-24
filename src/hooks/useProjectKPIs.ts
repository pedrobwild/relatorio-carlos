/**
 * useProjectKPIs — métricas consolidadas por obra.
 *
 * Este hook é a fonte única de KPIs para toda a aplicação
 * (Painel de Obras, Portal do Cliente, Dashboard Executivo). Cada consumidor
 * costumava calcular seu próprio "atraso", "status derivado" ou "custo pago"
 * — agora tudo é derivado aqui, garantindo que os mesmos números apareçam
 * em qualquer tela.
 *
 * Fontes consumidas:
 *   - `get_user_projects_summary` (RPC) → via `useProjectSummaryQuery`:
 *     progresso do cronograma, pending_count, overdue_count, contract_value,
 *     planned/actual dates.
 *   - `project_payments`  → soma de parcelas pagas (custo realizado).
 *   - `projects.painel_*` → etapa e status operacionais (via
 *     `useProjectsQuery` / `usePainelObras`).
 *
 * Duas APIs:
 *   - `useProjectKPIs(projectId)` — KPI detalhado de uma obra (inclui custo,
 *     que depende da tabela `project_payments`).
 *   - `useAllProjectsKPIs()` — KPI leve (sem custo detalhado) para todas as
 *     obras visíveis, reutilizando o cache do summary. Usado por dashboards
 *     e listagens.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProjectSummaryQuery } from './useProjectsQuery';
import { usePainelObras, type PainelObra } from './usePainelObras';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_TIMING } from '@/lib/queryClient';
import {
  computeCostKPIs,
  computeDaysOverdue,
  computeStageKPIs,
  deriveDisplayStatus,
  normalizeProgress,
  type CostKPIs,
  type StageKPIs,
} from '@/lib/projectKpis';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

/** Shape público consumido por Painel + Portal + Dashboard. */
export interface ProjectKPIs {
  projectId: string;
  projectName: string;
  /** Status vindo do banco em `projects.status` (active/paused/completed/…). */
  lifecycleStatus: string;
  /** Status visual do painel, com "Atrasado" derivado quando entrega oficial passou. */
  displayStatus: PainelObra['status'];
  /** Progresso do cronograma ponderado (0-100) ou null quando indisponível. */
  progress: number | null;
  /** Dias em atraso em relação à entrega oficial (0 se no prazo ou já entregue). */
  daysOverdue: number;
  /** Flags derivadas. */
  isOverdue: boolean;
  /** Contadores herdados do summary. */
  pendingCount: number;
  overdueCount: number;
  /** Etapa atual + próxima (ciclo canônico do painel). */
  stage: StageKPIs;
  /** Custo contratual vs pago. Pode ser `null` quando o hook foi chamado em modo light. */
  cost: CostKPIs | null;
  /** Datas relevantes (snapshot). */
  dates: {
    plannedStart: string | null;
    plannedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
  };
  /** Última edição reconhecida (painel ou projeto). */
  lastUpdate: string | null;
}

/** Shape do summary enriquecido com campos do `projects` (vindos do painel). */
type SummaryWithPainel = ProjectSummary & {
  painel_status?: PainelObra['status'] | null;
  painel_etapa?: PainelObra['etapa'] | null;
  painel_ultima_atualizacao?: string | null;
};

function buildCore(
  summary: SummaryWithPainel,
  painel: PainelObra | undefined,
  cost: CostKPIs | null,
): ProjectKPIs {
  const plannedEnd = summary.planned_end_date ?? null;
  const actualEnd = summary.actual_end_date ?? null;
  const painelStatus = painel?.status ?? summary.painel_status ?? null;
  const painelEtapa = painel?.etapa ?? summary.painel_etapa ?? null;
  const displayStatus = deriveDisplayStatus({
    status: painelStatus,
    entregaOficial: plannedEnd,
    entregaReal: actualEnd,
  });
  const daysOverdue = computeDaysOverdue({
    entregaOficial: plannedEnd,
    entregaReal: actualEnd,
  });

  return {
    projectId: summary.id,
    projectName: summary.name,
    lifecycleStatus: summary.status,
    displayStatus,
    progress: normalizeProgress(summary.progress_percentage),
    daysOverdue,
    isOverdue: displayStatus === 'Atrasado',
    pendingCount: summary.pending_count ?? 0,
    overdueCount: summary.overdue_count ?? 0,
    stage: computeStageKPIs(painelEtapa ?? null),
    cost,
    dates: {
      plannedStart: summary.planned_start_date ?? null,
      plannedEnd,
      actualStart: summary.actual_start_date ?? null,
      actualEnd,
    },
    lastUpdate:
      painel?.ultima_atualizacao ??
      summary.painel_ultima_atualizacao ??
      summary.last_activity_at ??
      null,
  };
}

/**
 * KPIs detalhados para uma única obra (inclui custo baseado em
 * `project_payments`). Retorna `null` enquanto carrega ou quando
 * o projeto não é visível para o usuário.
 */
export function useProjectKPIs(projectId: string | undefined) {
  const { user } = useAuth();
  const { data: summaries = [], isLoading: summariesLoading } = useProjectSummaryQuery();
  const { obras, isLoading: painelLoading } = usePainelObras();

  const summary = useMemo<SummaryWithPainel | undefined>(() => {
    if (!projectId) return undefined;
    return (summaries as SummaryWithPainel[]).find((s) => s.id === projectId);
  }, [summaries, projectId]);

  const painel = useMemo<PainelObra | undefined>(() => {
    if (!projectId) return undefined;
    return obras.find((o) => o.id === projectId);
  }, [obras, projectId]);

  const {
    data: payments = [],
    isLoading: paymentsLoading,
  } = useQuery({
    queryKey: queryKeys.payments.list(projectId),
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_payments')
        .select('amount, paid_at')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as Array<{ amount: number | null; paid_at: string | null }>;
    },
    enabled: !!user && !!projectId,
    staleTime: QUERY_TIMING.payments.staleTime,
    gcTime: QUERY_TIMING.payments.gcTime,
  });

  const kpis = useMemo<ProjectKPIs | null>(() => {
    if (!summary) return null;
    const cost = computeCostKPIs({
      contractValue: summary.contract_value ?? null,
      payments,
    });
    return buildCore(summary, painel, cost);
  }, [summary, painel, payments]);

  return {
    kpis,
    isLoading: summariesLoading || painelLoading || paymentsLoading,
  };
}

/**
 * KPIs "light" (sem custo) para todas as obras visíveis — ideal para
 * listagens e o Painel de Obras, onde carregar os `project_payments` de
 * todos os projetos seria exagero. O custo permanece acessível chamando
 * `useProjectKPIs(id)` na linha detalhada.
 */
export function useAllProjectsKPIs() {
  const { data: summaries = [], isLoading: summariesLoading } = useProjectSummaryQuery();
  const { obras, isLoading: painelLoading } = usePainelObras();

  const kpis = useMemo<ProjectKPIs[]>(() => {
    const painelMap = new Map(obras.map((o) => [o.id, o]));
    return (summaries as SummaryWithPainel[]).map((summary) =>
      buildCore(summary, painelMap.get(summary.id), null),
    );
  }, [summaries, obras]);

  const kpisById = useMemo(() => new Map(kpis.map((k) => [k.projectId, k])), [kpis]);

  return {
    kpis,
    kpisById,
    isLoading: summariesLoading || painelLoading,
  };
}
