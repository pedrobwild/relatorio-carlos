/**
 * Kanban opcional para Compras — quatro colunas que representam o pipeline
 * canônico: pending → ordered → in_transit → delivered.
 *
 * Drag-and-drop nativo (HTML5) para evitar dependência adicional. Ao soltar
 * um card numa coluna diferente, dispara `onStatusChange(id, newStatus)` —
 * a página é responsável por interceptar (ex.: confirmação para "ordered"
 * sem etapa vinculada via `useOrderedConfirm`).
 *
 * Status fora dessas 4 colunas (awaiting_approval, approved, purchased,
 * sent_to_site, cancelled) ficam invisíveis no Kanban — gestor mais avançado
 * vai usar a aba Lista para essas transições.
 */
import { useState } from 'react';
import { Calendar, Package, Truck, CheckCircle2, Clock, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/ui-premium';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getLeadTimeRisk } from '@/lib/purchaseRisk';
import type { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';

interface PurchasesKanbanProps {
  purchases: ProjectPurchase[];
  getActivityName: (activityId: string | null) => string;
  onStatusChange: (id: string, status: PurchaseStatus) => void;
  onEdit: (purchase: ProjectPurchase) => void;
}

type KanbanStatus = Extract<PurchaseStatus, 'pending' | 'ordered' | 'in_transit' | 'delivered'>;

interface ColumnSpec {
  status: KanbanStatus;
  title: string;
  icon: React.ElementType;
  /** Classe usada pra dot da coluna (background) */
  dotClass: string;
}

const COLUMNS: ColumnSpec[] = [
  { status: 'pending', title: 'Pendente', icon: Clock, dotClass: 'bg-warning' },
  { status: 'ordered', title: 'Pedido', icon: ShoppingBag, dotClass: 'bg-primary' },
  { status: 'in_transit', title: 'Em Trânsito', icon: Truck, dotClass: 'bg-info' },
  { status: 'delivered', title: 'Entregue', icon: CheckCircle2, dotClass: 'bg-success' },
];

function fmtBR(dateISO: string | null | undefined) {
  if (!dateISO) return null;
  const d = new Date(dateISO + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

function fmtBRL(value: number | null | undefined) {
  if (value == null) return null;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface KanbanCardProps {
  purchase: ProjectPurchase;
  activityName: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
}

function KanbanCard({ purchase, activityName, onDragStart, onClick }: KanbanCardProps) {
  const risk = getLeadTimeRisk(purchase);
  const requiredFmt = fmtBR(purchase.required_by_date);
  const cost = fmtBRL(purchase.actual_cost ?? purchase.estimated_cost);
  const hasActivity = !!purchase.activity_id;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        draggable
        role="button"
        tabIndex={0}
        onDragStart={onDragStart}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          'group rounded-lg border border-border/60 bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing',
          'hover:border-primary/40 hover:shadow-md transition-all',
          'focus:outline-none focus:ring-2 focus:ring-primary/40',
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium leading-tight line-clamp-2">{purchase.item_name}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                <StatusBadge tone={risk.tone} size="sm">
                  {risk.shortLabel}
                </StatusBadge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {risk.message}
            </TooltipContent>
          </Tooltip>
        </div>

        {purchase.supplier_name && (
          <p className="text-xs text-muted-foreground truncate mb-2">{purchase.supplier_name}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {requiredFmt && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {requiredFmt}
            </span>
          )}
          {cost && (
            <span className="inline-flex items-center gap-1 tabular-nums font-medium text-foreground">
              {cost}
            </span>
          )}
        </div>

        {hasActivity ? (
          <p className="mt-2 text-[11px] text-muted-foreground/80 truncate">
            <span className="font-semibold">Etapa:</span> {activityName}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-warning truncate">Sem etapa vinculada</p>
        )}
      </div>
    </TooltipProvider>
  );
}

export function PurchasesKanban({
  purchases,
  getActivityName,
  onStatusChange,
  onEdit,
}: PurchasesKanbanProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

  const handleDragStart = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleColumnDragOver = (status: KanbanStatus) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) setDragOverColumn(status);
  };

  const handleColumnDrop = (status: KanbanStatus) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = draggedId ?? e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    setDragOverColumn(null);
    if (!id) return;

    const purchase = purchases.find((p) => p.id === id);
    if (!purchase || purchase.status === status) return;

    onStatusChange(id, status);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = purchases.filter((p) => p.status === col.status);
        const isDragOver = dragOverColumn === col.status;
        const Icon = col.icon;

        return (
          <div
            key={col.status}
            onDragOver={handleColumnDragOver(col.status)}
            onDrop={handleColumnDrop(col.status)}
            onDragEnd={handleDragEnd}
            className={cn(
              'flex flex-col rounded-xl border border-border/60 bg-muted/20 p-3 min-h-[260px]',
              'transition-colors',
              isDragOver && 'ring-2 ring-primary/40 bg-primary/5',
            )}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', col.dotClass)} aria-hidden />
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {col.title}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60 italic">
                  Arraste cards para esta coluna
                </div>
              ) : (
                items.map((purchase) => (
                  <KanbanCard
                    key={purchase.id}
                    purchase={purchase}
                    activityName={getActivityName(purchase.activity_id)}
                    onDragStart={handleDragStart(purchase.id)}
                    onClick={() => onEdit(purchase)}
                  />
                ))
              )}
            </div>

            {col.status === 'pending' && items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-muted-foreground"
                onClick={() => {
                  if (items[0]) onEdit(items[0]);
                }}
              >
                <Package className="h-3 w-3 mr-1" />
                Revisar primeiro item
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
