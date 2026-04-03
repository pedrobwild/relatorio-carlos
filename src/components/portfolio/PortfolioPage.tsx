import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppHeader';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { useProjectsQuery, useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { useAuth } from '@/hooks/useAuth';
import { DuplicateProjectModal } from '@/components/DuplicateProjectModal';
import { PortfolioCommandBar, type PortfolioPreset, type ViewMode } from './PortfolioCommandBar';
import { PortfolioKpiStrip, applyKpiFilter, type KpiFilterKey } from './PortfolioKpiStrip';
import { PortfolioActionInbox } from './PortfolioActionInbox';
import { PortfolioInsightsPanel } from './PortfolioInsightsPanel';
import { PortfolioGridPlaceholder } from './PortfolioGridPlaceholder';
import { PortfolioPreviewDrawer } from './PortfolioPreviewDrawer';
import { ProjectsListView } from '@/components/gestao/ProjectsListView';
import type { ProjectWithCustomer } from '@/infra/repositories';

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects = [], isLoading, error, refetch } = useProjectsQuery();
  const { data: summaries = [] } = useProjectSummaryQuery();

  // Search
  const search = searchParams.get('q') || '';
  const setSearch = useCallback((v: string) => {
    setSearchParams(prev => { v ? prev.set('q', v) : prev.delete('q'); return prev; }, { replace: true });
  }, [setSearchParams]);

  // Preset
  const [activePreset, setActivePreset] = useState<PortfolioPreset>('all');

  // KPI filter
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey | null>(null);

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

  // --- Filtering pipeline ---
  const filtered = useMemo(() => {
    let result = projects;

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

    // Preset filters
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
          return daysLeft >= 0 && daysLeft <= 30;
        });
        break;
      case 'all':
      default:
        break;
    }

    // KPI filter (additive on top of preset)
    if (kpiFilter) {
      result = applyKpiFilter(result, summaries, kpiFilter);
    }

    return result;
  }, [projects, search, activePreset, user?.id, kpiFilter, summaries]);

  const handleKpiFilterChange = useCallback((key: KpiFilterKey | null) => {
    setKpiFilter(key);
  }, []);

  return (
    <div className="flex-1 bg-background">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold sr-only">Gestão de Obras</h1>
        </div>
      </AppHeader>

      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Command Bar */}
        <PortfolioCommandBar
          search={search}
          onSearchChange={setSearch}
          activePreset={activePreset}
          onPresetChange={(p) => { setActivePreset(p); setKpiFilter(null); }}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          totalCount={projects.length}
        />

        {/* KPI Strip */}
        <PortfolioKpiStrip
          projects={projects}
          summaries={summaries}
          activeFilter={kpiFilter}
          onFilterChange={handleKpiFilterChange}
        />

        {/* Content: Inbox + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Action Inbox sidebar */}
          <aside className="order-2 lg:order-1">
            <PortfolioActionInbox />
          </aside>

          {/* Main grid area */}
          <div className="order-1 lg:order-2">
            <PortfolioGridPlaceholder>
              {isLoading ? (
                <ContentSkeleton variant="table" rows={6} />
              ) : error ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
                  <p className="text-sm text-destructive">
                    Erro ao carregar obras: {String(error)}
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  {search || activePreset !== 'all' || kpiFilter ? (
                    <>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Nenhuma obra encontrada
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Ajuste a busca ou selecione outro filtro.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                          setActivePreset('all');
                          setKpiFilter(null);
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Cadastre sua primeira obra
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Gerencie cronogramas, financeiro e a jornada completa.
                      </p>
                      <Button size="sm" onClick={() => navigate('/gestao/nova-obra')}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Criar nova obra
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <ProjectsListView projects={filtered} />
              )}
            </PortfolioGridPlaceholder>
          </div>
        </div>
      </main>

      {/* Preview Drawer */}
      <PortfolioPreviewDrawer
        project={previewProject}
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
