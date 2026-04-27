import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  StockCategory,
  StockItem,
  STOCK_CATEGORIES,
  STOCK_CATEGORY_LABELS,
  STOCK_UNITS,
} from '@/hooks/useStockItems';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  initial?: StockItem | null;
  onSubmit: (data: {
    project_id: string;
    code?: string | null;
    name: string;
    description?: string | null;
    category: StockCategory;
    unit: string;
    minimum_stock: number;
    unit_cost?: number | null;
    default_location?: string | null;
    supplier_name?: string | null;
    supplier_contact?: string | null;
    lead_time_days?: number;
    notes?: string | null;
  }) => Promise<void> | void;
}

export function StockItemDialog({ open, onOpenChange, projectId, initial, onSubmit }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockCategory>('outros');
  const [unit, setUnit] = useState('un');
  const [minimumStock, setMinimumStock] = useState('0');
  const [unitCost, setUnitCost] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('0');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? '');
      setName(initial?.name ?? '');
      setCategory((initial?.category as StockCategory) ?? 'outros');
      setUnit(initial?.unit ?? 'un');
      setMinimumStock(String(initial?.minimum_stock ?? 0));
      setUnitCost(initial?.unit_cost != null ? String(initial.unit_cost) : '');
      setDefaultLocation(initial?.default_location ?? '');
      setSupplierName(initial?.supplier_name ?? '');
      setSupplierContact(initial?.supplier_contact ?? '');
      setLeadTimeDays(String(initial?.lead_time_days ?? 0));
      setDescription(initial?.description ?? '');
      setNotes(initial?.notes ?? '');
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        project_id: projectId,
        code: code.trim() || null,
        name: name.trim(),
        description: description.trim() || null,
        category,
        unit,
        minimum_stock: Number(minimumStock) || 0,
        unit_cost: unitCost ? Number(unitCost) : null,
        default_location: defaultLocation.trim() || null,
        supplier_name: supplierName.trim() || null,
        supplier_contact: supplierContact.trim() || null,
        lead_time_days: Number(leadTimeDays) || 0,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar item' : 'Novo item de estoque'}</DialogTitle>
          <DialogDescription>
            Cadastre o material com unidade, estoque mínimo e fornecedor de referência.
            O saldo é atualizado automaticamente pelas movimentações.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                placeholder="REV-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Item *</Label>
              <Input
                id="name"
                required
                placeholder="Porcelanato 90x90"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as StockCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STOCK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {STOCK_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STOCK_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Estoque mínimo</Label>
              <Input
                id="min"
                type="number"
                min={0}
                step="0.001"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Custo unitário (R$)</Label>
              <Input
                id="cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead">Prazo de compra (dias)</Label>
              <Input
                id="lead"
                type="number"
                min={0}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc">Local padrão</Label>
              <Input
                id="loc"
                placeholder="Depósito / Obra"
                value={defaultLocation}
                onChange={(e) => setDefaultLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Fornecedor</Label>
              <Input
                id="supplier"
                placeholder="Nome do fornecedor"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">Contato</Label>
              <Input
                id="contact"
                placeholder="Telefone / e-mail"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea
              id="desc"
              rows={2}
              placeholder="Especificação técnica, marca, referência..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Notas internas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {initial ? 'Salvar alterações' : 'Cadastrar item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
