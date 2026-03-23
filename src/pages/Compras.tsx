import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { PurchaseAlertsPanel } from '@/components/PurchaseAlertsPanel';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProjectSubNav } from '@/components/layout/ProjectSubNav';
import { useComprasState } from './compras/useComprasState';
import { ComprasKPICards } from './compras/ComprasKPICards';
import { PurchasesTable } from './compras/PurchasesTable';
import { PurchaseFormDialog, DeletePurchaseDialog } from './compras/PurchaseFormDialog';

export default function Compras() {
  const state = useComprasState();

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <PageContainer maxWidth="full" className="space-y-6">
          <PurchaseAlertsPanel
            alertThresholds={state.alertThresholds}
            getDaysUntilDeadline={state.getDaysUntilDeadline}
            onItemClick={(purchase) => state.handleOpenDialog(purchase)}
          />

          <ComprasKPICards
            pendingCount={state.pendingPurchases.length}
            orderedCount={state.orderedPurchases.length}
            deliveredCount={state.deliveredPurchases.length}
            overdueCount={state.overduePurchases.length}
            totalEstimatedCost={state.totalEstimatedCost}
          />

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtros:</span>
                </div>
                <Select value={state.filterStatus} onValueChange={state.setFilterStatus}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="ordered">Pedido</SelectItem>
                    <SelectItem value="in_transit">Em Trânsito</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={state.filterActivity} onValueChange={state.setFilterActivity}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Atividade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as atividades</SelectItem>
                    {state.activities.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <PurchasesTable
            purchases={state.filteredPurchases}
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
