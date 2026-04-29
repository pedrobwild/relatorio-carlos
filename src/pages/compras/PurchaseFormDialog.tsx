import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PurchaseInput, PurchaseType } from '@/hooks/useProjectPurchases';
import { getSubcategoriesByType } from '@/constants/supplierCategories';
import { useMemo } from 'react';
import { PURCHASE_TYPE_LABELS, purchaseTypeToSupplierType } from './types';
import { PaymentScheduleSection, type PaymentInstallment } from './PaymentScheduleSection';
import { FornecedorSelector } from './FornecedorSelector';
import { QuickCreateFornecedor } from './QuickCreateFornecedor';
import { safeParseInt, trackBlock1CUsage } from '@/lib/block1cMonitor';
import { AutosaveIndicator } from '@/components/ui/AutosaveIndicator';
import { PurchaseAttachmentsField } from './PurchaseAttachmentsField';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Activity {
  id: string;
  description: string;
  planned_start: string;
}

interface PurchaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: Partial<PurchaseInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<PurchaseInput>>>;
  activities: Activity[];
  onActivityChange: (activityId: string) => void;
  onLeadTimeChange: (leadTime: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  paymentInstallments: PaymentInstallment[];
  onPaymentInstallmentsChange: (installments: PaymentInstallment[]) => void;
  editingPurchaseId?: string;
  /** When the form was last autosaved as a draft (only applies to new purchases). */
  draftLastSavedAt?: Date | null;
}

