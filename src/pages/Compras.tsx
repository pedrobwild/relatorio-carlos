import { Plus, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';

import { PurchaseAlertsPanel } from '@/components/PurchaseAlertsPanel';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProjectSubNav } from '@/components/layout/ProjectSubNav';
import { useComprasState } from './compras/useComprasState';
import { ComprasKPICards } from './compras/ComprasKPICards';
import { PurchasesTable } from './compras/PurchasesTable';
import { PurchaseFormDialog, DeletePurchaseDialog } from './compras/PurchaseFormDialog';
import { PURCHASE_TYPE_LABELS, purchaseTypeToSupplierType } from './compras/types';
import { getSubcategoriesByType } from '@/constants/supplierCategories';
import type { PurchaseType } from '@/hooks/useProjectPurchases';

export default function Compras() {
  const state = useComprasState();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter by search on top of existing filters
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

  // Calculate total actual cost for KPI
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

  const supplierType = purchaseTypeToSupplierType(state.filterCategory);
  const availableSubcategories = supplierType
    ? getSubcategoriesByType(supplierType)
    : [];

  const hasAnyFilter = searchQuery || state.hasActiveFilters;

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Cronograma de Compras"
        backTo={`/obra/${state.projectId}/cronograma`}
        maxWidth="full"
        showLogo={false}
        breadcrumbs={[
          { label: "Gestão", href: "/gestao" },
          { label: "Cronograma", href: `/obra/${state.projectId}/cronograma` },
          { label: "Compras" },
        ]}
      >
        <Button onClick={() => state.handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Item
        </Button>
      </PageHeader>
      <ProjectSubNav showStaffItems />
      <div className="py-6">
        <PageContainer maxWidth="full" className="space-y-5">
          {/* Alerts - compact */}
          <PurchaseAlertsPanel
            alertThresholds={state.alertThresholds}
            getDaysUntilDeadline={state.getDaysUntilDeadline}
            onItemClick={(purchase) => state.handleOpenDialog(purchase)}
          />

          {/* KPI Cards */}
          <ComprasKPICards
            pendingCount={state.pendingPurchases.length}
            orderedCount={state.orderedPurchases.length}
            deliveredCount={state.deliveredPurchases.length}
            overdueCount={state.overduePurchases.length}
            totalEstimatedCost={state.totalEstimatedCost}
            totalActualCost={totalActualCost}
            totalItems={totalItems}
          />

          {/* Search + Filters bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item, fornecedor, categoria..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar itens de compra"
              />
            </div>
            <Select value={state.filterStatus} onValueChange={state.setFilterStatus}>
              <SelectTrigger className="w-40 h-9" aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="ordered">Pedido</SelectItem>
                <SelectItem value="in_transit">Em Trânsito</SelectItem>
                <SelectItem value="delivered">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={state.filterActivity} onValueChange={state.setFilterActivity}>
              <SelectTrigger className="w-56 h-9" aria-label="Filtrar por atividade">
                <SelectValue placeholder="Atividade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as atividades</SelectItem>
                {state.activities.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={state.filterCategory} onValueChange={state.handleCategoryFilterChange}>
              <SelectTrigger className="w-44 h-9" aria-label="Filtrar por tipo de fornecedor">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {SUPPLIER_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {SUPPLIER_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.filterCategory !== 'all' && availableSubcategories.length > 0 && (
              <Select value={state.filterSubcategory} onValueChange={state.setFilterSubcategory}>
                <SelectTrigger className="w-48 h-9" aria-label="Filtrar por subcategoria">
                  <SelectValue placeholder="Subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas subcategorias</SelectItem>
                  {availableSubcategories.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasAnyFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setSearchQuery('');
                  state.clearAllFilters();
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Items */}
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
        </PageContainer>
      </div>

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
      />

      <DeletePurchaseDialog
        open={!!state.deleteId}
        onOpenChange={() => state.setDeleteId(null)}
        onDelete={state.handleDelete}
      />
    </div>
  );
}
