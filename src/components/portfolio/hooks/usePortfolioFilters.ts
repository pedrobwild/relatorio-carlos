/**
 * Custom hook that encapsulates all portfolio filtering logic.
 *
 * Inputs: raw projects, summaries, and user context.
 * Outputs: filtered list, filter state setters, and derived counts.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUrlParam, useNullableUrlParam } from '@/hooks/useUrlParam';
import { applyKpiFilter, type KpiFilterKey, type ProjectFinancial } from '../PortfolioKpiStrip';
import { type AdvancedFilters, emptyFilters, isFiltersEmpty } from '../filters/types';
import { applyAdvancedFilters } from '../filters/applyFilters';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

export type PortfolioPreset = 'all' | 'mine' | 'critical' | 'stale' | 'due-soon' | 'completed';
export type ViewMode = 'cards' | 'list';
export type ScopeFilter = 'all' | 'obras' | 'projetos';

const PORTFOLIO_PRESETS: readonly PortfolioPreset[] = [
  'all', 'mine', 'critical', 'stale', 'due-soon', 'completed',
] as const;
const SCOPE_FILTERS: readonly ScopeFilter[] = ['all', 'obras', 'projetos'] as const;
const KPI_FILTER_KEYS: readonly KpiFilterKey[] = [
  'active', 'draft', 'critical', 'blocked', 'overdue', 'approaching-deadline',
  'stale-7d', 'cost-at-risk', 'critical-purchase', 'completed',
] as const;

const isPreset = (v: string): v is PortfolioPreset =>
  (PORTFOLIO_PRESETS as readonly string[]).includes(v);
const isScope = (v: string): v is ScopeFilter =>
  (SCOPE_FILTERS as readonly string[]).includes(v);
const isKpiKey = (v: string): v is KpiFilterKey =>
  (KPI_FILTER_KEYS as readonly string[]).includes(v);

export function usePortfolioFilters(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
  financials?: Map<string, ProjectFinancial>,
) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-backed filters ──────────────────────────────────────────────────
  // All filters that should survive a refresh / shared link live in the URL
  // query (issue #16 — "Sincronizar estado dos filtros com URL query params").
  // The setters omit the param when set to its default to keep links short.
  const search = searchParams.get('q') || '';
  const setSearch = useCallback((v: string) => {
    setSearchParams(prev => { if (v) { prev.set('q', v); } else { prev.delete('q'); } return prev; }, { replace: true });
  }, [setSearchParams]);

  const [activePreset, setActivePresetParam] = useUrlParam<PortfolioPreset>('preset', 'all', isPreset);
  const [scopeFilter, setScopeFilter] = useUrlParam<ScopeFilter>('scope', 'all', isScope);
  const [selectedEngineer, setSelectedEngineer] = useNullableUrlParam<string>('eng');
  const [kpiFilter, setKpiFilterParam] = useNullableUrlParam<KpiFilterKey>('kpi', isKpiKey);

  // ── Advanced filters ────────────────────────────────────────────────────
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── View mode ───────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('portfolio-view-mode') as ViewMode | null;
    return stored === 'cards' || stored === 'list' ? stored : 'list';
  });
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('portfolio-view-mode', mode);
  }, []);

  // ── Derived counts ──────────────────────────────────────────────────────
  const advancedFilterCount = useMemo(() => {
    const f = advancedFilters;
    return [
      f.status.length, f.phase.length, f.engineers.length,
      f.customers.length, f.cities.length, f.units.length,
      f.health.length, f.criticality.length,
      f.hasPendingDocs !== null ? 1 : 0,
      f.hasPendingSign !== null ? 1 : 0,
      (f.dateRange.from || f.dateRange.to) ? 1 : 0,
      (f.contractMin !== null || f.contractMax !== null) ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
  }, [advancedFilters]);

  const totalFilterCount = advancedFilterCount
    + (search ? 1 : 0)
    + (activePreset !== 'all' ? 1 : 0)
    + (kpiFilter ? 1 : 0)
    + (selectedEngineer ? 1 : 0);

  const hasAnyFilter = totalFilterCount > 0;

  // ── Unique engineers ────────────────────────────────────────────────────
  const uniqueEngineers = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      const id = p.engineer_user_id ?? p.engineer_name;
      if (id && p.engineer_name) map.set(id, p.engineer_name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // ── Filtering pipeline ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = projects;

    // Hide completed projects by default — only show when explicitly filtered for
    const wantsCompleted =
      activePreset === 'completed' ||
      kpiFilter === 'completed' ||
      advancedFilters.status.includes('completed');
    if (!wantsCompleted) {
      result = result.filter(p => p.status !== 'completed');
    }

    // Hide draft projects by default — only show when explicitly filtered for
    const wantsDraft =
      kpiFilter === 'draft' ||
      advancedFilters.status.includes('draft');
    if (!wantsDraft) {
      result = result.filter(p => p.status !== 'draft');
    }

    // Scope filter (obras vs projetos)
    if (scopeFilter === 'obras') {
      result = result.filter(p => !p.is_project_phase);
    } else if (scopeFilter === 'projetos') {
      result = result.filter(p => !!p.is_project_phase);
    }

    // Engineer filter
    if (selectedEngineer) {
      result = result.filter(p => (p.engineer_user_id ?? p.engineer_name) === selectedEngineer);
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.unit_name?.toLowerCase().includes(q) ||
        p.endereco_completo?.toLowerCase().includes(q) ||
        p.cidade?.toLowerCase().includes(q)
      );
    }

    // Preset
    switch (activePreset) {
      case 'mine':
        result = result.filter(p => p.engineer_user_id === user?.id);
        break;
      case 'critical':
      case 'stale':
        result = result.filter(p => p.status === 'active');
        break;
      case 'due-soon':
        result = result.filter(p => {
          if (!p.planned_end_date) return false;
          const daysLeft = Math.ceil(
            (new Date(p.planned_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return daysLeft >= 0 && daysLeft <= 7;
        });
        break;
      case 'completed':
        result = result.filter(p => p.status === 'completed');
        break;
    }

    // KPI
    if (kpiFilter) result = applyKpiFilter(result, summaries, kpiFilter, financials);

    // Advanced
    if (!isFiltersEmpty(advancedFilters)) {
      result = applyAdvancedFilters(result, summaries, advancedFilters);
    }

    return result;
  }, [projects, scopeFilter, selectedEngineer, search, activePreset, user?.id, kpiFilter, summaries, advancedFilters, financials]);

  // ── Actions ─────────────────────────────────────────────────────────────
  // Public setters preserve the previous API so call-sites in
  // PortfolioPage / PortfolioCommandBar don't need to change. Internally we
  // route through the URL-backed setters so the query string always reflects
  // the current selection.
  const setKpiFilter = useCallback((next: KpiFilterKey | null) => {
    setKpiFilterParam(next);
  }, [setKpiFilterParam]);

  const handlePresetChange = useCallback((p: PortfolioPreset) => {
    setActivePresetParam(p);
    setKpiFilterParam(null);
  }, [setActivePresetParam, setKpiFilterParam]);

  const handleClearAll = useCallback(() => {
    setSearch('');
    setActivePresetParam('all');
    setScopeFilter('all');
    setKpiFilterParam(null);
    setAdvancedFilters(emptyFilters);
    setSelectedEngineer(null);
  }, [setSearch, setActivePresetParam, setScopeFilter, setKpiFilterParam, setSelectedEngineer]);

  return {
    // State
    search, activePreset, kpiFilter, advancedFilters,
    viewMode, filtersOpen, scopeFilter,
    selectedEngineer, uniqueEngineers,
    // Derived
    filtered, advancedFilterCount, totalFilterCount, hasAnyFilter,
    // Setters
    setSearch, setKpiFilter, setAdvancedFilters,
    setFiltersOpen, handlePresetChange, handleViewModeChange,
    handleClearAll, setScopeFilter, setSelectedEngineer,
  };
}
