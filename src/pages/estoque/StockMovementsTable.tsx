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
import { Trash2 } from 'lucide-react';
import {
  StockMovement,
  StockMovementType,
  MOVEMENT_TYPE_LABELS,
  movementSign,
} from '@/hooks/useStockMovements';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  movements: StockMovement[];
  onDelete: (mov: StockMovement) => void;
}

const fmtNum = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

function MovementBadge({ type }: { type: StockMovementType }) {
  const sign = movementSign(type);
  const tones: Record<StockMovementType, string> = {
    entrada: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    saida: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    perda: 'bg-destructive/10 text-destructive border-destructive/30',
    sobra: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    ajuste: 'bg-muted text-foreground border-border',
  };
  return (
    <Badge variant="outline" className={cn('font-medium', tones[type])}>
      {sign} {MOVEMENT_TYPE_LABELS[type]}
    </Badge>
  );
}

export function StockMovementsTable({ movements, onDelete }: Props) {
  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma movimentação registrada ainda.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Data</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {format(parseISO(m.movement_date), 'dd/MM/yy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight">
                      {m.stock_item?.name ?? '—'}
                    </span>
                    {m.stock_item?.code && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {m.stock_item.code}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <MovementBadge type={m.movement_type} />
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums font-medium',
                    Number(m.signed_quantity) > 0 && 'text-emerald-700 dark:text-emerald-400',
                    Number(m.signed_quantity) < 0 && 'text-destructive',
                  )}
                >
                  {Number(m.signed_quantity) > 0 ? '+' : ''}
                  {fmtNum(Number(m.signed_quantity))}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    {m.stock_item?.unit}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.ambient ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.responsible ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.document_ref ?? '—'}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Excluir movimentação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação altera o saldo do item. Não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(m)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
