/**
 * Single source of truth for human-readable labels of Portfolio filter
 * primitives — used by the command bar (preset tabs), KPI strip and the
 * active-filter chips so they don't drift out of sync.
 *
 * Keep this file label-only (no icons, no JSX). Icon/description maps live
 * with their respective rendering components.
 */
import type { PortfolioPreset } from './hooks/usePortfolioFilters';
import type { KpiFilterKey } from './PortfolioKpiStrip';

export const PRESET_LABEL: Record<PortfolioPreset, string> = {
  all: 'Todas',
  mine: 'Minhas',
  critical: 'Críticas',
  stale: 'Sem update',
  'due-soon': 'Vencendo',
  completed: 'Concluídas',
};

export const KPI_FILTER_LABEL: Record<KpiFilterKey, string> = {
  active: 'Ativas',
  draft: 'Rascunhos',
  completed: 'Concluídas',
  overdue: 'Prazo estourado',
  'approaching-deadline': 'Entrega próxima',
  critical: 'Críticas',
  blocked: 'Bloqueadas',
  'stale-7d': 'Sem update',
  'cost-at-risk': 'Custo em risco',
  'critical-purchase': 'Compra crítica',
};
