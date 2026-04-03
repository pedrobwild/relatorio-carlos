import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { useProjectsQuery, useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { DuplicateProjectModal } from '@/components/DuplicateProjectModal';
import { PortfolioCommandBar } from './PortfolioCommandBar';
import { PortfolioKpiStrip } from './PortfolioKpiStrip';
import { PortfolioActionInbox } from './PortfolioActionInbox';
import { PortfolioInsightsPanel } from './PortfolioInsightsPanel';
import { WorkQuickPreviewDrawer } from './WorkQuickPreviewDrawer';
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
  const filters = usePortfolioFilters(projects, summaries);

  // ── Preview drawer ──────────────────────────────────────────────────────
  const [previewProject, setPreviewProject] = useState<ProjectWithCustomer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Duplicate modal ─────────────────────────────────────────────────────
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectWithCustomer | null>(null);

  // ── Stale projects dialog ──────────────────────────────────────────────
  const [staleDialogOpen, setStaleDialogOpen] = useState(false);

  const handleKpiFilterChange = useCallback((key: typeof filters.kpiFilter) => {
    if (key === 'stale-7d') {
      setStaleDialogOpen(true);
    } else {
      filters.setKpiFilter(key);
    }
  }, [filters]);

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

      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Stale data banner */}
        {isStale && !isLoading && projects.length > 0 && (
          <StaleDataBanner onRefresh={() => refetch()} isRefetching={isRefetching} />
        )}

        {/* Command Bar */}
        <PortfolioCommandBar
          search={filters.search}
          onSearchChange={filters.setSearch}
          activePreset={filters.activePreset}
          onPresetChange={filters.handlePresetChange}
          viewMode={filters.viewMode}
          onViewModeChange={filters.handleViewModeChange}
          totalCount={projects.length}
          filteredCount={filters.filtered.length}
          activeFilterCount={filters.advancedFilterCount}
          onOpenFilters={() => filters.setFiltersOpen(true)}
        />

        {/* Active filter chips */}
        <ActiveFilterChips
          filters={filters.advancedFilters}
          onFiltersChange={filters.setAdvancedFilters}
        />

        {/* KPI Strip */}
        {summariesLoading && summaries.length === 0 ? (
          <KpiStripSkeleton />
        ) : (
          <PortfolioKpiStrip
            projects={projects}
            summaries={summaries}
            activeFilter={filters.kpiFilter}
            onFilterChange={handleKpiFilterChange}
          />
        )}

        {/* Content: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Sidebar */}
          <aside className="order-2 lg:order-1 space-y-4">
            {summariesLoading && summaries.length === 0 ? (
              <SidebarSkeleton />
            ) : summariesError && summaries.length === 0 ? (
              <PartialErrorBanner section="painel de ações" onRetry={() => refetchSummaries()} />
            ) : (
              <>
                <PortfolioActionInbox
                  projects={projects}
                  summaries={summaries}
                  onNavigate={(id) => {
                    if (id.startsWith('stale-')) {
                      setStaleDialogOpen(true);
                    } else {
                      navigate(`/obra/${id}`);
                    }
                  }}
                />
                <PortfolioInsightsPanel projects={projects} summaries={summaries} />
              </>
            )}
          </aside>

          {/* Main grid */}
          <section className="order-1 lg:order-2 min-h-[400px]" aria-label="Lista de obras">
            {isLoading ? (
              <GridSkeleton rows={6} />
            ) : error ? (
              <PortfolioErrorState error={error} onRetry={() => refetch()} />
            ) : projects.length === 0 ? (
              <EmptyPortfolio onCreateProject={() => navigate('/gestao/nova-obra')} />
            ) : filters.filtered.length === 0 ? (
              <NoFilterResults
                onClearFilters={filters.handleClearAll}
                activeFilterCount={filters.totalFilterCount}
              />
            ) : (
              <ProjectsListView
                projects={filters.filtered}
                onProjectClick={(p) => { setPreviewProject(p); setDrawerOpen(true); }}
              />
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
