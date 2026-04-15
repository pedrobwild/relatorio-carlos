import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import type { ProjectFinancial } from './PortfolioKpiStrip';
import { useProjectsQuery, useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { DuplicateProjectModal } from '@/components/DuplicateProjectModal';
import { PortfolioCommandBar } from './PortfolioCommandBar';
import { PortfolioKpiStrip } from './PortfolioKpiStrip';
import { PortfolioPriorityBar } from './PortfolioPriorityBar';
import { PortfolioActionInbox } from './PortfolioActionInbox';
import { PortfolioInsightsPanel } from './PortfolioInsightsPanel';
import { WorkQuickPreviewDrawer } from './WorkQuickPreviewDrawer';
import { MobileProjectList } from './MobileProjectList';
import { ProjectsListView } from '@/components/gestao/ProjectsListView';
import { ProjectsCardView } from '@/components/gestao/ProjectsCardView';
import { PortfolioAdvancedFilters } from './filters/PortfolioAdvancedFilters';
import { ActiveFilterChips } from './filters/ActiveFilterChips';
import { usePortfolioFilters } from './hooks/usePortfolioFilters';
import { StaleProjectsDialog } from './StaleProjectsDialog';
import {
  PortfolioPageSkeleton, KpiStripSkeleton, SidebarSkeleton,
  GridSkeleton, EmptyPortfolio, NoFilterResults,
  PortfolioErrorState, StaleDataBanner, PartialErrorBanner,
} from './PortfolioStates';
import type { ProjectWithCustomer } from '@/infra/repositories';

export default function PortfolioPage() {
  const navigate = useNavigate();

  // ── Data queries ────────────────────────────────────────────────────────
  const {
    data: projects = [], isLoading, error, refetch,
    isRefetching, isStale,
  } = useProjectsQuery();

  const {
    data: summaries = [],
    isLoading: summariesLoading,
    error: summariesError,
    refetch: refetchSummaries,
  } = useProjectSummaryQuery();

  // ── Filters (all filtering logic extracted) ─────────────────────────────
  // TODO: replace with useProjectFinancials() hook when financial data is available
  const financials = useMemo(() => new Map<string, ProjectFinancial>(), []);

  const filters = usePortfolioFilters(projects, summaries, financials);

  // ── Preview drawer ──────────────────────────────────────────────────────
  const [previewProject, setPreviewProject] = useState<ProjectWithCustomer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Duplicate modal ─────────────────────────────────────────────────────
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectWithCustomer | null>(null);

  // ── Stale projects dialog ──────────────────────────────────────────────
  const [staleDialogOpen, setStaleDialogOpen] = useState(false);

  // ── Priority bar ───────────────────────────────────────────────────────
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const handleKpiFilterChange = useCallback((key: typeof filters.kpiFilter) => {
    setPriorityFilter(null);
    if (key === 'stale-7d') {
      setStaleDialogOpen(true);
    } else {
      filters.setKpiFilter(key);
    }
  }, [filters.setKpiFilter]);

  const handlePrioritySelect = useCallback((key: string | null) => {
    setPriorityFilter(key);
    filters.setKpiFilter(null);
  }, [filters.setKpiFilter]);

  // ── Priority-filtered list ─────────────────────────────────────────────
  const displayedProjects = useMemo(() => {
    if (!priorityFilter) return filters.filtered;
    const now = Date.now();
    const MS_7D = 7 * 24 * 60 * 60 * 1000;
    const MS_14D = 14 * 24 * 60 * 60 * 1000;
    const summaryMap = new Map(summaries.map(s => [s.id, s]));

    return filters.filtered.filter(p => {
      const s = summaryMap.get(p.id);
      switch (priorityFilter) {
        case 'critical':
          return p.status === 'active' && s && s.overdue_count > 0;
        case 'no-update': {
          if (p.status !== 'active') return false;
          const ref = s?.last_activity_at ?? p.created_at;
          const refTime = ref ? new Date(ref).getTime() : 0;
          return refTime > 0 && now - refTime > MS_7D;
        }
        case 'cost-risk': {
          const fin = financials.get(p.id);
          if (!fin || fin.budget_approved <= 0) return false;
          return (fin.cost_committed + fin.cost_realized) / fin.budget_approved - 1 > 0.15;
        }
        case 'delivery-14d': {
          if (!p.planned_end_date || p.status !== 'active') return false;
          const diff = new Date(p.planned_end_date).getTime() - now;
          return diff >= 0 && diff <= MS_14D;
        }
        default:
          return true;
      }
    });
  }, [filters.filtered, priorityFilter, summaries, financials]);

  const handleStaleAction = useCallback((projectId: string) => {
    if (projectId.startsWith('stale-')) {
      setStaleDialogOpen(true);
    } else {
      navigate(`/obra/${projectId}`);
    }
  }, [navigate]);

  // ── Full-page loading ───────────────────────────────────────────────────
  if (isLoading && projects.length === 0) {
    return (
      <PageShell>
        <PortfolioPageSkeleton />
      </PageShell>
    );
  }

  // ── Full-page error ─────────────────────────────────────────────────────
  if (error && projects.length === 0) {
    return (
      <PageShell>
        <PortfolioErrorState error={error} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <div className="flex-1 bg-background">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold sr-only">Gestão de Obras</h1>
        </div>
      </AppHeader>

      <main id="main-content" className="max-w-[1440px] mx-auto px-4 lg:px-6 py-3 space-y-2.5 md:pb-4">
        {/* Stale data banner */}
        {isStale && !isLoading && projects.length > 0 && (
          <StaleDataBanner onRefresh={() => refetch()} isRefetching={isRefetching} />
        )}

        {/* Live region for filter count announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {displayedProjects.length} de {projects.length} obras exibidas
        </div>

        {/* Command Bar */}
        <PortfolioCommandBar
          search={filters.search}
          onSearchChange={filters.setSearch}
          activePreset={filters.activePreset}
          onPresetChange={filters.handlePresetChange}
          viewMode={filters.viewMode}
          onViewModeChange={filters.handleViewModeChange}
          scopeFilter={filters.scopeFilter}
          onScopeChange={filters.setScopeFilter}
          totalCount={projects.length}
          filteredCount={displayedProjects.length}
          activeFilterCount={filters.advancedFilterCount}
          onOpenFilters={() => filters.setFiltersOpen(true)}
        />

        {/* Active filter chips */}
        <ActiveFilterChips
          filters={filters.advancedFilters}
          onFiltersChange={filters.setAdvancedFilters}
        />

        {/* Filter results indicator */}
        {filters.hasAnyFilter && displayedProjects.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium tabular-nums">
              {displayedProjects.length} obra{displayedProjects.length !== 1 ? 's' : ''} encontrada{displayedProjects.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <button
              type="button"
              onClick={filters.handleClearAll}
              className="text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* KPI Strip */}
        {summariesLoading && summaries.length === 0 ? (
          <KpiStripSkeleton />
        ) : (
          <PortfolioKpiStrip
            projects={projects}
            summaries={summaries}
            financials={financials}
            activeFilter={filters.kpiFilter}
            onFilterChange={handleKpiFilterChange}
          />
        )}

        {/* Priority Bar */}
        <PortfolioPriorityBar activeKey={priorityFilter} onSelect={handlePrioritySelect} />

        {/* Content: Full-width Grid */}
        <div>
          {/* Main grid */}
          <section className="min-h-[400px]" aria-label="Lista de obras">
            {isLoading ? (
              <GridSkeleton rows={6} />
            ) : error ? (
              <PortfolioErrorState error={error} onRetry={() => refetch()} />
            ) : projects.length === 0 ? (
              <EmptyPortfolio onCreateProject={() => navigate('/gestao/nova-obra')} />
            ) : displayedProjects.length === 0 ? (
              <NoFilterResults
                onClearFilters={filters.handleClearAll}
                activeFilterCount={filters.totalFilterCount}
              />
            ) : (
              <>
                {/* Mobile: compact list view (default) */}
                <div className="block md:hidden">
                  <MobileProjectList
                    projects={displayedProjects}
                    onProjectClick={(p) => { setPreviewProject(p); setDrawerOpen(true); }}
                  />
                </div>
                {/* Desktop: respects view mode */}
                <div className="hidden md:block">
                  {filters.viewMode === 'cards' ? (
                    <ProjectsCardView
                      projects={displayedProjects}
                      onProjectClick={(p) => { setPreviewProject(p); setDrawerOpen(true); }}
                    />
                  ) : (
                    <ProjectsListView
                      projects={displayedProjects}
                      onProjectClick={(p) => { setPreviewProject(p); setDrawerOpen(true); }}
                    />
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Sheets & Modals */}
      <PortfolioAdvancedFilters
        open={filters.filtersOpen}
        onOpenChange={filters.setFiltersOpen}
        filters={filters.advancedFilters}
        onApply={filters.setAdvancedFilters}
        projects={projects}
      />

      <WorkQuickPreviewDrawer
        project={previewProject}
        summary={summaries.find(s => s.id === previewProject?.id) ?? null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <DuplicateProjectModal
        project={duplicateTarget}
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        onSuccess={() => refetch()}
      />

      <StaleProjectsDialog
        open={staleDialogOpen}
        onOpenChange={setStaleDialogOpen}
        projects={projects}
        summaries={summaries}
      />
    </div>
  );
}

/** Reusable page shell for loading/error states */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-background">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold sr-only">Gestão de Obras</h1>
        </div>
      </AppHeader>
      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4 space-y-4">
        {children}
      </main>
    </div>
  );
}
