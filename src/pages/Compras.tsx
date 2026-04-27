import { Plus, Search, Package, Wrench, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { matchesSearch } from '@/lib/searchNormalize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui-premium';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

import { PurchaseAlertsPanel } from '@/components/PurchaseAlertsPanel';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useComprasState } from './compras/useComprasState';
import { ComprasKPICards } from './compras/ComprasKPICards';
import { PurchasesTable } from './compras/PurchasesTable';
import { PurchaseFormDialog, DeletePurchaseDialog } from './compras/PurchaseFormDialog';
import { PrestadorCalendar } from './compras/PrestadorCalendar';
import { getSubcategoriesByType } from '@/constants/supplierCategories';
import type { PurchaseType } from '@/hooks/useProjectPurchases';

function ComprasTabContent({ purchaseType }: { purchaseType: PurchaseType }) {
  const state = useComprasState(purchaseType);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const isProduto = purchaseType === 'produto';
  const label = isProduto ? 'Produto' : 'Prestador';

  const handleSyncBudget = async () => {
    if (!state.projectId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_budget_items_to_purchases', {
        p_project_id: state.projectId,
      });
      if (error) throw error;
      const count = data as number;
      if (count > 0) {
        toast.success(`${count} item(s) importado(s) do orçamento`);
        queryClient.invalidateQueries({ queryKey: queryKeys.purchases.list(state.projectId) });
      } else {
        toast.info('Nenhum item novo encontrado no orçamento');
      }
    } catch (err: unknown) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar orçamento');
    } finally {
      setSyncing(false);
    }
  };

  const searchFilteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return state.filteredPurchases;
    const q = searchQuery.toLowerCase();
    return state.filteredPurchases.filter(p =>
      p.item_name.toLowerCase().includes(q) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [state.filteredPurchases, searchQuery]);

  const totalActualCost = useMemo(() =>
    state.filteredPurchases
      .filter(p => p.status !== 'cancelled')
      .reduce((sum, p) => sum + (p.actual_cost || 0), 0),
    [state.filteredPurchases]
  );

  const totalItems = useMemo(() =>
    state.filteredPurchases.filter(p => p.status !== 'cancelled').length,
    [state.filteredPurchases]
  );

  // Compute type-filtered KPI counts (the hook returns unfiltered counts)
  const pendingCount = useMemo(() =>
    state.filteredPurchases.filter(p => p.status === 'pending').length,
    [state.filteredPurchases]
  );
  const orderedCount = useMemo(() =>
    state.filteredPurchases.filter(p => p.status === 'ordered' || p.status === 'in_transit').length,
    [state.filteredPurchases]
  );
  const deliveredCount = useMemo(() =>
    state.filteredPurchases.filter(p => p.status === 'delivered').length,
    [state.filteredPurchases]
  );
  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return state.filteredPurchases.filter(p => {
      if (p.status === 'delivered' || p.status === 'cancelled') return false;
      const requiredDate = new Date(p.required_by_date + 'T00:00:00');
      return requiredDate < today;
    }).length;
  }, [state.filteredPurchases]);
  const totalEstimatedCostFiltered = useMemo(() =>
    state.filteredPurchases
      .filter(p => p.status !== 'cancelled')
      .reduce((sum, p) => sum + (p.estimated_cost || 0), 0),
    [state.filteredPurchases]
  );

  const availableSubcategories = getSubcategoriesByType(isProduto ? 'produtos' : 'prestadores');
  const hasAnyFilter = !!searchQuery || state.hasActiveFilters;

  if (state.isLoading) {
    return (
      <div className="py-4">
        <PageSkeleton metrics content="table" />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4">
      {/* Calendar view for prestadores */}
      {purchaseType === 'prestador' && <PrestadorCalendar onNew={() => state.handleOpenDialog()} />}

      <PurchaseAlertsPanel
        alertThresholds={state.alertThresholds}
        getDaysUntilDeadline={state.getDaysUntilDeadline}
        onItemClick={(purchase) => state.handleOpenDialog(purchase)}
      />

      <ComprasKPICards
        pendingCount={pendingCount}
        orderedCount={orderedCount}
        deliveredCount={deliveredCount}
        overdueCount={overdueCount}
        totalEstimatedCost={totalEstimatedCostFiltered}
        totalActualCost={totalActualCost}
        totalItems={totalItems}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar ${label.toLowerCase()}, fornecedor, categoria...`}
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={state.filterStatus} onValueChange={state.setFilterStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            {isProduto && <SelectItem value="awaiting_approval">Solic. Aprovação</SelectItem>}
            {isProduto && <SelectItem value="approved">Aprovado</SelectItem>}
            {isProduto && <SelectItem value="purchased">Compra Realizada</SelectItem>}
            <SelectItem value="ordered">{isProduto ? 'Pedido' : 'Contratado'}</SelectItem>
            <SelectItem value="in_transit">{isProduto ? 'Em Trânsito' : 'Em Execução'}</SelectItem>
            <SelectItem value="delivered">{isProduto ? 'Entregue' : 'Concluído'}</SelectItem>
            {isProduto && <SelectItem value="sent_to_site">Enviado p/ Obra</SelectItem>}
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={state.filterActivity} onValueChange={state.setFilterActivity}>
          <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Atividade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as atividades</SelectItem>
            {state.activities.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
          </SelectContent>
        </Select>
        {availableSubcategories.length > 0 && (
          <Select value={state.filterSubcategory} onValueChange={state.setFilterSubcategory}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Subcategoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas subcategorias</SelectItem>
              {availableSubcategories.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasAnyFilter && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearchQuery(''); state.clearAllFilters(); }}>
            Limpar filtros
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isProduto && (
            <Button variant="outline" size="sm" onClick={handleSyncBudget} disabled={syncing}>
              <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
              Importar do Orçamento
            </Button>
          )}
          <Button onClick={() => state.handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo {label}
          </Button>
        </div>
      </div>

      <PurchasesTable
        purchases={searchFilteredPurchases}
        getActivityName={state.getActivityName}
        getDaysUntilRequired={state.getDaysUntilRequired}
        onEdit={(p) => state.handleOpenDialog(p)}
        onDelete={(id) => state.setDeleteId(id)}
        onStatusChange={state.handleStatusChange}
        onAddFirst={() => state.handleOpenDialog()}
        onUpdateActualCost={state.handleUpdateActualCost}
        onUpdateNotes={state.handleUpdateNotes}
        onUpdateField={state.handleUpdateField}
      />

      <PurchaseFormDialog
        open={state.isDialogOpen}
        onOpenChange={state.setIsDialogOpen}
        isEditing={!!state.editingPurchase}
        formData={state.formData}
        setFormData={state.setFormData}
        activities={state.activities}
        onActivityChange={state.handleActivityChange}
        onLeadTimeChange={state.handleLeadTimeChange}
        onSubmit={state.handleSubmit}
        isSubmitting={state.addPurchase.isPending || state.updatePurchase.isPending}
        paymentInstallments={state.paymentInstallments}
        onPaymentInstallmentsChange={state.setPaymentInstallments}
        editingPurchaseId={state.editingPurchase?.id}
        draftLastSavedAt={state.draftLastSavedAt}
      />

      <DeletePurchaseDialog
        open={!!state.deleteId}
        onOpenChange={() => state.setDeleteId(null)}
        onDelete={state.handleDelete}
      />
    </div>
  );
}

export default function Compras() {
  const [activeTab, setActiveTab] = useState<string>('produtos');

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Compras"
        backTo="/gestao"
        maxWidth="full"
        showLogo={false}
        breadcrumbs={[
          { label: "Gestão", href: "/gestao" },
          { label: "Compras" },
        ]}
      />
      <div className="py-6">
        <PageContainer maxWidth="full">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="produtos" className="gap-1.5">
                <Package className="h-4 w-4" />
                Produtos
              </TabsTrigger>
              <TabsTrigger value="prestadores" className="gap-1.5">
                <Wrench className="h-4 w-4" />
                Prestadores
              </TabsTrigger>
            </TabsList>
            <TabsContent value="produtos">
              <ComprasTabContent purchaseType="produto" />
            </TabsContent>
            <TabsContent value="prestadores">
              <ComprasTabContent purchaseType="prestador" />
            </TabsContent>
          </Tabs>
        </PageContainer>
      </div>
    </div>
  );
}
