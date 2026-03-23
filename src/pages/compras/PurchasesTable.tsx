import { useMemo, useState } from 'react';
import { MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { statusConfig, isServiceCategory, ITEM_CATEGORIES, SERVICE_CATEGORIES } from './types';
import { ObservationsModal } from './ObservationsModal';

interface PurchasesTableProps {
  purchases: ProjectPurchase[];
  getActivityName: (id: string | null) => string;
  getDaysUntilRequired: (date: string, status: PurchaseStatus) => number | null;
  onEdit: (purchase: ProjectPurchase) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PurchaseStatus) => void;
  onAddFirst: () => void;
  onUpdateActualCost: (id: string, cost: number | null) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

const fmt = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export function PurchasesTable({
  purchases, getActivityName, getDaysUntilRequired,
  onEdit, onDelete, onStatusChange, onAddFirst,
  onUpdateActualCost, onUpdateNotes,
}: PurchasesTableProps) {
  const [obsModal, setObsModal] = useState<{ purchase: ProjectPurchase } | null>(null);

  // Group purchases by category
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectPurchase[]>();
    
    // First, add all categorized items
    for (const p of purchases) {
      const cat = p.category || 'Outros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    
    // Sort: item categories first, then services, then uncategorized
    const order = [...ITEM_CATEGORIES, ...SERVICE_CATEGORIES, 'Outros'];
    const sorted = new Map<string, ProjectPurchase[]>();
    for (const cat of order) {
      if (map.has(cat)) sorted.set(cat, map.get(cat)!);
    }
    // Add any remaining
    for (const [cat, items] of map) {
      if (!sorted.has(cat)) sorted.set(cat, items);
    }
    
    return sorted;
  }, [purchases]);

  if (purchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum item de compra encontrado</p>
          <Button variant="link" onClick={onAddFirst}>Adicionar primeiro item</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([category, items]) => {
          const isService = isServiceCategory(category);
          const categoryTotal = items.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
          const categoryActual = items.reduce((sum, p) => sum + ((p as any).actual_cost || 0), 0);
          const contracted = items.filter(p => p.status !== 'pending' && p.status !== 'cancelled').length;

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isService ? '🔧' : '📦'} {category}
                    <Badge variant="secondary" className="ml-1">{items.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Previsto: <strong className="text-foreground">{fmt(categoryTotal)}</strong></span>
                    {categoryActual > 0 && (
                      <span>Real: <strong className="text-foreground">{fmt(categoryActual)}</strong></span>
                    )}
                    {contracted > 0 && (
                      <Badge variant="outline" className="gap-1 border-green-500/30 text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> {contracted}/{items.length}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Item</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Custo Previsto</TableHead>
                      <TableHead>Custo Real</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16">Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(purchase => {
                      const config = statusConfig[purchase.status];
                      const StatusIcon = config.icon;
                      const actualCost = (purchase as any).actual_cost as number | null;

                      return (
                        <TableRow key={purchase.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{purchase.item_name}</p>
                              {purchase.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-60">{purchase.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {purchase.quantity} {purchase.unit}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {fmt(purchase.estimated_cost)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 w-28 text-sm"
                              placeholder="0,00"
                              defaultValue={actualCost ?? ''}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateActualCost(purchase.id, isNaN(val) ? null : val);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={purchase.status} onValueChange={(v) => onStatusChange(purchase.id, v as PurchaseStatus)}>
                              <SelectTrigger className={cn('h-8 w-32', config.color)}>
                                <div className="flex items-center gap-1.5">
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  <span className="text-xs">{config.label}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([key, c]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      <c.icon className="h-4 w-4" />
                                      {c.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-8 w-8',
                                purchase.notes && 'text-primary'
                              )}
                              onClick={() => setObsModal({ purchase })}
                              aria-label="Observações"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {obsModal && (
        <ObservationsModal
          open={!!obsModal}
          onOpenChange={() => setObsModal(null)}
          itemName={obsModal.purchase.item_name}
          notes={obsModal.purchase.notes || ''}
          onSave={(notes) => onUpdateNotes(obsModal.purchase.id, notes)}
        />
      )}
    </>
  );
}
