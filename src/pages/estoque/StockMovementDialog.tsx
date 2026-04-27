import { useEffect, useState, useMemo } from 'react';
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
import { StockItem } from '@/hooks/useStockItems';
import { StockMovementType, MOVEMENT_TYPE_LABELS } from '@/hooks/useStockMovements';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  items: StockItem[];
  initialItemId?: string | null;
  onSubmit: (data: {
    project_id: string;
    stock_item_id: string;
    movement_type: StockMovementType;
    movement_date: string;
    quantity: number;
    unit_cost?: number | null;
    ambient?: string | null;
    responsible?: string | null;
    document_ref?: string | null;
    cause?: string | null;
    preventive_action?: string | null;
    notes?: string | null;
  }) => Promise<void> | void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function StockMovementDialog({
  open,
  onOpenChange,
  projectId,
  items,
  initialItemId,
  onSubmit,
}: Props) {
  const [stockItemId, setStockItemId] = useState<string>('');
  const [movementType, setMovementType] = useState<StockMovementType>('saida');
  const [movementDate, setMovementDate] = useState<string>(today());
  const [quantity, setQuantity] = useState<string>('1');
  const [ambient, setAmbient] = useState<string>('');
  const [responsible, setResponsible] = useState<string>('');
  const [documentRef, setDocumentRef] = useState<string>('');
  const [cause, setCause] = useState<string>('');
  const [preventive, setPreventive] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStockItemId(initialItemId ?? items[0]?.id ?? '');
      setMovementType('saida');
      setMovementDate(today());
      setQuantity('1');
      setAmbient('');
      setResponsible('');
      setDocumentRef('');
      setCause('');
      setPreventive('');
      setNotes('');
      setUnitCost('');
    }
  }, [open, initialItemId, items]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === stockItemId),
    [items, stockItemId],
  );

  const isLossOrSurplus = movementType === 'perda' || movementType === 'sobra';
  const isExit = movementType === 'saida' || movementType === 'perda';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockItemId || !quantity) return;
    const qty = Number(quantity);
    if (!(qty > 0)) return;
    setSubmitting(true);
    try {
      await onSubmit({
        project_id: projectId,
        stock_item_id: stockItemId,
        movement_type: movementType,
        movement_date: movementDate,
        quantity: qty,
        unit_cost: unitCost ? Number(unitCost) : null,
        ambient: ambient.trim() || null,
        responsible: responsible.trim() || null,
        document_ref: documentRef.trim() || null,
        cause: cause.trim() || null,
        preventive_action: preventive.trim() || null,
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
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>
            Registre entradas (compras), saídas (consumo), perdas, sobras ou ajustes de inventário.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Item *</Label>
              <Select value={stockItemId} onValueChange={setStockItemId}>
                <SelectTrigger><SelectValue placeholder="Selecione um item" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.code ? `${i.code} · ` : ''}{i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-[11px] text-muted-foreground">
                  Saldo atual: <span className="font-medium tabular-nums">
                    {Number(selectedItem.current_stock).toLocaleString('pt-BR')}
                  </span>{' '}{selectedItem.unit}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as StockMovementType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[]).map((t) => (
                    <SelectItem key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantidade *</Label>
              <Input
                id="qty"
                type="number"
                min="0.001"
                step="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                required
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ucost">Custo unit. (R$)</Label>
              <Input
                id="ucost"
                type="number"
                min={0}
                step="0.01"
                placeholder="opcional"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amb">Ambiente</Label>
              <Input
                id="amb"
                placeholder="Banheiro, Cozinha..."
                value={ambient}
                onChange={(e) => setAmbient(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resp">Responsável</Label>
              <Input
                id="resp"
                placeholder="Nome ou equipe"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc">Documento</Label>
              <Input
                id="doc"
                placeholder="NF 123, RDO 05..."
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
              />
            </div>
          </div>

          {isLossOrSurplus && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t">
              <div className="space-y-1.5">
                <Label htmlFor="cause">Causa</Label>
                <Input
                  id="cause"
                  placeholder="Quebra no corte, compra com margem..."
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prev">Ação preventiva</Label>
                <Input
                  id="prev"
                  placeholder="Conferir paginação antes..."
                  value={preventive}
                  onChange={(e) => setPreventive(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Detalhes adicionais"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {isExit && selectedItem && Number(quantity) > Number(selectedItem.current_stock) && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-500/[0.05] p-3 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Atenção: saída maior que o saldo atual
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                O saldo deste item ficará negativo. Confirme se a quantidade está correta.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !stockItemId || !(Number(quantity) > 0)}>
              Registrar movimentação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
