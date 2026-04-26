/**
 * Painel de Obras — cockpit operacional unificado.
 *
 * Container que compõe os pedaços e delega:
 *  - estado de filtros/sort/busca → `usePainelFilters`
 *  - seleção em massa → `usePainelSelection`
 *  - persistência de views → `useSavedViews`
 *
 * UX: tabs no topo (Obras / Fornecedores), seguido das saved views, KPIs
 * clicáveis, toolbar sticky com chips removíveis, tabela densa com checkbox
 * por linha e barra flutuante de ações em massa quando há seleção.
 */
import { useMemo, useState, lazy, Suspense, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Headset, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/ui-premium';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { usePainelObras, type PainelObra } from '@/hooks/usePainelObras';
import { EmptyState } from '@/components/ui/states';
import { ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { PainelKpis } from './PainelKpis';
import { PainelFilters } from './PainelFilters';
import { PainelTable } from './PainelTable';
import { PainelTabs } from './PainelTabs';
import { PainelDetailSheet } from './PainelDetailSheet';
import { PainelBulkBar } from './PainelBulkBar';
import { usePainelFilters } from './usePainelFilters';
import { usePainelSelection } from './usePainelSelection';
import { useSavedViews } from './useSavedViews';
import { computeDisplayStatus, EMPTY_FILTERS, type SavedView } from './types';

const Fornecedores = lazy(() => import('@/pages/gestao/Fornecedores'));

const VIEW_SCOPE: Record<string, 'all' | 'critical' | 'this-month-delivery' | 'awaiting-customer'> = {
  todas: 'all',
  criticas: 'critical',
  'entregando-mes': 'this-month-delivery',
  'aguardando-cliente': 'awaiting-customer',
};

export default function PainelObras() {
  const navigate = useNavigate();
  const { isStaff, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const { obras, isLoading, updateObra } = usePainelObras();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'fornecedores' ? 'fornecedores' : 'obras';
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'obras') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  // Saved views
  const savedViews = useSavedViews(user?.id ?? null);
  const [activeViewId, setActiveViewId] = useState<string>('todas');
  const activeView = useMemo(
    () => savedViews.views.find((v) => v.id === activeViewId) ?? savedViews.views[0],
    [savedViews.views, activeViewId],
  );
  const scope = VIEW_SCOPE[activeView?.id ?? 'todas'] ?? 'all';

  // Filtros / sort / busca
  const filters = usePainelFilters({ obras, scope });

  // Quando trocar de view, hidrata os filtros
  const handleSelectView = useCallback(
    (view: SavedView) => {
      setActiveViewId(view.id);
      filters.setFromView(view.filters);
    },
    [filters],
  );

  const handleCreateView = useCallback(
    (name: string) => {
      const id = `custom-${Date.now()}`;
      const view: SavedView = {
        id,
        name,
        filters: { ...filters.state },
      };
      savedViews.upsertView(view);
      setActiveViewId(id);
      toast.success(`View "${name}" criada.`);
    },
    [filters.state, savedViews],
  );

  // Seleção
  const selection = usePainelSelection(filters.filtered.map((o) => o.id));
  const selectedObras = useMemo(
    () => filters.filtered.filter((o) => selection.has(o.id)),
    [filters.filtered, selection],
  );

  // Detalhe
  const [detailObra, setDetailObra] = useState<PainelObra | null>(null);
  const handleOpenDetail = (obra: PainelObra) => setDetailObra(obra);
  const handleCloseDetail = (open: boolean) => {
    if (!open) setDetailObra(null);
  };

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<PainelObra | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('projects').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Obra "${deleteTarget.nome}" excluída com sucesso.`);
      queryClient.invalidateQueries({ queryKey: ['painel-obras'] });
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir obra. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  // Engenheiros únicos para o BulkBar (extraídos do dataset atual).
  const engineers = useMemo(() => {
    const seen = new Map<string, string>();
    obras.forEach((o) => {
      if (o.engineer_name) seen.set(o.engineer_name, o.engineer_name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [obras]);

  // KPIs (sempre baseados em `obras` brutos — independente da view ativa).
  const summary = useMemo(() => {
    const displayed = obras.map((o) => computeDisplayStatus(o));
    return {
      total: obras.length,
      aguardando: displayed.filter((s) => s === 'Aguardando').length,
      emDia: displayed.filter((s) => s === 'Em dia').length,
      atrasadas: displayed.filter((s) => s === 'Atrasado').length,
      paralisadas: displayed.filter((s) => s === 'Paralisada').length,
    };
  }, [obras]);

  // Limpa seleção ao trocar de view.
  useEffect(() => {
    selection.clear();
  }, [activeViewId, selection]);

  if (roleLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }

  if (!isStaff) {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldOff}
          title="Acesso restrito"
          description="O Painel de Obras é exclusivo da equipe interna."
        />
      </PageContainer>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <PageContainer maxWidth="full">
        <PageHeader
          eyebrow="Operações"
          title="Painel de Obras"
          description="Cockpit operacional unificado — monitore status, prazos e relacionamento de todas as obras em execução."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/gestao/cs/operacional')}
                className="h-9 gap-2"
              >
                <Headset className="h-4 w-4" />
                <span className="hidden sm:inline">Customer Success</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-60" />
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/gestao/nova-obra')}
                className="h-9 gap-2"
              >
                <Plus className="h-4 w-4" />
                Nova obra
              </Button>
            </>
          }
          flush
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
          <TabsList className="bg-surface-sunken border border-border-subtle">
            <TabsTrigger value="obras" className="text-xs data-[state=active]:bg-card">
              Obras
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="text-xs data-[state=active]:bg-card">
              Fornecedores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="obras" className="mt-4 focus-visible:outline-none space-y-4">
            <PainelTabs
              views={savedViews.views}
              activeViewId={activeViewId}
              onSelectView={handleSelectView}
              onRemoveView={(id) => {
                savedViews.removeView(id);
                if (activeViewId === id) {
                  setActiveViewId('todas');
                  filters.setFromView({ ...EMPTY_FILTERS });
                }
              }}
              onCreateView={handleCreateView}
              currentFilters={filters.state}
            />

            <PainelKpis
              summary={summary}
              activeStatusFilter={filters.state.filterStatus}
              onSelectStatus={(s) => filters.set('filterStatus', s)}
            />

            <PainelFilters
              state={filters.state}
              set={filters.set}
              onClear={filters.clearFilters}
              hasFilters={filters.hasFilters}
              resultCount={filters.filtered.length}
              totalCount={obras.length}
            />

            <PainelTable
              isLoading={isLoading}
              rows={filters.filtered}
              totalRows={obras.length}
              sortKey={filters.state.sortKey}
              sortDir={filters.state.sortDir}
              onToggleSort={filters.toggleSort}
              selection={selection}
              onUpdateRow={updateObra}
              onOpenDetail={handleOpenDetail}
              onOpenObra={(id) => navigate(`/obra/${id}`)}
              onDeleteRequest={(o) => setDeleteTarget(o)}
            />
          </TabsContent>

          <TabsContent value="fornecedores" className="mt-4 focus-visible:outline-none">
            <Suspense
              fallback={
                <div
                  className="space-y-3 p-4"
                  aria-busy="true"
                  aria-label="Carregando fornecedores"
                >
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-96 w-full" />
                </div>
              }
            >
              <Fornecedores />
            </Suspense>
          </TabsContent>
        </Tabs>

        <PainelDetailSheet
          obra={detailObra}
          onOpenChange={handleCloseDetail}
          onOpenObra={(id) => {
            setDetailObra(null);
            navigate(`/obra/${id}`);
          }}
        />

        <PainelBulkBar
          selectedIds={selection.selectedIds}
          selectedCount={selection.selectedCount}
          selectedObras={selectedObras}
          engineers={engineers}
          applyPatch={async (id, patch) => {
            await updateObra(id, patch);
          }}
          onClear={selection.clear}
        />

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(o) => {
            if (!o && !deleting) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Excluir obra?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">Você está prestes a excluir permanentemente a obra:</span>
                <span className="block font-semibold text-foreground">
                  {deleteTarget?.customer_name && <>{deleteTarget.customer_name} — </>}
                  {deleteTarget?.nome}
                </span>
                <span className="block text-destructive/80 font-medium">
                  Esta ação não pode ser desfeita. Todos os dados vinculados (compras, pagamentos,
                  registros diários) serão excluídos.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Excluindo…' : 'Sim, excluir obra'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </TooltipProvider>
  );
}