export function PurchaseFormDialog({
  open, onOpenChange, isEditing, formData, setFormData,
  activities, onActivityChange, onLeadTimeChange, onSubmit, isSubmitting,
  paymentInstallments, onPaymentInstallmentsChange, editingPurchaseId,
  draftLastSavedAt,
}: PurchaseFormDialogProps) {
  const purchaseType = formData.purchase_type || 'produto';
  const isPrestador = purchaseType === 'prestador';

  const supplierType = purchaseTypeToSupplierType(purchaseType);
  const availableSubcategories = useMemo(
    () => supplierType ? getSubcategoriesByType(supplierType) : [],
    [supplierType]
  );

  const handleTypeChange = (type: PurchaseType) => {
    setFormData(prev => ({
      ...prev,
      purchase_type: type,
      category: undefined, // reset subcategory when type changes
      // Clear type-specific fields
      ...(type === 'produto'
        ? { start_date: undefined, end_date: undefined }
        : { delivery_address: undefined }
      ),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar' : 'Novo'} {isPrestador ? 'Prestador' : 'Produto'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Purchase Type Selector */}
            <div className="col-span-2">
              <Label>Tipo *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['produto', 'prestador'] as PurchaseType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                      purchaseType === type
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <span className="text-xl">{type === 'produto' ? '📦' : '🔧'}</span>
                    <div>
                      <p className="font-medium text-sm">{PURCHASE_TYPE_LABELS[type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {type === 'produto' ? 'Material ou equipamento' : 'Serviço de mão de obra'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Item Name + Marca (opcional, lado a lado) */}
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
              <div>
                <Label htmlFor="item_name">{isPrestador ? 'Nome do Serviço' : 'Nome do Produto'} *</Label>
                <Input
                  id="item_name"
                  value={formData.item_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                  placeholder={isPrestador ? 'Ex: Instalação de piso' : 'Ex: Piso porcelanato 60x60'}
                />
              </div>
              {!isPrestador && (
                <div>
                  <Label htmlFor="brand">
                    Marca <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </Label>
                  <Input
                    id="brand"
                    value={formData.brand || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ex: Portobello, Tigre…"
                  />
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes adicionais"
                rows={2}
              />
            </div>

            {/* Category (subcategory from taxonomy) */}
            <div>
              <Label>Categoria</Label>
              <Select
                value={formData.category || ''}
                onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger aria-label="Categoria">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSubcategories.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activity */}
            <div>
              <Label>Atividade Vinculada</Label>
              <Select value={formData.activity_id || ''} onValueChange={onActivityChange}>
                <SelectTrigger><SelectValue placeholder="Selecione uma atividade" /></SelectTrigger>
                <SelectContent>
                  {activities.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Lead Time */}
            <div>
              <Label htmlFor="lead_time">
                {isPrestador ? 'Antecedência contratação (dias)' : 'Lead Time (dias)'} *
              </Label>
              <Input
                id="lead_time"
                type="number"
                min={1}
                value={formData.lead_time_days || 7}
                onChange={(e) => {
                  const parsed = safeParseInt(e.target.value, {
                    area: 'lead-time',
                    context: 'PurchaseFormDialog',
                    fallback: 7,
                  });
                  trackBlock1CUsage('lead-time', { parsed });
                  onLeadTimeChange(parsed);
                }}
              />
            </div>

            {/* Required by date */}
            <div>
              <Label htmlFor="required_by_date">
                {isPrestador ? 'Data início do serviço' : 'Data necessária na obra'} *
              </Label>
              <Input
                id="required_by_date"
                type="date"
                value={formData.required_by_date || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, required_by_date: e.target.value }))}
              />
            </div>

            {/* Prestador-specific: fornecedor selector + service period */}
            {isPrestador && (
              <>
                <FornecedorSelector
                  fornecedorId={formData.fornecedor_id || undefined}
                  onFornecedorChange={(id, nome) => setFormData(prev => ({
                    ...prev,
                    fornecedor_id: id,
                    supplier_name: nome,
                  }))}
                  startDate={formData.start_date || formData.required_by_date || ''}
                  endDate={formData.end_date || ''}
                  currentPurchaseId={editingPurchaseId}
                />
                <div>
                  <Label htmlFor="start_date">Início execução na obra *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date || formData.required_by_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">Fim execução na obra *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </>
            )}

            {/* Produto-specific: delivery address */}
            {!isPrestador && (
              <div className="col-span-2">
                <Label htmlFor="delivery_address">Endereço de entrega</Label>
                <Input
                  id="delivery_address"
                  value={formData.delivery_address || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                  placeholder="Endereço completo para entrega do produto"
                />
              </div>
            )}

            {/* Common fields */}
            {!isPrestador && (
              <>
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
                  <Select value={formData.unit || 'un'} onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
              </>
            )}

            {/* Cost fields */}
            <div>
              <Label htmlFor="estimated_cost">
                {isPrestador ? 'Custo Orçamento (R$)' : 'Custo Estimado (R$)'}
              </Label>
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
              <Label htmlFor="actual_cost">Custo Real (R$)</Label>
              <Input
                id="actual_cost"
                type="number"
                min={0}
                step={0.01}
                value={formData.actual_cost || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, actual_cost: parseFloat(e.target.value) || undefined }))}
                placeholder="0,00"
              />
            </div>

            {/* Cost difference indicator */}
            {(formData.estimated_cost || 0) > 0 && (formData.actual_cost || 0) > 0 && (() => {
              const est = formData.estimated_cost || 0;
              const act = formData.actual_cost || 0;
              const diff = act - est;
              if (diff === 0) return null;
              const pct = est > 0 ? ((diff / est) * 100) : 0;
              const isOver = diff > 0;
              const sign = isOver ? '+' : '';
              const arrow = isOver ? '↑' : '↓';
              return (
                <div className="col-span-2">
                  <div className={cn(
                    'flex items-center gap-2 text-xs font-medium rounded-md px-3 py-2',
                    isOver ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'
                  )}>
                    <span>{arrow} Diferença: {sign}{est > 0 ? fmt(diff) : '—'}</span>
                    <span className="opacity-70">({sign}{pct.toFixed(1)}%)</span>
                    <span className="ml-auto text-xs opacity-60">
                      {isOver ? 'Acima do orçamento' : 'Economia'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {!isPrestador && (
              <>
                <div>
                  <Label htmlFor="supplier_name">Fornecedor</Label>
                  <div className="flex gap-2 items-start">
                    <Input
                      id="supplier_name"
                      value={formData.supplier_name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier_name: e.target.value }))}
                      placeholder="Nome do fornecedor"
                    />
                    <QuickCreateFornecedor
                      supplierType="produtos"
                      defaultName={formData.supplier_name || ''}
                      onCreated={(_id, nome) => setFormData(prev => ({ ...prev, supplier_name: nome }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="supplier_contact">Contato</Label>
                  <Input
                    id="supplier_contact"
                    value={formData.supplier_contact || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))}
                    placeholder="Telefone ou email"
                  />
                </div>
              </>
            )}

            {isPrestador && (
              <div className="col-span-2">
                <Label htmlFor="supplier_contact">Contato do Prestador</Label>
                <Input
                  id="supplier_contact"
                  value={formData.supplier_contact || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))}
                  placeholder="Telefone ou email"
                />
              </div>
            )}

            {isEditing && (
              <>
                <div>
                  <Label htmlFor="order_date">
                    {isPrestador ? 'Data da Contratação' : 'Data do Pedido'}
                  </Label>
                  <Input
                    id="order_date"
                    type="date"
                    value={formData.order_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
                  />
                </div>
                {!isPrestador && (
                  <div>
                    <Label htmlFor="expected_delivery_date">Previsão de Entrega</Label>
                    <Input
                      id="expected_delivery_date"
                      type="date"
                      value={formData.expected_delivery_date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                    />
                  </div>
                )}
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

            {/* Payment Schedule for Prestadores */}
            {isPrestador && (formData.estimated_cost || 0) > 0 && (
              <PaymentScheduleSection
                totalValue={formData.estimated_cost || 0}
                startDate={formData.start_date || formData.required_by_date || ''}
                endDate={formData.end_date || ''}
                installments={paymentInstallments}
                onChange={onPaymentInstallmentsChange}
              />
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

        <DialogFooter className="gap-2 sm:justify-between">
          {!isEditing ? (
            <AutosaveIndicator lastSavedAt={draftLastSavedAt ?? null} className="self-center" />
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              className="min-h-[44px]"
              onClick={onSubmit}
              disabled={!formData.item_name || !formData.required_by_date || isSubmitting}
            >
              {isEditing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeletePurchaseDialogProps {
  open: boolean;
  onOpenChange: () => void;
  onDelete: () => void;
}

export function DeletePurchaseDialog({ open, onOpenChange, onDelete }: DeletePurchaseDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
