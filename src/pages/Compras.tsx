import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Plus, 
  Calendar, 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertTriangle,
  Filter,
  ArrowLeft,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  X
} from 'lucide-react';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

import { useProjectPurchases, ProjectPurchase, PurchaseInput, PurchaseStatus, UrgencyLevel } from '@/hooks/useProjectPurchases';
import { useProjectActivities } from '@/hooks/useProjectActivities';
import { PurchaseAlertsPanel } from '@/components/PurchaseAlertsPanel';
import { PurchaseAlertBadge } from '@/components/PurchaseAlertBadge';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';

const statusConfig: Record<PurchaseStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/20 text-amber-700 border-amber-500/30', icon: Clock },
  ordered: { label: 'Pedido', color: 'bg-blue-500/20 text-blue-700 border-blue-500/30', icon: Package },
  in_transit: { label: 'Em Trânsito', color: 'bg-purple-500/20 text-purple-700 border-purple-500/30', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-green-500/20 text-green-700 border-green-500/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-muted', icon: X },
};

const emptyPurchase: Partial<PurchaseInput> = {
  item_name: '',
  description: '',
  quantity: 1,
  unit: 'un',
  estimated_cost: undefined,
  supplier_name: '',
  supplier_contact: '',
  lead_time_days: 7,
  required_by_date: '',
  notes: '',
};

