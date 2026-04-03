import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { useProjectsQuery, useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { useAuth } from '@/hooks/useAuth';
import { DuplicateProjectModal } from '@/components/DuplicateProjectModal';
import { PortfolioCommandBar, type PortfolioPreset, type ViewMode } from './PortfolioCommandBar';
import { PortfolioKpiStrip, applyKpiFilter, type KpiFilterKey } from './PortfolioKpiStrip';
import { PortfolioActionInbox } from './PortfolioActionInbox';
import { PortfolioInsightsPanel } from './PortfolioInsightsPanel';
import { PortfolioGridPlaceholder } from './PortfolioGridPlaceholder';
import { WorkQuickPreviewDrawer } from './WorkQuickPreviewDrawer';
import { ProjectsListView } from '@/components/gestao/ProjectsListView';
import { PortfolioAdvancedFilters } from './filters/PortfolioAdvancedFilters';
import { ActiveFilterChips } from './filters/ActiveFilterChips';
import { type AdvancedFilters, emptyFilters, isFiltersEmpty } from './filters/types';
import { applyAdvancedFilters } from './filters/applyFilters';
import {
  PortfolioPageSkeleton,
  KpiStripSkeleton,
  SidebarSkeleton,
  GridSkeleton,
  EmptyPortfolio,
  NoFilterResults,
  PortfolioErrorState,
  StaleDataBanner,
  PartialErrorBanner,
} from './PortfolioStates';
import type { ProjectWithCustomer } from '@/infra/repositories';

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
    isRefetching,
    dataUpdatedAt,
    isStale,
  } = useProjectsQuery();
  const {
    data: summaries = [],
    isLoading: summariesLoading,
    error: summariesError,
    refetch: refetchSummaries,
  } = useProjectSummaryQuery();

  // Search
  const search = searchParams.get('q') || '';
  const setSearch = useCallback((v: string) => {
    setSearchParams(prev => { v ? prev.set('q', v) : prev.delete('q'); return prev; }, { replace: true });
  }, [setSearchParams]);

  // Preset
  const [activePreset, setActivePreset] = useState<PortfolioPreset>('all');

  // KPI filter
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey | null>(null);

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('portfolio-view-mode') as ViewMode) || 'list'
  );
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('portfolio-view-mode', mode);
  }, []);

  // Preview drawer
  const [previewProject, setPreviewProject] = useState<ProjectWithCustomer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Duplicate modal
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectWithCustomer | null>(null);

  // Derived: has any filter active
  const hasAnyFilter = search || activePreset !== 'all' || kpiFilter || !isFiltersEmpty(advancedFilters);

  // Count active advanced filter dimensions
  const activeFilterCount = useMemo(() => {
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

  const totalFilterCount = activeFilterCount
    + (search ? 1 : 0)
    + (activePreset !== 'all' ? 1 : 0)
    + (kpiFilter ? 1 : 0);

  // --- Filtering pipeline ---
  const filtered = useMemo(() => {
    let result = projects;

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

    switch (activePreset) {
      case 'mine':
        result = result.filter(p => p.engineer_user_id === user?.id);
        break;
      case 'critical':
        result = result.filter(p => p.status === 'active');
        break;
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
      case 'all':
      default:
        break;
    }

    if (kpiFilter) {
      result = applyKpiFilter(result, summaries, kpiFilter);
    }

    if (!isFiltersEmpty(advancedFilters)) {
      result = applyAdvancedFilters(result, summaries, advancedFilters);
    }

    return result;
  }, [projects, search, activePreset, user?.id, kpiFilter, summaries, advancedFilters]);

  const handleKpiFilterChange = useCallback((key: KpiFilterKey | null) => {
    setKpiFilter(key);
  }, []);

  const handleClearAll = useCallback(() => {
    setSearch('');
    setActivePreset('all');
    setKpiFilter(null);
    setAdvancedFilters(emptyFilters);
  }, [setSearch]);

  // ─── Full-page loading (first load, no cached data) ─────────────────────
  if (isLoading && projects.length === 0) {
    return (
      <div className="flex-1 bg-background">
        <AppHeader>
          <div className="ml-2">
            <h1 className="text-h3 font-bold sr-only">Gestão de Obras</h1>
          </div>
        </AppHeader>
        <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4 space-y-4">
          <PortfolioPageSkeleton />
        </main>
      </div>
    );
  }

  // ─── Full-page error (no data at all) ───────────────────────────────────
  if (error && projects.length === 0) {
    return (
      <div className="flex-1 bg-background">
        <AppHeader>
          <div className="ml-2">
            <h1 className="text-h3 font-bold sr-only">Gestão de Obras</h1>
          </div>
        </AppHeader>
        <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4">
          <PortfolioErrorState error={error} onRetry={() => refetch()} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold sr-only">Gestão de Obras</h1>
        </div>
      </AppHeader>

      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Stale data banner */}
        {isStale && !isLoading && projects.length > 0 && (
          <StaleDataBanner onRefresh={() => refetch()} isRefetching={isRefetching} />
        )}

        {/* Command Bar */}
        <PortfolioCommandBar
          search={search}
          onSearchChange={setSearch}
          activePreset={activePreset}
          onPresetChange={(p) => { setActivePreset(p); setKpiFilter(null); }}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          totalCount={projects.length}
          filteredCount={filtered.length}
          activeFilterCount={activeFilterCount}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        {/* Active filter chips */}
        <ActiveFilterChips
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
        />

        {/* KPI Strip */}
        {summariesLoading && summaries.length === 0 ? (
          <KpiStripSkeleton />
        ) : (
          <PortfolioKpiStrip
            projects={projects}
            summaries={summaries}
            activeFilter={kpiFilter}
            onFilterChange={handleKpiFilterChange}
          />
        )}

        {/* Content: Inbox + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Action Inbox + Insights sidebar */}
          <aside className="order-2 lg:order-1 space-y-4">
            {summariesLoading && summaries.length === 0 ? (
              <SidebarSkeleton />
            ) : summariesError && summaries.length === 0 ? (
              <PartialErrorBanner
                section="painel de ações"
                onRetry={() => refetchSummaries()}
              />
            ) : (
              <>
                <PortfolioActionInbox
                  projects={projects}
                  summaries={summaries}
                  onNavigate={(id) => navigate(`/obra/${id}`)}
                />
                <PortfolioInsightsPanel
                  projects={projects}
                  summaries={summaries}
                />
              </>
            )}
          </aside>

          {/* Main grid area */}
          <div className="order-1 lg:order-2">
            <PortfolioGridPlaceholder>
              {isLoading ? (
                <GridSkeleton rows={6} />
              ) : error ? (
                <PortfolioErrorState error={error} onRetry={() => refetch()} />
              ) : projects.length === 0 ? (
                <EmptyPortfolio onCreateProject={() => navigate('/gestao/nova-obra')} />
              ) : filtered.length === 0 ? (
                <NoFilterResults
                  onClearFilters={handleClearAll}
                  activeFilterCount={totalFilterCount}
                />
              ) : (
                <ProjectsListView
                  projects={filtered}
                  onProjectClick={(p) => {
                    setPreviewProject(p);
                    setDrawerOpen(true);
                  }}
                />
              )}
            </PortfolioGridPlaceholder>
          </div>
        </div>
      </main>

      {/* Advanced Filters Sheet */}
      <PortfolioAdvancedFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advancedFilters}
        onApply={setAdvancedFilters}
        projects={projects}
      />

      {/* Preview Drawer */}
      <WorkQuickPreviewDrawer
        project={previewProject}
        summary={summaries.find(s => s.id === previewProject?.id) ?? null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Duplicate Modal */}
      <DuplicateProjectModal
        project={duplicateTarget}
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
