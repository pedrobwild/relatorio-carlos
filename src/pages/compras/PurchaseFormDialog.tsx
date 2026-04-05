import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PurchaseInput } from '@/hooks/useProjectPurchases';
import {
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  getSubcategoriesByType,
  inferTypeFromSubcategory,
  isValidSupplierSubcategory,
} from '@/constants/supplierCategories';
import { useMemo } from 'react';

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
}

export function PurchaseFormDialog({
  open, onOpenChange, isEditing, formData, setFormData,
  activities, onActivityChange, onLeadTimeChange, onSubmit, isSubmitting,
}: PurchaseFormDialogProps) {
  // Infer the supplier type from the current category (subcategory)
  const inferredType = useMemo(() => {
    if (!formData.category) return null;
    return inferTypeFromSubcategory(formData.category);
  }, [formData.category]);

  const [selectedType, setSelectedType] = useMemo(() => {
    // We use inferredType as a derived state; no real useState needed here
    return [inferredType, () => {}] as const;
  }, [inferredType]);

  const handleTypeChange = (type: string) => {
    // When user changes the type, reset category if it doesn't belong
    if (formData.category && !isValidSupplierSubcategory(type, formData.category)) {
      setFormData(prev => ({ ...prev, category: undefined }));
    }
  };

  const handleCategoryChange = (subcategory: string) => {
    setFormData(prev => ({ ...prev, category: subcategory }));
  };

  // Determine which type is effectively selected (inferred from category, or user choice)
  const effectiveType = inferredType;
  const availableSubcategories = effectiveType ? getSubcategoriesByType(effectiveType) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Item de Compra' : 'Novo Item de Compra'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="item_name">Nome do Item *</Label>
              <Input id="item_name" value={formData.item_name || ''} onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))} placeholder="Ex: Piso porcelanato 60x60" />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" value={formData.description || ''} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Detalhes adicionais do item" rows={2} />
            </div>

            {/* Item Category (using supplier taxonomy as subcategories) */}
            <div>
              <Label htmlFor="category_type">Tipo (categoria do item)</Label>
              <Select
                value={effectiveType || ''}
                onValueChange={(v) => {
                  handleTypeChange(v);
                  // If no category set yet, just let the user pick subcategory next
                  if (!formData.category) {
                    // Set a temporary marker so subcategory select appears
                    setFormData(prev => ({ ...prev, category: undefined, _tempType: v } as any));
                  }
                }}
              >
                <SelectTrigger aria-label="Tipo de categoria do item">
                  <SelectValue placeholder="Prestador ou Produto" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {SUPPLIER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category_sub">Categoria do Item</Label>
              <Select
                value={formData.category || ''}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger aria-label="Categoria específica do item de compra">
                  <SelectValue placeholder={effectiveType || (formData as any)?._tempType ? "Selecione..." : "Escolha o tipo primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {(effectiveType
                    ? getSubcategoriesByType(effectiveType)
                    : (formData as any)?._tempType
                      ? getSubcategoriesByType((formData as any)._tempType)
                      : []
                  ).map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="activity">Atividade Vinculada</Label>
              <Select value={formData.activity_id || ''} onValueChange={onActivityChange}>
                <SelectTrigger><SelectValue placeholder="Selecione uma atividade" /></SelectTrigger>
                <SelectContent>
                  {activities.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="lead_time">Lead Time (dias) *</Label>
              <Input id="lead_time" type="number" min={1} value={formData.lead_time_days || 7} onChange={(e) => onLeadTimeChange(parseInt(e.target.value) || 7)} />
            </div>

            <div>
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input id="quantity" type="number" min={0.01} step={0.01} value={formData.quantity || 1} onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))} />
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

            <div>
              <Label htmlFor="estimated_cost">Custo Estimado (R$)</Label>
              <Input id="estimated_cost" type="number" min={0} step={0.01} value={formData.estimated_cost || ''} onChange={(e) => setFormData(prev => ({ ...prev, estimated_cost: parseFloat(e.target.value) || undefined }))} placeholder="0,00" />
            </div>

            <div>
              <Label htmlFor="required_by_date">Data Limite *</Label>
              <Input id="required_by_date" type="date" value={formData.required_by_date || ''} onChange={(e) => setFormData(prev => ({ ...prev, required_by_date: e.target.value }))} />
            </div>

            <div>
              <Label htmlFor="supplier_name">Fornecedor</Label>
              <Input id="supplier_name" value={formData.supplier_name || ''} onChange={(e) => setFormData(prev => ({ ...prev, supplier_name: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>

            <div>
              <Label htmlFor="supplier_contact">Contato do Fornecedor</Label>
              <Input id="supplier_contact" value={formData.supplier_contact || ''} onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))} placeholder="Telefone ou email" />
            </div>

            {isEditing && (
              <>
                <div>
                  <Label htmlFor="order_date">Data do Pedido</Label>
                  <Input id="order_date" type="date" value={formData.order_date || ''} onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="expected_delivery_date">Previsão de Entrega</Label>
                  <Input id="expected_delivery_date" type="date" value={formData.expected_delivery_date || ''} onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="invoice_number">Nota Fiscal</Label>
                  <Input id="invoice_number" value={formData.invoice_number || ''} onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))} placeholder="Número da NF" />
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" value={formData.notes || ''} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Observações adicionais" rows={2} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="min-h-[44px]" onClick={onSubmit} disabled={!formData.item_name || !formData.required_by_date || isSubmitting}>
            {isEditing ? 'Salvar' : 'Adicionar'}
          </Button>
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
          <AlertDialogDescription>Tem certeza que deseja excluir este item de compra? Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
