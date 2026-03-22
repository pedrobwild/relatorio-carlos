import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { statusConfig } from './types';

interface PurchasesTableProps {
  purchases: ProjectPurchase[];
  getActivityName: (id: string | null) => string;
  getDaysUntilRequired: (date: string, status: PurchaseStatus) => number | null;
  onEdit: (purchase: ProjectPurchase) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PurchaseStatus) => void;
  onAddFirst: () => void;
}

export function PurchasesTable({
  purchases, getActivityName, getDaysUntilRequired,
  onEdit, onDelete, onStatusChange, onAddFirst,
}: PurchasesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Itens de Compra ({purchases.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum item de compra encontrado</p>
            <Button variant="link" onClick={onAddFirst}>Adicionar primeiro item</Button>
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
              {purchases.map(purchase => {
                const config = statusConfig[purchase.status];
                const StatusIcon = config.icon;
                const daysUntil = getDaysUntilRequired(purchase.required_by_date, purchase.status);
                const isOverdue = daysUntil !== null && daysUntil < 0;
                const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;

                return (
                  <TableRow key={purchase.id} className={cn(isOverdue && 'bg-destructive/5')}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{purchase.item_name}</p>
                        {purchase.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-48">{purchase.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{getActivityName(purchase.activity_id)}</TableCell>
                    <TableCell>{purchase.quantity} {purchase.unit}</TableCell>
                    <TableCell className="text-sm">{purchase.supplier_name || '—'}</TableCell>
                    <TableCell>
                      {purchase.estimated_cost
                        ? purchase.estimated_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </TableCell>
                    <TableCell>{purchase.lead_time_days} dias</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{format(parseISO(purchase.required_by_date), 'dd/MM/yy')}</span>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">{Math.abs(daysUntil!)}d atraso</Badge>
                        )}
                        {isUrgent && !isOverdue && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">{daysUntil}d</Badge>
                        )}
                      </div>
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px]" onClick={() => onEdit(purchase)} aria-label="Editar item">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive" onClick={() => onDelete(purchase.id)} aria-label="Excluir item">
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
  );
}
