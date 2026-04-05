/**
 * Custom hook that encapsulates all portfolio filtering logic.
 *
 * Inputs: raw projects, summaries, and user context.
 * Outputs: filtered list, filter state setters, and derived counts.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { applyKpiFilter, type KpiFilterKey } from '../PortfolioKpiStrip';
import { type AdvancedFilters, emptyFilters, isFiltersEmpty } from '../filters/types';
import { applyAdvancedFilters } from '../filters/applyFilters';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

export type PortfolioPreset = 'all' | 'mine' | 'critical' | 'stale' | 'due-soon';
export type ViewMode = 'cards' | 'list' | 'table';
export type ScopeFilter = 'all' | 'obras' | 'projetos';

export function usePortfolioFilters(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Search ──────────────────────────────────────────────────────────────
  const search = searchParams.get('q') || '';
  const setSearch = useCallback((v: string) => {
    setSearchParams(prev => { if (v) { prev.set('q', v); } else { prev.delete('q'); } return prev; }, { replace: true });
  }, [setSearchParams]);

  // ── Preset ──────────────────────────────────────────────────────────────
  const [activePreset, setActivePreset] = useState<PortfolioPreset>('all');

  // ── Scope (obras vs projetos) ──────────────────────────────────────────
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

  // ── KPI filter ──────────────────────────────────────────────────────────
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey | null>(null);

  // ── Advanced filters ────────────────────────────────────────────────────
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── View mode ───────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('portfolio-view-mode') as ViewMode) || 'list'
  );
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
    + (kpiFilter ? 1 : 0);

  const hasAnyFilter = totalFilterCount > 0;

  // ── Filtering pipeline ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = projects;

    // Scope filter (obras vs projetos)
    if (scopeFilter === 'obras') {
      result = result.filter(p => !p.is_project_phase);
    } else if (scopeFilter === 'projetos') {
      result = result.filter(p => !!p.is_project_phase);
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
    }

    // KPI
    if (kpiFilter) result = applyKpiFilter(result, summaries, kpiFilter);

    // Advanced
    if (!isFiltersEmpty(advancedFilters)) {
      result = applyAdvancedFilters(result, summaries, advancedFilters);
    }

    return result;
  }, [projects, scopeFilter, search, activePreset, user?.id, kpiFilter, summaries, advancedFilters]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handlePresetChange = useCallback((p: PortfolioPreset) => {
    setActivePreset(p);
    setKpiFilter(null);
  }, []);

  const handleClearAll = useCallback(() => {
    setSearch('');
    setActivePreset('all');
    setScopeFilter('all');
    setKpiFilter(null);
    setAdvancedFilters(emptyFilters);
  }, [setSearch]);

  return {
    // State
    search, activePreset, kpiFilter, advancedFilters,
    viewMode, filtersOpen, scopeFilter,
    // Derived
    filtered, advancedFilterCount, totalFilterCount, hasAnyFilter,
    // Setters
    setSearch, setKpiFilter, setAdvancedFilters,
    setFiltersOpen, handlePresetChange, handleViewModeChange,
    handleClearAll, setScopeFilter,
  };
}
