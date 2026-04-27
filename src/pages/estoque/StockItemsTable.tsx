import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Plus, Trash2, Archive, ArrowDownToLine } from 'lucide-react';
import { StockItem, STOCK_CATEGORY_LABELS } from '@/hooks/useStockItems';
import { cn } from '@/lib/utils';

interface Props {
  items: StockItem[];
  onEdit: (item: StockItem) => void;
  onMove: (item: StockItem) => void;
  onArchive: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  onAdd: () => void;
}

const fmt = (v: number | null | undefined, digits = 2) =>
  (v ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const fmtMoney = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function StatusBadge({ item }: { item: StockItem }) {
  if (item.status === 'sem_estoque') {
    return <Badge variant="destructive">Sem estoque</Badge>;
  }
  if (item.status === 'comprar') {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white">
        Comprar
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
      OK
    </Badge>
  );
}

export function StockItemsTable({ items, onEdit, onMove, onArchive, onDelete, onAdd }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Nenhum item cadastrado. Comece pelo cadastro do material.
        </p>
        <Button onClick={onAdd} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Cadastrar item
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Código</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Custo unit.</TableHead>
              <TableHead className="text-right">Valor em estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => {
              const lowStock = it.status !== 'ok';
              return (
                <TableRow key={it.id} className={cn(lowStock && 'bg-amber-50/40 dark:bg-amber-500/[0.03]')}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {it.code ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium leading-tight">{it.name}</span>
                      {it.default_location && (
                        <span className="text-[11px] text-muted-foreground">
                          {it.default_location}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {STOCK_CATEGORY_LABELS[it.category] ?? it.category}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmt(it.current_stock, 3)}{' '}
                    <span className="text-muted-foreground text-xs">{it.unit}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt(it.minimum_stock, 3)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {it.unit_cost != null ? fmtMoney(it.unit_cost) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(it.stock_value)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge item={it} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onMove(it)}>
                          <ArrowDownToLine className="h-4 w-4 mr-2" />
                          Movimentar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(it)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onArchive(it)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Arquivar
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove o item e todas as movimentações vinculadas. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onDelete(it)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