export default function Compras() {
  const { projectId } = useParams<{ projectId: string }>();
  const { 
    purchases, 
    isLoading, 
    addPurchase, 
    updatePurchase, 
    deletePurchase,
    updateStatus,
    pendingPurchases,
    orderedPurchases,
    deliveredPurchases,
    overduePurchases,
    totalEstimatedCost,
    alertThresholds,
    getUrgencyLevel,
    getDaysUntilDeadline,
  } = useProjectPurchases(projectId, true); // Enable toast alerts
  const { activities } = useProjectActivities(projectId);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<ProjectPurchase | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PurchaseInput>>(emptyPurchase);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterActivity !== 'all' && p.activity_id !== filterActivity) return false;
      return true;
    });
  }, [purchases, filterStatus, filterActivity]);

  const handleOpenDialog = (purchase?: ProjectPurchase) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setFormData({
        activity_id: purchase.activity_id,
        item_name: purchase.item_name,
        description: purchase.description || '',
        quantity: purchase.quantity,
        unit: purchase.unit,
        estimated_cost: purchase.estimated_cost || undefined,
        supplier_name: purchase.supplier_name || '',
        supplier_contact: purchase.supplier_contact || '',
        lead_time_days: purchase.lead_time_days,
        required_by_date: purchase.required_by_date,
        order_date: purchase.order_date || undefined,
        expected_delivery_date: purchase.expected_delivery_date || undefined,
        invoice_number: purchase.invoice_number || '',
        notes: purchase.notes || '',
      });
    } else {
      setEditingPurchase(null);
      setFormData(emptyPurchase);
    }
    setIsDialogOpen(true);
  };

  const handleActivityChange = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      const leadTime = formData.lead_time_days || 7;
      const activityStart = parseISO(activity.planned_start);
      const requiredDate = subDays(activityStart, leadTime);
      setFormData(prev => ({
        ...prev,
        activity_id: activityId,
        required_by_date: format(requiredDate, 'yyyy-MM-dd'),
      }));
    } else {
      setFormData(prev => ({ ...prev, activity_id: undefined }));
    }
  };

  const handleLeadTimeChange = (leadTime: number) => {
    setFormData(prev => {
      if (prev.activity_id) {
        const activity = activities.find(a => a.id === prev.activity_id);
        if (activity) {
          const activityStart = parseISO(activity.planned_start);
          const requiredDate = subDays(activityStart, leadTime);
          return { ...prev, lead_time_days: leadTime, required_by_date: format(requiredDate, 'yyyy-MM-dd') };
        }
      }
      return { ...prev, lead_time_days: leadTime };
    });
  };

  const handleSubmit = async () => {
    if (!projectId || !formData.item_name || !formData.required_by_date) return;

    const input: PurchaseInput = {
      project_id: projectId,
      activity_id: formData.activity_id || null,
      item_name: formData.item_name,
      description: formData.description || null,
      quantity: formData.quantity || 1,
      unit: formData.unit || 'un',
      estimated_cost: formData.estimated_cost || null,
      supplier_name: formData.supplier_name || null,
      supplier_contact: formData.supplier_contact || null,
      lead_time_days: formData.lead_time_days || 7,
      required_by_date: formData.required_by_date,
      order_date: formData.order_date || null,
      expected_delivery_date: formData.expected_delivery_date || null,
      invoice_number: formData.invoice_number || null,
      notes: formData.notes || null,
    };

    if (editingPurchase) {
      await updatePurchase.mutateAsync({ id: editingPurchase.id, ...input });
    } else {
      await addPurchase.mutateAsync(input);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deletePurchase.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleStatusChange = async (id: string, newStatus: PurchaseStatus) => {
    await updateStatus.mutateAsync({ id, status: newStatus });
  };

  const getActivityName = (activityId: string | null) => {
    if (!activityId) return '—';
    const activity = activities.find(a => a.id === activityId);
    return activity?.description || '—';
  };

  const getDaysUntilRequired = (requiredDate: string, status: PurchaseStatus) => {
    if (status === 'delivered' || status === 'cancelled') return null;
    const days = differenceInDays(parseISO(requiredDate), new Date());
    return days;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Cronograma de Compras" backTo={`/obra/${projectId}/cronograma`} maxWidth="full" showLogo={false}>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Item
        </Button>
      </PageHeader>
      <div className="py-6">
        <PageContainer maxWidth="full" className="space-y-6">

        {/* Alerts Panel */}
        <PurchaseAlertsPanel
          alertThresholds={alertThresholds}
          getDaysUntilDeadline={getDaysUntilDeadline}
          onItemClick={(purchase) => handleOpenDialog(purchase)}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{pendingPurchases.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Pedido</p>
                  <p className="text-2xl font-bold">{orderedPurchases.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entregues</p>
                  <p className="text-2xl font-bold">{deliveredPurchases.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Atrasados</p>
                  <p className="text-2xl font-bold text-destructive">{overduePurchases.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Estimado</p>
                  <p className="text-xl font-bold">
                    {totalEstimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="ordered">Pedido</SelectItem>
                  <SelectItem value="in_transit">Em Trânsito</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterActivity} onValueChange={setFilterActivity}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Atividade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as atividades</SelectItem>
                  {activities.map(activity => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Itens de Compra ({filteredPurchases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum item de compra encontrado</p>
                <Button variant="link" onClick={() => handleOpenDialog()}>
                  Adicionar primeiro item
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Custo Est.</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Data Limite</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map(purchase => {
                    const StatusIcon = statusConfig[purchase.status].icon;
                    const daysUntil = getDaysUntilRequired(purchase.required_by_date, purchase.status);
                    const isOverdue = daysUntil !== null && daysUntil < 0;
                    const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;

                    return (
                      <TableRow key={purchase.id} className={cn(isOverdue && 'bg-destructive/5')}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{purchase.item_name}</p>
                            {purchase.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-48">
                                {purchase.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{getActivityName(purchase.activity_id)}</TableCell>
                        <TableCell>{purchase.quantity} {purchase.unit}</TableCell>
                        <TableCell className="text-sm">{purchase.supplier_name || '—'}</TableCell>
                        <TableCell>
                          {purchase.estimated_cost 
                            ? purchase.estimated_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'
                          }
                        </TableCell>
                        <TableCell>{purchase.lead_time_days} dias</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{format(parseISO(purchase.required_by_date), 'dd/MM/yy')}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                {Math.abs(daysUntil!)}d atraso
                              </Badge>
                            )}
                            {isUrgent && !isOverdue && (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                {daysUntil}d
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={purchase.status} 
                            onValueChange={(value) => handleStatusChange(purchase.id, value as PurchaseStatus)}
                          >
                            <SelectTrigger className={cn('h-8 w-32', statusConfig[purchase.status].color)}>
                              <div className="flex items-center gap-1.5">
                                <StatusIcon className="h-3.5 w-3.5" />
                                <span className="text-xs">{statusConfig[purchase.status].label}</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <config.icon className="h-4 w-4" />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleOpenDialog(purchase)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(purchase.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </PageContainer>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? 'Editar Item de Compra' : 'Novo Item de Compra'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="item_name">Nome do Item *</Label>
                <Input
                  id="item_name"
                  value={formData.item_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                  placeholder="Ex: Piso porcelanato 60x60"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalhes adicionais do item"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="activity">Atividade Vinculada</Label>
                <Select 
                  value={formData.activity_id || ''} 
                  onValueChange={handleActivityChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map(activity => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {activity.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lead_time">Lead Time (dias) *</Label>
                <Input
                  id="lead_time"
                  type="number"
                  min={1}
                  value={formData.lead_time_days || 7}
                  onChange={(e) => handleLeadTimeChange(parseInt(e.target.value) || 7)}
                />
              </div>

              <div>
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={formData.quantity || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                />
              </div>

              <div>
                <Label htmlFor="unit">Unidade *</Label>
                <Select 
                  value={formData.unit || 'un'} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">Unidade (un)</SelectItem>
                    <SelectItem value="m²">Metro Quadrado (m²)</SelectItem>
                    <SelectItem value="m">Metro Linear (m)</SelectItem>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="L">Litro (L)</SelectItem>
                    <SelectItem value="cx">Caixa (cx)</SelectItem>
                    <SelectItem value="pc">Peça (pc)</SelectItem>
                    <SelectItem value="rolo">Rolo</SelectItem>
                    <SelectItem value="saco">Saco</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="estimated_cost">Custo Estimado (R$)</Label>
                <Input
                  id="estimated_cost"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.estimated_cost || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_cost: parseFloat(e.target.value) || undefined }))}
                  placeholder="0,00"
                />
              </div>

              <div>
                <Label htmlFor="required_by_date">Data Limite *</Label>
                <Input
                  id="required_by_date"
                  type="date"
                  value={formData.required_by_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, required_by_date: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="supplier_name">Fornecedor</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_name: e.target.value }))}
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div>
                <Label htmlFor="supplier_contact">Contato do Fornecedor</Label>
                <Input
                  id="supplier_contact"
                  value={formData.supplier_contact || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))}
                  placeholder="Telefone ou email"
                />
              </div>

              {editingPurchase && (
                <>
                  <div>
                    <Label htmlFor="order_date">Data do Pedido</Label>
                    <Input
                      id="order_date"
                      type="date"
                      value={formData.order_date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="expected_delivery_date">Previsão de Entrega</Label>
                    <Input
                      id="expected_delivery_date"
                      type="date"
                      value={formData.expected_delivery_date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="invoice_number">Nota Fiscal</Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                      placeholder="Número da NF"
                    />
                  </div>
                </>
              )}

              <div className="col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.item_name || !formData.required_by_date || addPurchase.isPending || updatePurchase.isPending}
            >
              {editingPurchase ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item de compra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
