/**
 * Células editáveis e bloco de detalhe expandido da tabela de Compras.
 *
 * - `DateCell`: data com Popover + Calendar.
 * - `StatusCell`: select inline com tom semântico.
 * - `ActualCostCell`: edita custo real com Enter/Esc.
 * - `PurchaseRowDetail`: bloco expansível com categoria/fornecedor/qtde/etc.
 */
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, FileText, Package, Pencil, Truck, X } from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  calendarStatusConfig,
  CALENDAR_STATUS_OPTIONS,
  fmtCompact,
  toCalendarStatus,
  type CalendarStatus,
  type PurchaseWithProject,
} from './types';

export function DateCell({
  value,
  onSave,
  placeholder = 'Definir',
}: {
  value: string | null | undefined;
  onSave: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted whitespace-nowrap',
            !value && 'text-muted-foreground italic',
          )}
        >
          {value ? format(parseISO(value), 'dd/MM/yy') : placeholder}
          {value ? (
            <X
              className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:text-destructive transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onSave(null);
                setOpen(false);
              }}
            />
          ) : (
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[200]" align="start">
        <CalendarPicker
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onSave(format(d, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

export function StatusCell({
  purchase,
  onSave,
}: {
  purchase: PurchaseWithProject;
  onSave: (id: string, v: CalendarStatus) => void;
}) {
  const current = toCalendarStatus(purchase.status);
  const cfg = calendarStatusConfig[current];
  const Icon = cfg.icon;
  return (
    <Select value={current} onValueChange={(v) => onSave(purchase.id, v as CalendarStatus)}>
      <SelectTrigger
        className={cn(
          'h-7 min-w-[120px] w-auto text-[11px] pl-2 pr-1.5 py-0 gap-1 border rounded-full font-medium',
          '[&>span]:line-clamp-none [&>span]:flex [&>span]:items-center [&>span]:gap-1',
          '[&_svg]:opacity-70',
          cfg.color,
        )}
        aria-label={`Status: ${cfg.label}`}
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {CALENDAR_STATUS_OPTIONS.map((s) => {
          const c = calendarStatusConfig[s];
          const I = c.icon;
          return (
            <SelectItem key={s} value={s} className="text-xs">
              <span className="inline-flex items-center gap-1.5">
                <I className="h-3 w-3" />
                {c.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function ActualCostCell({
  purchase,
  onSave,
}: {
  purchase: PurchaseWithProject;
  onSave: (id: string, v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
  useEffect(() => {
    setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
  }, [purchase.actual_cost]);

  const commit = () => {
    const trimmed = value.trim().replace(',', '.');
    const num = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && (Number.isNaN(num as number) || (num as number) < 0)) {
      toast.error('Valor inválido');
      setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
      setEditing(false);
      return;
    }
    if (num !== purchase.actual_cost) onSave(purchase.id, num);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="h-7 w-24 text-xs px-2"
        />
        <Button size="icon" variant="ghost" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
            setEditing(false);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted whitespace-nowrap"
    >
      <span className={cn(purchase.actual_cost == null && 'text-muted-foreground italic')}>
        {purchase.actual_cost != null ? fmtCompact(purchase.actual_cost) : 'Informar'}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

export function PurchaseRowDetail({ p }: { p: PurchaseWithProject }) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-3 px-4 py-3 text-xs bg-muted/30 border-t max-w-screen-2xl">
        {p.category && (
          <div className="min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Package className="h-3 w-3 shrink-0" /> Categoria
            </span>
            <p className="font-medium break-words">{p.category}</p>
          </div>
        )}
        {p.supplier_name && (
          <div className="min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Truck className="h-3 w-3 shrink-0" /> Fornecedor
            </span>
            <p className="font-medium break-words">{p.supplier_name}</p>
          </div>
        )}
        {p.quantity && (
          <div className="min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Package className="h-3 w-3 shrink-0" /> Qtde / Unidade
            </span>
            <p className="font-medium">
              {p.quantity}
              {p.unit ? ` ${p.unit}` : ''}
            </p>
          </div>
        )}
        {p.delivery_address && (
          <div className="min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Truck className="h-3 w-3 shrink-0" /> Entrega
            </span>
            <p className="font-medium break-words">{p.delivery_address}</p>
          </div>
        )}
        {p.description && (
          <div className="col-span-full min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <FileText className="h-3 w-3 shrink-0" /> Descrição
            </span>
            <p className="text-foreground leading-snug break-words">{p.description}</p>
          </div>
        )}
        {p.notes && (
          <div className="col-span-full min-w-0">
            <span className="text-muted-foreground mb-0.5 block">Observações</span>
            <p className="text-foreground leading-snug break-words">{p.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
