import { Fragment, useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths, isWeekend, addDays, isValid,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar, Check, X, Pencil, CalendarIcon,
  FilterX, Plus, ChevronDown, ChevronUp, ExternalLink, Package,
  FileText, Truck, ArrowUpDown, MoreHorizontal, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageSkeleton } from '@/components/ui-premium';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ProjectPurchase } from '@/hooks/useProjectPurchases';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { Clock, ThumbsUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PaymentSection } from '@/pages/compras/PaymentSection';
import { parseFlexibleBRDate, parseLocalDate } from '@/lib/dates';
import { addBusinessDays } from '@/lib/businessDays';
import {
  PurchaseAttachmentsField,
  uploadPendingAttachments,
  type PendingAttachment,
} from '@/pages/compras/PurchaseAttachmentsField';

/**
 * Recalcula a data prevista de entrega como N dias úteis após a data âncora.
 * - `anchorISO`: data base no formato `YYYY-MM-DD` (ex.: payment_due_date) ou
 *   timestamptz (ex.: paid_at). Em ambos casos extraímos a parte de data
 *   no fuso local do navegador para preservar o dia-calendário.
 * - `leadDays`: prazo do fornecedor em dias úteis (pula fins de semana e
 *   feriados de SP via `addBusinessDays`).
 * Retorna `null` se a entrada for inválida.
 */
function calcExpectedDelivery(anchorISO: string | null | undefined, leadDays: number | null | undefined): string | null {
  if (!anchorISO) return null;
  const lead = Math.max(0, Number(leadDays ?? 7) || 0);
  // Aceita 'YYYY-MM-DD' (date) e 'YYYY-MM-DDTHH:mm:ss...' (timestamptz)
  const datePart = anchorISO.slice(0, 10);
  const anchor = parseLocalDate(datePart);
  if (Number.isNaN(anchor.getTime())) return null;
  const result = addBusinessDays(anchor, lead);
  const y = result.getFullYear();
  const m = String(result.getMonth() + 1).padStart(2, '0');
  const d = String(result.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Campos `date` da tabela `project_purchases` que aceitam edição livre via
 * `handleUpdateField`. Usados como camada de defesa: qualquer valor que
 * chegue por estes campos é normalizado por `parseFlexibleBRDate` antes de
 * ir ao banco. Mantenha em sincronia com o schema do Supabase.
 */
const PURCHASE_DATE_FIELDS = [
  'required_by_date',
  'planned_purchase_date',
  'order_date',
  'expected_delivery_date',
  'actual_delivery_date',
  'start_date',
  'end_date',
  'stock_entry_date',
  'stock_exit_date',
  'payment_due_date',
] as const;

/**
 * Payload tipado para INSERT em `project_purchases`.
 * Deriva diretamente do schema gerado pelo Supabase, garantindo que qualquer
 * mudança de coluna (NOT NULL, novo campo, etc.) seja refletida em tempo de build.
 *
 * Uso:
 *   const payload: ProjectPurchaseInsert = { project_id, item_name, created_by, required_by_date, ... };
 *   await supabase.from('project_purchases').insert(payload);
 */
export type ProjectPurchaseInsert = TablesInsert<'project_purchases'>;

interface PurchaseWithProject extends Omit<ProjectPurchase, 'created_at'> {
  project_name: string;
  customer_name: string | null;
  /**
   * Override defensivo: embora a coluna `created_at` seja NOT NULL no banco,
   * registros antigos sincronizados ou casos de borda podem chegar sem o campo.
   * Tratamos como opcional/nulo para forçar o uso do helper `fmtRequestedDate`,
   * que já retorna "—" para null/undefined/strings inválidas.
   */
  created_at?: string | null;
}

type CalendarStatus = 'pending' | 'approved' | 'delivered' | 'paid' | 'partial' | 'delayed';

/**
 * Tons das badges de status — usam variantes claras + escuras com `dark:` para
 * manter contraste AA tanto em light quanto em dark mode. Usar tokens semânticos
 * resolveria de forma mais limpa, mas mantemos a paleta cromática (amber/blue/
 * emerald/red) para preservar o reconhecimento visual já consolidado em outras
 * telas (Compras, Painel de Obras).
 */
const calendarStatusConfig: Record<CalendarStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Pendente',     color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',           icon: Clock },
  approved:  { label: 'Aprovado',     color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40',                 icon: ThumbsUp },
  delivered: { label: 'Entregue',     color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40', icon: CheckCircle2 },
  paid:      { label: 'Pago',         color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/40',                 icon: CheckCircle2 },
  partial:   { label: 'Pago Parcial', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/40',                 icon: Clock },
  delayed:   { label: 'Atrasado',     color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',                       icon: AlertTriangle },
};

const CALENDAR_STATUS_OPTIONS: CalendarStatus[] = ['pending', 'approved', 'delivered', 'partial', 'paid', 'delayed'];

export interface PaidAggregate {
  paidSum: number;
  firstPaidAt: string | null;
  hasInstallments: boolean;
}

/**
 * Mapeia o estado bruto da compra para o status simplificado do calendário.
 * Precedência:
 *   1. `partial` se houve pagamento (paid_at) e o valor pago < total da compra.
 *   2. `paid` se há paid_at sem condição de parcial atendida.
 *   3. status logístico (approved/delivered/delayed/pending).
 */
function toCalendarStatus(
  s: string | null | undefined,
  paidAt?: string | null,
  paidSum?: number | null,
  total?: number | null,
): CalendarStatus {
  const sum = Number(paidSum ?? 0);
  const tot = Number(total ?? 0);
  if (paidAt && tot > 0 && sum > 0 && sum < tot) return 'partial';
  if (paidAt) return 'paid';
  if (s === 'approved' || s === 'awaiting_approval' || s === 'purchased' || s === 'ordered' || s === 'in_transit') return 'approved';
  if (s === 'delivered' || s === 'sent_to_site') return 'delivered';
  if (s === 'delayed') return 'delayed';
  return 'pending';
}

// ─── DateCell ────────────────────────────────────────────────────────────────
function DateCell({
  value, onSave, placeholder = 'Definir',
}: { value: string | null | undefined; onSave: (v: string | null) => void; placeholder?: string }) {
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
            <X className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:text-destructive transition-opacity"
              onClick={(e) => { e.stopPropagation(); onSave(null); setOpen(false); }} />
          ) : (
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[200]" align="start">
        <CalendarPicker
          mode="single"
          selected={selected}
          onSelect={(d) => { if (d) { onSave(format(d, 'yyyy-MM-dd')); setOpen(false); } }}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── StatusCell ───────────────────────────────────────────────────────────────
function StatusCell({
  purchase,
  onSave,
}: {
  purchase: PurchaseWithProject;
  /** Quando `value === 'paid'`, `paidDate` traz a data escolhida pelo usuário (YYYY-MM-DD). */
  onSave: (id: string, v: CalendarStatus, paidDate?: string) => void;
}) {
  const current = toCalendarStatus(purchase.status, (purchase as any).paid_at);
  const cfg = calendarStatusConfig[current];
  const Icon = cfg.icon;

  // Controle do popover de seleção de data ao marcar como Pago.
  const [paidPickerOpen, setPaidPickerOpen] = useState(false);
  const initialPaid = (purchase as any).paid_at
    ? parseISO(((purchase as any).paid_at as string).slice(0, 10))
    : new Date();
  const [paidDate, setPaidDate] = useState<Date>(initialPaid);

  const handleChange = (v: string) => {
    if (v === 'paid') {
      // Default = hoje (ou data atual já registrada, se houver). Abre o picker
      // para o usuário confirmar/alterar antes de gravar.
      setPaidDate((purchase as any).paid_at
        ? parseISO(((purchase as any).paid_at as string).slice(0, 10))
        : new Date());
      setPaidPickerOpen(true);
      return;
    }
    onSave(purchase.id, v as CalendarStatus);
  };

  const confirmPaid = () => {
    onSave(purchase.id, 'paid', format(paidDate, 'yyyy-MM-dd'));
    setPaidPickerOpen(false);
  };

  return (
    <>
      <Select value={current} onValueChange={handleChange}>
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
                <span className="inline-flex items-center gap-1.5"><I className="h-3 w-3" />{c.label}</span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Dialog open={paidPickerOpen} onOpenChange={setPaidPickerOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Data do pagamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground self-start">
              Selecione a data em que o pagamento foi efetivamente realizado.
            </p>
            <CalendarPicker
              mode="single"
              selected={paidDate}
              onSelect={(d) => d && setPaidDate(d)}
              locale={ptBR}
              initialFocus
              disabled={(d) => d > new Date()}
              className="p-3 pointer-events-auto"
            />
            <p className="text-sm font-medium self-start">
              {format(paidDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaidPickerOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPaid}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── ActualCostCell ───────────────────────────────────────────────────────────
const fmtCompact = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';
const fmt = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDiff = (v: number) => {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return `${sign}${abs}`;
};

/**
 * Formata `created_at` (ISO UTC vindo do Supabase, ex: "2025-04-26T03:10:00+00:00")
 * sempre como `dd/MM/yyyy` no fuso horário LOCAL do navegador.
 *
 * - `parseISO` interpreta corretamente o offset `Z`/`+00:00`, evitando o bug clássico
 *   de `new Date("2025-04-26")` que assumiria UTC e poderia exibir 25/04 em -03:00.
 * - Retorna "—" para null/undefined/string inválida (defensivo contra dados antigos).
 */
const fmtRequestedDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return '—';
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
};

function ActualCostCell({ purchase, onSave }: { purchase: PurchaseWithProject; onSave: (id: string, v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
  useEffect(() => { setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : ''); }, [purchase.actual_cost]);
  const commit = () => {
    const trimmed = value.trim().replace(',', '.');
    const num = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && (isNaN(num as number) || (num as number) < 0)) {
      toast.error('Valor inválido'); setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : ''); setEditing(false); return;
    }
    if (num !== purchase.actual_cost) onSave(purchase.id, num);
    setEditing(false);
  };
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input autoFocus type="number" step="0.01" min="0" inputMode="decimal" value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : ''); setEditing(false); } }}
          onBlur={commit} className="h-7 w-24 text-xs px-2" />
        <Button size="icon" variant="ghost" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={commit}><Check className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={() => { setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : ''); setEditing(false); }}><X className="h-3 w-3" /></Button>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted whitespace-nowrap">
      <span className={cn(purchase.actual_cost == null && 'text-muted-foreground italic')}>
        {purchase.actual_cost != null ? fmtCompact(purchase.actual_cost) : 'Informar'}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ─── Indicadores de PIX / Boleto preenchidos ──────────────────────────────────
/**
 * Mostra dois micro-badges discretos quando a linha já possui dados de pagamento
 * (chave PIX ou boleto anexado/código). Mantém alta densidade da tabela usando
 * iniciais e tons semânticos do design system.
 */
function PaymentInfoBadges({ p }: { p: PurchaseWithProject }) {
  const hasPix = !!(p as any).pix_key && String((p as any).pix_key).trim() !== '';
  const hasBoleto =
    !!(p as any).boleto_file_path || (!!(p as any).boleto_code && String((p as any).boleto_code).trim() !== '');

  if (!hasPix && !hasBoleto) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-1 align-middle">
      {hasPix && (
        <span
          title="Chave PIX preenchida"
          aria-label="Chave PIX preenchida"
          className="inline-flex items-center justify-center h-4 px-1 rounded text-[9px] font-semibold bg-success/15 text-success border border-success/25"
        >
          PIX
        </span>
      )}
      {hasBoleto && (
        <span
          title={(p as any).boleto_file_path ? 'Boleto anexado' : 'Código do boleto preenchido'}
          aria-label="Boleto preenchido"
          className="inline-flex items-center justify-center h-4 px-1 rounded text-[9px] font-semibold bg-info/15 text-info border border-info/25"
        >
          BOL
        </span>
      )}
    </span>
  );
}

// ─── Expandable row details ───────────────────────────────────────────────────
function PurchaseRowDetail({
  p,
  onUpdateField,
}: {
  p: PurchaseWithProject;
  onUpdateField: (id: string, field: string, value: string | null) => void;
}) {
  return (
    // O detalhe ocupa naturalmente a largura da célula colSpan. Em telas largas
    // a tabela já é responsiva (sem scroll-x); em telas estreitas, o scroll
    // horizontal da própria tabela leva o detail row junto, mantendo alinhamento.
    // `max-w-screen-2xl` evita expansão visual exagerada quando há poucas colunas.
    <div className="w-full">
      <div className="px-4 py-3 bg-muted/30 border-t max-w-screen-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-3 text-xs">
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
              <p className="font-medium">{p.quantity}{p.unit ? ` ${p.unit}` : ''}</p>
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

        {/* Pagamento — vencimento, forma e campos condicionais (PIX / Boleto) */}
        {/* Cast: `PurchaseWithProject` torna `created_at` opcional/nullable para tolerar
            registros legados, mas `PaymentSection` espera o tipo canônico do hook. */}
        <PaymentSection purchase={p as unknown as ProjectPurchase} onUpdateField={onUpdateField} />
      </div>
    </div>
  );
}

// ─── New Purchase Dialog ──────────────────────────────────────────────────────
interface NewPurchaseForm {
  project_id: string;
  item_name: string;
  /** Marca do material — opcional. */
  brand: string;
  category: string;
  supplier_name: string;
  estimated_cost: string;
  planned_purchase_date: Date | undefined;
  quantity: string;
  unit: string;
  description: string;
  notes: string;
  /** Linha digitável / código do boleto. Salvo em `boleto_code`. */
  boleto_code: string;
  /** Data de vencimento do boleto. Salvo em `payment_due_date`. */
  payment_due_date: Date | undefined;
  /** Local de entrega: 'escritorio' | 'obra' | 'retirada'. Salvo em `delivery_location`. */
  delivery_location: 'escritorio' | 'obra' | 'retirada' | '';
  /** Endereço completo de entrega. Salvo em `delivery_address`. */
  delivery_address: string;
}

/** Endereço fixo do escritório BWild — usado quando `delivery_location === 'escritorio'`. */
const ESCRITORIO_ADDRESS = 'Rua Álvaro Rodrigues, 975';

const EMPTY_FORM: NewPurchaseForm = {
  project_id: '',
  item_name: '',
  brand: '',
  category: '',
  supplier_name: '',
  estimated_cost: '',
  planned_purchase_date: undefined,
  quantity: '',
  unit: '',
  description: '',
  notes: '',
  boleto_code: '',
  payment_due_date: undefined,
  delivery_location: '',
  delivery_address: '',
};

// ─── PurchaseRowActions ──────────────────────────────────────────────────────
/**
 * Quick actions por linha da tabela: Editar e Excluir.
 *
 * - **Editar** (atalho): leva para `/obra/:projectId/compras`, onde o
 *   usuário tem o formulário completo (parcelas, atividade vinculada,
 *   anexos, etc.).
 * - **Excluir**: dispara o AlertDialog no nível da página (controlado por
 *   `onRequestDelete`) — a confirmação é obrigatória porque a exclusão é
 *   definitiva (project_purchases não tem soft delete).
 *
 * Usa `DropdownMenu` para manter densidade da tabela; em mobile o overlay
 * já garante alvo de toque adequado.
 */
function PurchaseRowActions({
  purchase,
  onEdit,
  onRequestDelete,
}: {
  purchase: PurchaseWithProject;
  onEdit: (p: PurchaseWithProject) => void;
  onRequestDelete: (p: PurchaseWithProject) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={`Ações para ${purchase.item_name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onEdit(purchase)} className="gap-2">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Editar na obra
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onRequestDelete(purchase)}
          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Excluir solicitação
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewPurchaseDialog({
  open,
  onClose,
  projects,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string; address: string | null; bairro: string | null; cep: string | null; customer_name: string | null }[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<NewPurchaseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setPendingFiles([]);
    }
  }, [open]);

  const set = (field: keyof NewPurchaseForm, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /**
   * Compõe o endereço completo de uma obra a partir das colunas `address`,
   * `bairro` e `cep`. Usado para auto-preencher o campo `delivery_address`
   * quando o usuário escolhe "Obra" como local de entrega.
   */
  const buildProjectAddress = (projectId: string): string => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return '';
    const parts = [proj.address, proj.bairro, proj.cep].filter((s) => !!s && s.trim().length > 0);
    return parts.join(' — ');
  };

  /**
   * Atualiza o local de entrega e auto-preenche o campo de endereço:
   * - escritório → endereço fixo BWild
   * - obra       → endereço cadastrado da obra selecionada
   * - retirada   → limpa para o usuário digitar manualmente
   */
  const handleDeliveryLocationChange = (loc: NewPurchaseForm['delivery_location']) => {
    setForm((prev) => {
      let address = prev.delivery_address;
      if (loc === 'escritorio') {
        address = ESCRITORIO_ADDRESS;
      } else if (loc === 'obra') {
        address = buildProjectAddress(prev.project_id) || prev.delivery_address;
      } else if (loc === 'retirada') {
        // Campo livre — limpa apenas se ainda estiver com o endereço auto-preenchido
        // de outro modo, para não apagar texto digitado manualmente pelo usuário.
        if (prev.delivery_address === ESCRITORIO_ADDRESS || prev.delivery_address === buildProjectAddress(prev.project_id)) {
          address = '';
        }
      }
      return { ...prev, delivery_location: loc, delivery_address: address };
    });
  };

  /**
   * Quando a obra muda e o local já é "obra", reatualiza o endereço.
   */
  const handleProjectChange = (projectId: string) => {
    setForm((prev) => {
      const next = { ...prev, project_id: projectId };
      if (prev.delivery_location === 'obra') {
        const newAddr = projects.find((p) => p.id === projectId);
        const parts = newAddr ? [newAddr.address, newAddr.bairro, newAddr.cep].filter((s) => !!s && s.trim().length > 0) : [];
        next.delivery_address = parts.join(' — ');
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    // Validações de campos obrigatórios — mensagens específicas para cada caso
    const missing: string[] = [];
    if (!form.project_id) missing.push('Obra');
    if (!form.item_name.trim()) missing.push('Nome do item');

    if (missing.length > 1) {
      toast.error('Campos obrigatórios não preenchidos', {
        description: `Preencha: ${missing.join(', ')}.`,
      });
      return;
    }
    if (missing.length === 1) {
      const map: Record<string, { title: string; desc: string }> = {
        'Obra': {
          title: 'Selecione uma obra',
          desc: 'Escolha a obra para a qual esta compra será solicitada.',
        },
        'Nome do item': {
          title: 'Informe o nome do item',
          desc: 'Descreva brevemente o que está sendo solicitado (ex: Cimento CP-II 50kg).',
        },
      };
      const m = map[missing[0]];
      toast.error(m.title, { description: m.desc });
      return;
    }

    if (!user?.id) {
      toast.error('Sessão expirada', {
        description: 'Não foi possível identificar seu usuário. Faça login novamente para continuar.',
      });
      return;
    }

    setSaving(true);
    try {
      // planned_purchase_date é opcional. required_by_date é NOT NULL no banco:
      // se o usuário informou uma data válida, usamos ela; caso contrário, default = hoje + 7 dias.
      const planned = form.planned_purchase_date;
      const plannedValid = planned instanceof Date && isValid(planned);
      const plannedDate = plannedValid ? format(planned, 'yyyy-MM-dd') : null;
      const requiredDate = plannedValid
        ? format(planned, 'yyyy-MM-dd')
        : format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const dueDateValid = form.payment_due_date instanceof Date && isValid(form.payment_due_date);
      const boletoCodeTrimmed = form.boleto_code.trim();

      const payload: ProjectPurchaseInsert = {
        project_id: form.project_id,
        created_by: user.id,
        item_name: form.item_name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        supplier_name: form.supplier_name.trim() || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost.replace(',', '.')) : null,
        planned_purchase_date: plannedDate,
        required_by_date: requiredDate,
        quantity: form.quantity ? Number(form.quantity) : 1,
        unit: form.unit.trim() || 'un',
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        status: 'pending',
        // Pagamento — boleto opcional. Se houver código ou vencimento informados,
        // marcamos `payment_method` como 'boleto' para consistência com a coluna de Pagamento.
        boleto_code: boletoCodeTrimmed || null,
        payment_due_date: dueDateValid ? format(form.payment_due_date as Date, 'yyyy-MM-dd') : null,
        payment_method: boletoCodeTrimmed || dueDateValid ? 'boleto' : null,
        // Local e endereço de entrega — opcional. Constraint do banco aceita
        // 'obra' | 'estoque' | 'escritorio' | 'retirada'.
        delivery_location: form.delivery_location || null,
        delivery_address: form.delivery_address.trim() || null,
      };

      // Preenche automaticamente expected_delivery_date a partir da data
      // prevista de pagamento + prazo (lead_time_days, default 7 dias úteis).
      // Permite ao calendário e à coluna "Entrega" mostrarem a previsão sem
      // exigir entrada manual. Será recalculado no momento do "Pago" usando
      // a data efetiva (paid_at).
      if (payload.payment_due_date) {
        const expected = calcExpectedDelivery(
          payload.payment_due_date,
          payload.lead_time_days ?? 7,
        );
        if (expected) payload.expected_delivery_date = expected;
      }

      const { data: created, error } = await supabase
        .from('project_purchases')
        .insert(payload)
        .select('id, project_id')
        .single();
      if (error) throw error;

      // Upload dos arquivos anexados (best-effort).
      if (created && pendingFiles.length > 0) {
        const { uploaded, failed } = await uploadPendingAttachments({
          pending: pendingFiles,
          purchaseId: created.id,
          projectId: created.project_id,
          userId: user.id,
        });
        if (failed > 0) {
          toast.warning(`${failed} anexo(s) não foram enviados`, {
            description: 'A solicitação foi criada. Tente reenviar os arquivos pela tela de edição.',
          });
        } else if (uploaded > 0) {
          toast.success(`${uploaded} anexo(s) enviados`);
        }
      }

      toast.success('Solicitação criada com sucesso!', {
        description: `${form.item_name.trim()} foi adicionada ao calendário de compras.`,
      });
      onCreated();
      onClose();
    } catch (e) {
      console.error('[CalendarioCompras] insert error:', e);
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast.error('Não foi possível criar a solicitação', {
        description: `${message}. Tente novamente em alguns instantes.`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Nova Solicitação de Compra</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Obra — obrigatório */}
          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Obra <span className="text-destructive">*</span></Label>
            <Select value={form.project_id} onValueChange={handleProjectChange}>
              <SelectTrigger className={cn('h-9', !form.project_id && 'border-destructive/50')}>
                <SelectValue placeholder="Selecionar obra…" />
              </SelectTrigger>
              <SelectContent className="z-[300]">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.customer_name ? ` — ${p.customer_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item + Marca — marca opcional, lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Item / Produto <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex: Cimento CP-II, Vergalhão 10mm…" value={form.item_name}
                onChange={(e) => set('item_name', e.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">
                Marca <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: Votorantim, Tigre…"
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Categoria + Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">Categoria</Label>
              <Input placeholder="Ex: Estrutura, Elétrico…" value={form.category}
                onChange={(e) => set('category', e.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Fornecedor</Label>
              <Input placeholder="Nome do fornecedor" value={form.supplier_name}
                onChange={(e) => set('supplier_name', e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Qtde + Unidade + Custo estimado */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">Quantidade</Label>
              <Input type="number" min="0" placeholder="0" value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Unidade</Label>
              <Input placeholder="un, kg, m²…" value={form.unit}
                onChange={(e) => set('unit', e.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Custo Estimado (R$)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.estimated_cost}
                onChange={(e) => set('estimated_cost', e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Data planejada */}
          <div className="grid gap-1.5">
            <Label className="text-sm">Data Planejada de Compra</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full h-9 justify-start font-normal text-sm', !form.planned_purchase_date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.planned_purchase_date ? format(form.planned_purchase_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecionar data…'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[300]" align="start">
                <CalendarPicker mode="single" selected={form.planned_purchase_date}
                  onSelect={(d) => { set('planned_purchase_date', d); setDateOpen(false); }}
                  locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Boleto — opcional. Mantém paridade com a coluna "Pagamento" da listagem. */}
          <div className="grid gap-2 rounded-md border border-dashed border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Boleto (opcional)</Label>
              <span className="text-[11px] text-muted-foreground">
                Preencha se já possuir o boleto deste fornecedor
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="boleto_code" className="text-xs text-muted-foreground">
                  Código / linha digitável
                </Label>
                <Input
                  id="boleto_code"
                  placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                  value={form.boleto_code}
                  onChange={(e) => set('boleto_code', e.target.value)}
                  className="h-9 font-mono text-xs"
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full h-9 justify-start font-normal text-sm',
                        !form.payment_due_date && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.payment_due_date
                        ? format(form.payment_due_date, 'dd/MM/yyyy', { locale: ptBR })
                        : 'Selecionar…'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[300]" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={form.payment_due_date}
                      onSelect={(d) => { set('payment_due_date', d); setDueDateOpen(false); }}
                      locale={ptBR}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Local de entrega — escritório (auto), obra (auto a partir do cadastro) ou retirada (livre) */}
          <div className="grid gap-2 rounded-md border border-dashed border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Local de entrega</Label>
              <span className="text-[11px] text-muted-foreground">
                Define o endereço para onde o item será entregue
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'escritorio', label: 'Escritório', hint: 'Rua Álvaro Rodrigues, 975' },
                { value: 'obra',       label: 'Obra',       hint: 'Endereço cadastrado da obra' },
                { value: 'retirada',   label: 'Retirada',   hint: 'Endereço livre' },
              ] as const).map((opt) => {
                const active = form.delivery_location === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDeliveryLocationChange(opt.value)}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                      active
                        ? 'bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/20'
                        : 'bg-background text-foreground border-border hover:bg-accent/40',
                    )}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="delivery_address" className="text-xs text-muted-foreground">
                Endereço de entrega
                {form.delivery_location === 'obra' && !form.project_id && (
                  <span className="ml-1 text-destructive">— selecione a obra para preencher automaticamente</span>
                )}
                {form.delivery_location && form.delivery_location !== 'retirada' && (
                  <span className="ml-1 text-muted-foreground">(editável)</span>
                )}
              </Label>
              <Input
                id="delivery_address"
                placeholder={
                  form.delivery_location === 'retirada'
                    ? 'Ex: Rua das Flores, 123 — Apto 45 — Vila Mariana'
                    : form.delivery_location
                      ? 'Endereço preenchido automaticamente — você pode editar se necessário'
                      : 'Selecione o local acima ou digite o endereço'
                }
                value={form.delivery_address}
                onChange={(e) => set('delivery_address', e.target.value)}
                className="h-9"
                aria-describedby={form.delivery_location === 'retirada' ? 'delivery_address_hint' : undefined}
                autoComplete="street-address"
                list={form.delivery_location === 'retirada' ? 'delivery_address_suggestions' : undefined}
              />
              {form.delivery_location === 'retirada' && (
                <>
                  <p id="delivery_address_hint" className="text-[11px] text-muted-foreground leading-snug">
                    Formato sugerido: <span className="font-medium text-foreground/80">Rua, número, complemento, bairro</span>
                    {' '}— ex.: <span className="italic">Av. Paulista, 1578 — Sala 201 — Bela Vista</span>
                  </p>
                  <datalist id="delivery_address_suggestions">
                    <option value="Rua , nº  — Complemento  — Bairro " />
                    <option value="Av. , nº  — Sala  — Bairro " />
                    <option value="Rua Álvaro Rodrigues, 975 — Brooklin" />
                  </datalist>
                </>
              )}
            </div>
          </div>

          {/* Descrição + Observações */}
          <div className="grid gap-1.5">
            <Label className="text-sm">Descrição técnica</Label>
            <Textarea placeholder="Especificações, normas, referências técnicas…" value={form.description}
              onChange={(e) => set('description', e.target.value)} rows={2} className="text-sm resize-none" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-sm">Observações</Label>
            <Textarea placeholder="Urgência, ponto de entrega, contato do fornecedor…" value={form.notes}
              onChange={(e) => set('notes', e.target.value)} rows={2} className="text-sm resize-none" />
          </div>

          {/* Anexos — imagens e documentos da requisição */}
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3">
            <PurchaseAttachmentsField
              mode="pending"
              pending={pendingFiles}
              onPendingChange={setPendingFiles}
              helperText="Imagens, PDF, planilhas — até 20 MB cada"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? 'Salvando…' : <><Plus className="h-4 w-4" /> Criar Solicitação</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CalendarioCompras() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActualCost, setFilterActualCost] = useState<'all' | 'informed' | 'pending'>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  // Quick action: confirmação de exclusão de uma solicitação. Guardamos a
  // linha alvo aqui para mostrar contexto (nome do item + obra) no
  // AlertDialog antes de chamar a mutation.
  const [deleteTarget, setDeleteTarget] = useState<PurchaseWithProject | null>(null);
  const navigate = useNavigate();
  // Ordenação por "Solicitada em" (created_at). null = ordem padrão (planned_purchase_date asc).
  const [requestedSort, setRequestedSort] = useState<'asc' | 'desc' | null>(null);
  // Ordenação por nome do cliente (asc/desc). Mutuamente exclusivo com requestedSort.
  const [customerSort, setCustomerSort] = useState<'asc' | 'desc' | null>(null);
  const toggleRequestedSort = () => {
    setCustomerSort(null);
    setRequestedSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
  };
  const toggleCustomerSort = () => {
    setRequestedSort(null);
    setCustomerSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
  };

  const toggleRow = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { data: allPurchases = [], isLoading } = useQuery({
    queryKey: ['all-purchases-calendar'],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from('project_purchases')
        .select('*')
        .order('planned_purchase_date', { ascending: true });
      if (error) throw error;
      const projectIds = [...new Set((purchases || []).map((p) => p.project_id))];
      const { data: projects } = await supabase
        .from('projects').select('id, name, project_customers(customer_name)').in('id', projectIds);
      type ProjectRow = { id: string; name: string; project_customers?: { customer_name: string | null }[] | null };
      const projectMap = new Map<string, { name: string; customer_name: string | null }>(
        ((projects || []) as ProjectRow[]).map((p) => [p.id, {
          name: p.name,
          customer_name: p.project_customers?.[0]?.customer_name?.trim() || null,
        }])
      );
      return (purchases || []).map((p) => ({
        ...p,
        project_name: projectMap.get(p.project_id)?.name || 'Projeto',
        customer_name: projectMap.get(p.project_id)?.customer_name || null,
      })) as PurchaseWithProject[];
    },
    staleTime: 60_000,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['all-payments-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments').select('id, project_id, amount, paid_at').not('paid_at', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch all projects for the New Purchase dialog (not just the ones with purchases)
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects-for-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, address, bairro, cep, project_customers(customer_name)')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      type Row = {
        id: string;
        name: string;
        address: string | null;
        bairro: string | null;
        cep: string | null;
        project_customers?: { customer_name: string | null }[] | null;
      };
      return (data || []).map((p: Row) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        bairro: p.bairro,
        cep: p.cep,
        customer_name: p.project_customers?.[0]?.customer_name?.trim() || null,
      })) as { id: string; name: string; address: string | null; bairro: string | null; cep: string | null; customer_name: string | null }[];
    },
    staleTime: 120_000,
  });

  const updateActualCost = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number | null }) => {
      const { error } = await supabase.from('project_purchases').update({ actual_cost: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] }); toast.success('Custo real atualizado'); },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar custo real'); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, value, paidDate }: { id: string; value: CalendarStatus; paidDate?: string }) => {
      // "Pago" é um estado derivado de paid_at. Ao marcar Pago: registramos
      // a data escolhida pelo usuário (default = hoje); ao mover para outro
      // status: limpamos paid_at e gravamos o status logístico (mantendo
      // 'delivered' como default ao "despagar").
      const updates: Record<string, unknown> = {};
      if (value === 'paid') {
        // `paidDate` chega como 'YYYY-MM-DD' (data local escolhida no picker).
        // Convertemos para ISO no fuso local — meio-dia evita drift de UTC.
        const dateStr = paidDate ?? format(new Date(), 'yyyy-MM-dd');
        const paidAt = new Date(`${dateStr}T12:00:00`).toISOString();
        updates.paid_at = paidAt;
        // Recalcula a data prevista de entrega: âncora = data efetiva do
        // pagamento + `lead_time_days` em DIAS ÚTEIS (skip fins de semana e
        // feriados de SP via `businessDays.ts`). Se a própria data de pagamento
        // cair em dia não-útil, `addBusinessDays` antes avança para o próximo
        // dia útil e só então conta o lead time — garantindo "ponta a ponta"
        // útil. Passamos `dateStr` (YYYY-MM-DD local) em vez do ISO completo
        // para eliminar qualquer drift de fuso ao reinterpretar a âncora.
        const { data: row } = await supabase
          .from('project_purchases')
          .select('lead_time_days')
          .eq('id', id)
          .maybeSingle();
        const expected = calcExpectedDelivery(dateStr, row?.lead_time_days ?? 7);
        if (expected) updates.expected_delivery_date = expected;
      } else {
        updates.paid_at = null;
        updates.status = value;
      }
      const { error } = await supabase.from('project_purchases').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] }); toast.success('Status atualizado'); },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar status'); },
  });

  const updateDateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'planned_purchase_date' | 'payment_due_date'; value: string | null }) => {
      let normalized: string | null = null;
      if (value && value.trim()) {
        const iso = parseFlexibleBRDate(value.trim());
        if (!iso) throw new Error('INVALID_DATE');
        normalized = iso;
      }
      const updates: Record<string, unknown> = { [field]: normalized };

      // Quando o usuário ajusta a data prevista de pagamento e a compra
      // ainda não foi paga (paid_at vazio), recalculamos a data prevista
      // de entrega usando essa nova âncora + lead_time_days. Após o
      // pagamento, a âncora passa a ser paid_at e edições em
      // payment_due_date não devem mais alterar a previsão de entrega.
      if (field === 'payment_due_date') {
        const { data: row } = await supabase
          .from('project_purchases')
          .select('lead_time_days, paid_at')
          .eq('id', id)
          .maybeSingle();
        if (!row?.paid_at) {
          updates.expected_delivery_date = normalized
            ? calcExpectedDelivery(normalized, row?.lead_time_days ?? 7)
            : null;
        }
      }

      const { error } = await supabase.from('project_purchases').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success(vars.field === 'planned_purchase_date' ? 'Data da compra atualizada' : 'Data de pagamento atualizada');
    },
    onError: (e: Error) => {
      console.error(e);
      if (e?.message === 'INVALID_DATE') {
        toast.error('Data inválida. Use o formato dd/mm/aaaa.');
      } else {
        toast.error('Erro ao atualizar data');
      }
    },
  });

  // Mutação genérica para campos do detalhe colapsável (forma de pagamento,
  // chave PIX, código do boleto, etc.). Espelha o padrão de `handleUpdateField`
  // do módulo de Compras: parsing leve de números/datas, normalização de
  // strings vazias para null e invalidação do cache da listagem.
  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | null }) => {
      let updateValue: string | number | null = value;

      if (field === 'estimated_cost' || field === 'actual_cost' || field === 'quantity' || field === 'shipping_cost') {
        updateValue = value ? parseFloat(value) : null;
        if (typeof updateValue === 'number' && isNaN(updateValue)) updateValue = null;
      }

      if ((PURCHASE_DATE_FIELDS as readonly string[]).includes(field)) {
        const trimmed = value?.trim();
        if (!trimmed) {
          updateValue = null;
        } else {
          // Aceita ISO `yyyy-MM-dd`, `dd/MM/yyyy`, `dd-MM-yy`, etc.
          // Rejeita datas inválidas (31/02, 29/02 fora de ano bissexto, etc.)
          // antes de chegar ao banco — mensagem ao usuário tratada no caller.
          const iso = parseFlexibleBRDate(trimmed);
          if (!iso) {
            throw new Error('INVALID_DATE');
          }
          updateValue = iso;
        }
      }

      // Trata "none" do select de forma de pagamento como limpeza do campo
      if (field === 'payment_method' && (value === 'none' || value === '')) {
        updateValue = null;
      }

      const { error } = await supabase
        .from('project_purchases')
        .update({ [field]: updateValue })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
    },
    onError: (e: Error) => {
      console.error(e);
      if (e?.message === 'INVALID_DATE') {
        toast.error('Data inválida. Use o formato dd/mm/aaaa.');
      } else {
        toast.error('Erro ao salvar alteração');
      }
    },
  });

  const handleUpdateField = (id: string, field: string, value: string | null) => {
    updateField.mutate({ id, field, value });
  };

  // Quick action: exclusão hard delete. As solicitações de compra deste módulo
  // não têm soft delete (não há coluna deleted_at em project_purchases), então
  // a remoção é definitiva — por isso o fluxo passa por AlertDialog antes de
  // chegar aqui.
  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_purchases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success('Solicitação de compra excluída');
      setDeleteTarget(null);
    },
    onError: (e: Error) => {
      console.error('[CalendarioCompras] delete error:', e);
      toast.error('Não foi possível excluir', {
        description: e?.message ?? 'Tente novamente em alguns instantes.',
      });
    },
  });

  /**
   * Quick action: editar.
   * O calendário consolida compras de várias obras; a edição completa
   * (com parcelas, atividade vinculada, etc.) vive na página da obra.
   * Navegamos para `/obra/:projectId/compras` — o usuário cai direto no
   * módulo CRUD daquela obra.
   */
  const handleEditPurchase = (p: PurchaseWithProject) => {
    navigate(`/obra/${p.project_id}/compras`);
  };

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    allPurchases.forEach((p) => map.set(p.project_id, p.project_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPurchases]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => { if (p.supplier_name?.trim()) set.add(p.supplier_name.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => { if (p.category?.trim()) set.add(p.category.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : null;
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : null;

  const filtered = useMemo(() => {
    return allPurchases.filter((p) => {
      if (filterStatus !== 'all' && toCalendarStatus(p.status, (p as any).paid_at) !== filterStatus) return false;
      if (filterProject !== 'all' && p.project_id !== filterProject) return false;
      if (filterCustomer !== 'all' && (p.customer_name || '').trim() !== filterCustomer) return false;
      if (filterSupplier !== 'all' && (p.supplier_name || '') !== filterSupplier) return false;
      if (filterCategory !== 'all' && (p.category || '') !== filterCategory) return false;
      if (filterActualCost === 'informed' && p.actual_cost == null) return false;
      if (filterActualCost === 'pending' && p.actual_cost != null) return false;
      if (dateFromStr || dateToStr) {
        if (!p.planned_purchase_date) return false;
        if (dateFromStr && p.planned_purchase_date < dateFromStr) return false;
        if (dateToStr && p.planned_purchase_date > dateToStr) return false;
      }
      return true;
    });
  }, [allPurchases, filterStatus, filterProject, filterCustomer, filterSupplier, filterCategory, filterActualCost, dateFromStr, dateToStr]);

  // Lista única de clientes derivada das compras (ordenada alfabeticamente, pt-BR).
  const customers = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => {
      const name = (p.customer_name || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [allPurchases]);

  const activeFilterCount =
    (filterStatus !== 'all' ? 1 : 0) + (filterProject !== 'all' ? 1 : 0) +
    (filterCustomer !== 'all' ? 1 : 0) +
    (filterSupplier !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0) +
    (filterActualCost !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus('all'); setFilterProject('all'); setFilterCustomer('all'); setFilterSupplier('all');
    setFilterCategory('all'); setFilterActualCost('all');
    setDateFrom(undefined); setDateTo(undefined);
  };

  const purchasesByDate = useMemo(() => {
    const map = new Map<string, PurchaseWithProject[]>();
    filtered.forEach((p) => {
      if (!p.planned_purchase_date) return;
      if (!map.has(p.planned_purchase_date)) map.set(p.planned_purchase_date, []);
      map.get(p.planned_purchase_date)!.push(p);
    });
    return map;
  }, [filtered]);

  // Comparador por created_at — trata nulos sempre por último, qualquer que seja a direção.
  const compareByCreatedAt = (a: PurchaseWithProject, b: PurchaseWithProject, dir: 'asc' | 'desc') => {
    const av = a.created_at ?? '';
    const bv = b.created_at ?? '';
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  };

  const compareByCustomer = (a: PurchaseWithProject, b: PurchaseWithProject, dir: 'asc' | 'desc') => {
    const av = (a.customer_name || '').trim();
    const bv = (b.customer_name || '').trim();
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return dir === 'asc'
      ? av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' })
      : bv.localeCompare(av, 'pt-BR', { sensitivity: 'base' });
  };

  const sortedForList = useMemo(() => {
    const base = [...filtered].filter((p) => p.planned_purchase_date);
    if (customerSort) {
      return base.sort((a, b) => compareByCustomer(a, b, customerSort));
    }
    if (requestedSort) {
      return base.sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    }
    return base.sort((a, b) => (a.planned_purchase_date || '').localeCompare(b.planned_purchase_date || ''));
  }, [filtered, requestedSort, customerSort]);

  const withoutDate = useMemo(() => {
    const base = filtered.filter((p) => !p.planned_purchase_date);
    if (customerSort) {
      return [...base].sort((a, b) => compareByCustomer(a, b, customerSort));
    }
    if (requestedSort) {
      return [...base].sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    }
    return base;
  }, [filtered, requestedSort, customerSort]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // KPIs
  const totalItems = filtered.length;
  const pendingItems = filtered.filter((p) => toCalendarStatus(p.status, (p as any).paid_at) === 'pending').length;
  const thisMonthItems = filtered.filter((p) => p.planned_purchase_date && isSameMonth(parseISO(p.planned_purchase_date), currentMonth)).length;
  // "Pagos no mês": itens cuja data efetiva de pagamento (paid_at) cai no mês visível.
  // Usa o início (10 chars YYYY-MM-DD) para comparar como data local sem drift de UTC.
  const paidThisMonth = filtered.filter((p) => {
    const paidAt = (p as any).paid_at as string | null | undefined;
    if (!paidAt) return false;
    return isSameMonth(parseISO(paidAt.slice(0, 10)), currentMonth);
  }).length;
  const totalEstimated = filtered.reduce((s, p) => s + (p.estimated_cost || 0), 0);
  const itemsWithBoth = filtered.filter((p) => p.estimated_cost != null && p.actual_cost != null);
  const totalDiff = itemsWithBoth.reduce((s, p) => s + (p.estimated_cost! - p.actual_cost!), 0);
  const diffPositive = totalDiff >= 0;

  const availableBudget = useMemo(() => {
    const projectIdSet = new Set(filtered.map((p) => p.project_id));
    return allPayments.reduce((sum, pay) => {
      if (!pay.paid_at) return sum;
      if (projectIdSet.size > 0 && !projectIdSet.has(pay.project_id)) return sum;
      if (filterProject !== 'all' && pay.project_id !== filterProject) return sum;
      const paidDate = pay.paid_at.slice(0, 10);
      if (dateFromStr && paidDate < dateFromStr) return sum;
      if (dateToStr && paidDate > dateToStr) return sum;
      return sum + (Number(pay.amount) || 0);
    }, 0);
  }, [allPayments, filtered, filterProject, dateFromStr, dateToStr]);

  const budgetBalance = availableBudget - totalEstimated;
  const balancePositive = budgetBalance >= 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Calendário de Compras" backTo="/gestao" maxWidth="full" showLogo={false} />
        <div className="py-6"><PageContainer maxWidth="full"><PageSkeleton metrics content="table" /></PageContainer></div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Calendário de Compras"
        backTo="/gestao"
        maxWidth="full"
        showLogo={false}
        breadcrumbs={[{ label: 'Gestão', href: '/gestao' }, { label: 'Calendário de Compras' }]}
      />

      <NewPurchaseDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        projects={allProjects}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] })}
      />

      {/* Confirmação de exclusão — destrutiva, exige AlertDialog. */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  Esta ação removerá definitivamente <strong>{deleteTarget.item_name}</strong>
                  {deleteTarget.project_name ? <> da obra <strong>{deleteTarget.project_name}</strong></> : null}.
                  Não é possível desfazer.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePurchase.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePurchase.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deletePurchase.mutate(deleteTarget.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePurchase.isPending ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="py-6">
        <PageContainer maxWidth="full" className="space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Total de Itens', value: totalItems, cls: '' },
              { label: 'Pendentes', value: pendingItems, cls: 'text-amber-600' },
              { label: 'Este Mês', value: thisMonthItems, cls: '' },
              { label: 'Pagos no Mês', value: paidThisMonth, cls: 'text-teal-600' },
              { label: 'Total Estimado', value: fmt(totalEstimated), cls: 'text-xl' },
              {
                label: `Diferença (${itemsWithBoth.length})`,
                value: itemsWithBoth.length === 0 ? '—' : fmtDiff(totalDiff),
                cls: cn('text-xl', diffPositive ? 'text-emerald-600' : 'text-red-600'),
              },
              { label: 'Orçamento Disponível', value: fmt(availableBudget), cls: 'text-xl text-emerald-600' },
              {
                label: 'Saldo',
                value: fmtDiff(budgetBalance),
                cls: cn('text-xl', balancePositive ? 'text-emerald-600' : 'text-red-600'),
              },
            ].map(({ label, value, cls }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">{label}</p>
                  <p className={cn('font-bold tabular-nums', cls.includes('text-xl') ? 'text-xl whitespace-nowrap' : 'text-2xl')}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Filters + View Toggle + New Button ── */}
          {/* sticky para manter filtros e ações de troca de visão sempre visíveis ao rolar listas longas */}
          <Card className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                {/* Period: From */}
                {[{ label: 'De', val: dateFrom, set: setDateFrom, placeholder: 'Início' },
                  { label: 'Até', val: dateTo, set: setDateTo, placeholder: 'Fim' }].map(({ label, val, set: setVal, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('w-36 justify-start text-left font-normal', !val && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {val ? format(val, 'dd/MM/yyyy') : placeholder}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker mode="single" selected={val} onSelect={setVal as (d: Date | undefined) => void}
                          locale={ptBR} initialFocus className="p-3 pointer-events-auto"
                          disabled={label === 'Até' && dateFrom ? (d) => d < dateFrom : undefined} />
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {CALENDAR_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{calendarStatusConfig[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Obra */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Obra</Label>
                  <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Obra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as obras</SelectItem>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cliente */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fornecedor */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos fornecedores</SelectItem>
                      {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custo Real */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Custo Real</Label>
                  <Select value={filterActualCost} onValueChange={(v) => setFilterActualCost(v as 'all' | 'informed' | 'pending')}>
                    <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="informed">Informado</SelectItem>
                      <SelectItem value="pending">Não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
                    <FilterX className="h-3.5 w-3.5 mr-1" />Limpar ({activeFilterCount})
                  </Button>
                )}

                {/* View toggle + Nova Solicitação */}
                <div className="ml-auto flex items-center gap-2 self-end">
                  <div className="flex gap-1">
                    <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>Lista</Button>
                    <Button variant={viewMode === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('calendar')}>
                      <Calendar className="h-4 w-4 mr-1" />Calendário
                    </Button>
                  </div>
                  <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setNewDialogOpen(true)}>
                    <Plus className="h-4 w-4" />Nova Solicitação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Calendar view ── */}
          {viewMode === 'calendar' ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                    <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
                  ))}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayPurchases = purchasesByDate.get(dateStr) || [];
                    const isToday = isSameDay(day, new Date());
                    const weekend = isWeekend(day);
                    return (
                      <div key={dateStr} className={cn('bg-background p-1.5 min-h-[80px] text-xs', isToday && 'ring-2 ring-primary ring-inset', weekend && 'bg-muted/40')}>
                        <span className={cn('font-medium', isToday && 'text-primary')}>{format(day, 'd')}</span>
                        <div className="mt-1 space-y-0.5">
                          {dayPurchases.slice(0, 3).map((p) => {
                            const cs = toCalendarStatus(p.status, (p as any).paid_at);
                            const cfg = calendarStatusConfig[cs];
                            return (
                              <div key={p.id} className={cn('text-[10px] leading-tight rounded-sm px-1 py-0.5 truncate border', cfg.color)} title={`${p.project_name} — ${p.item_name}`}>
                                {p.item_name}
                              </div>
                            );
                          })}
                          {dayPurchases.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayPurchases.length - 3} mais</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── List view: Agendadas ── */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Compras Agendadas <span className="text-muted-foreground font-normal text-sm">({sortedForList.length})</span></CardTitle>
                    <p className="text-xs text-muted-foreground hidden sm:block">Clique em ▸ para ver detalhes • campos editáveis em linha</p>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table className="text-xs [&_th]:px-3 [&_td]:px-3 [&_th]:h-9 [&_td]:py-2">
                  <TableHeader>
                      <TableRow className="bg-muted/50">
                        {/* expand toggle col */}
                        <TableHead className="w-8" />
                        <TableHead className="whitespace-nowrap p-0">
                          <button
                            type="button"
                            onClick={toggleCustomerSort}
                            aria-label={`Ordenar por cliente${customerSort ? ` (${customerSort === 'asc' ? 'ascendente' : 'descendente'})` : ''}`}
                            aria-sort={customerSort === 'asc' ? 'ascending' : customerSort === 'desc' ? 'descending' : 'none'}
                            className={cn(
                              'flex h-9 w-full items-center gap-1 px-3 text-left font-medium whitespace-nowrap',
                              'hover:bg-muted/60 hover:text-foreground transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                              customerSort && 'text-foreground bg-muted/40',
                            )}
                          >
                            Cliente
                            {customerSort === 'asc' && <ChevronUp className="h-3.5 w-3.5 text-primary" aria-hidden />}
                            {customerSort === 'desc' && <ChevronDown className="h-3.5 w-3.5 text-primary" aria-hidden />}
                            {customerSort === null && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />}
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap">Obra</TableHead>
                        <TableHead className="whitespace-nowrap">Item</TableHead>
                        <TableHead className="whitespace-nowrap p-0">
                          <button
                            type="button"
                            onClick={toggleRequestedSort}
                            aria-label={`Ordenar por solicitada em${requestedSort ? ` (${requestedSort === 'asc' ? 'ascendente' : 'descendente'})` : ''}`}
                            aria-sort={requestedSort === 'asc' ? 'ascending' : requestedSort === 'desc' ? 'descending' : 'none'}
                            className={cn(
                              'flex h-9 w-full items-center gap-1 px-3 text-left font-medium whitespace-nowrap',
                              'hover:bg-muted/60 hover:text-foreground transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                              requestedSort && 'text-foreground bg-muted/40',
                            )}
                          >
                            Solicitada em
                            {requestedSort === 'asc' && <ChevronUp className="h-3.5 w-3.5 text-primary" aria-hidden />}
                            {requestedSort === 'desc' && <ChevronDown className="h-3.5 w-3.5 text-primary" aria-hidden />}
                            {requestedSort === null && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />}
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Real</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Dif.</TableHead>
                        <TableHead className="whitespace-nowrap">Pagamento</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="w-10 text-right pr-2"><span className="sr-only">Ações</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForList.map((p) => {
                        const hasBoth = p.estimated_cost != null && p.actual_cost != null;
                        const diff = hasBoth ? p.estimated_cost! - p.actual_cost! : null;
                        const expanded = expandedRows.has(p.id);
                        // Expansão sempre disponível: o detalhe agora inclui a seção
                        // de Pagamento (vencimento, forma, PIX, boleto), aplicável a qualquer linha.
                        const hasDetails = true;
                        return (
                          <Fragment key={p.id}>
                            <TableRow className={cn('hover:bg-muted/30 transition-colors', expanded && 'bg-muted/20')}>
                              {/* expand */}
                              <TableCell className="w-8 text-center">
                                {hasDetails ? (
                                  <button type="button" onClick={() => toggleRow(p.id)}
                                    className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                ) : <span className="inline-block w-5" />}
                              </TableCell>

                              <TableCell className="whitespace-nowrap max-w-[180px]">
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <span
                                      tabIndex={0}
                                      className={cn(
                                        'block truncate max-w-full align-middle cursor-default',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                                        !p.customer_name && 'text-muted-foreground italic',
                                      )}
                                      aria-label={p.customer_name || 'Sem cliente vinculado a esta obra'}
                                    >
                                      {p.customer_name || '—'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    align="center"
                                    sideOffset={6}
                                    collisionPadding={12}
                                    avoidCollisions
                                    className="max-w-[min(320px,calc(100vw-24px))] whitespace-normal break-words text-xs leading-snug"
                                  >
                                    {p.customer_name || 'Sem cliente vinculado a esta obra'}
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>

                              <TableCell className="whitespace-nowrap max-w-[160px]">
                                <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block font-normal">
                                  {p.project_name}
                                </Badge>
                              </TableCell>

                              <TableCell className="max-w-[200px]">
                                <p className="font-medium truncate" title={p.item_name}>{p.item_name}</p>
                                {(p as any).brand && (
                                  <p className="text-[11px] text-muted-foreground truncate" title={(p as any).brand}>
                                    {(p as any).brand}
                                  </p>
                                )}
                              </TableCell>

                              <TableCell className={cn(
                                'text-muted-foreground whitespace-nowrap text-xs tabular-nums',
                                !p.created_at && 'italic',
                              )}>
                                {fmtRequestedDate(p.created_at)}
                              </TableCell>

                              <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtCompact(p.estimated_cost)}</TableCell>

                              <TableCell className="text-right whitespace-nowrap tabular-nums">
                                <ActualCostCell purchase={p} onSave={(id, v) => updateActualCost.mutate({ id, value: v })} />
                              </TableCell>

                              <TableCell className={cn('text-right whitespace-nowrap tabular-nums font-medium',
                                diff == null && 'text-muted-foreground',
                                diff != null && diff >= 0 && 'text-emerald-600',
                                diff != null && diff < 0 && 'text-red-600',
                              )}>
                                {diff == null ? '—' : fmtDiff(diff)}
                              </TableCell>

                              <TableCell className="whitespace-nowrap">
                                <div className="inline-flex items-center">
                                  <DateCell value={p.payment_due_date}
                                    onSave={(v) => updateDateField.mutate({ id: p.id, field: 'payment_due_date', value: v })} />
                                  <PaymentInfoBadges p={p} />
                                </div>
                              </TableCell>

                              <TableCell className="whitespace-nowrap">
                                <StatusCell purchase={p} onSave={(id, v, paidDate) => updateStatus.mutate({ id, value: v, paidDate })} />
                              </TableCell>

                              <TableCell className="w-10 text-right pr-2">
                                <PurchaseRowActions
                                  purchase={p}
                                  onEdit={handleEditPurchase}
                                  onRequestDelete={setDeleteTarget}
                                />
                              </TableCell>
                            </TableRow>

                            {/* Expanded detail row */}
                            {expanded && hasDetails && (
                              <TableRow className="bg-muted/10 hover:bg-muted/10">
                                <TableCell colSpan={11} className="p-0">
                                  <PurchaseRowDetail p={p} onUpdateField={handleUpdateField} />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                      {sortedForList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                            Nenhuma compra agendada encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* ── List view: Sem data ── */}
              {withoutDate.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-muted-foreground">
                      Sem Data Definida <span className="font-normal text-sm">({withoutDate.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <Table className="text-xs [&_th]:px-3 [&_td]:px-3 [&_th]:h-9 [&_td]:py-2">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-8" />
                          <TableHead className="whitespace-nowrap">Obra</TableHead>
                          <TableHead className="whitespace-nowrap">Item</TableHead>
                          <TableHead className="whitespace-nowrap p-0">
                            <button
                              type="button"
                              onClick={toggleRequestedSort}
                              aria-label={`Ordenar por solicitada em${requestedSort ? ` (${requestedSort === 'asc' ? 'ascendente' : 'descendente'})` : ''}`}
                              aria-sort={requestedSort === 'asc' ? 'ascending' : requestedSort === 'desc' ? 'descending' : 'none'}
                              className={cn(
                                'flex h-9 w-full items-center gap-1 px-3 text-left font-medium whitespace-nowrap',
                                'hover:bg-muted/60 hover:text-foreground transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                requestedSort && 'text-foreground bg-muted/40',
                              )}
                            >
                              Solicitada em
                              {requestedSort === 'asc' && <ChevronUp className="h-3.5 w-3.5 text-primary" aria-hidden />}
                              {requestedSort === 'desc' && <ChevronDown className="h-3.5 w-3.5 text-primary" aria-hidden />}
                              {requestedSort === null && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />}
                            </button>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Real</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Dif.</TableHead>
                          <TableHead className="whitespace-nowrap">Pagamento</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="w-10 text-right pr-2"><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withoutDate.map((p) => {
                          const hasBoth = p.estimated_cost != null && p.actual_cost != null;
                          const diff = hasBoth ? p.estimated_cost! - p.actual_cost! : null;
                          const expanded = expandedRows.has(p.id);
                          // Expansão sempre disponível: o detalhe inclui a seção de Pagamento.
                          const hasDetails = true;
                          return (
                            <Fragment key={p.id}>
                              <TableRow className={cn('hover:bg-muted/30', expanded && 'bg-muted/20')}>
                                <TableCell className="w-8 text-center">
                                  {hasDetails ? (
                                    <button type="button" onClick={() => toggleRow(p.id)}
                                      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                  ) : <span className="inline-block w-5" />}
                                </TableCell>
                                <TableCell className="whitespace-nowrap max-w-[160px]">
                                  <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block font-normal">{p.project_name}</Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px]"><p className="font-medium truncate" title={p.item_name}>{p.item_name}</p></TableCell>
                                <TableCell className={cn(
                                  'text-muted-foreground whitespace-nowrap text-xs tabular-nums',
                                  !p.created_at && 'italic',
                                )}>
                                  {fmtRequestedDate(p.created_at)}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtCompact(p.estimated_cost)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap tabular-nums">
                                  <ActualCostCell purchase={p} onSave={(id, v) => updateActualCost.mutate({ id, value: v })} />
                                </TableCell>
                                <TableCell className={cn('text-right whitespace-nowrap tabular-nums font-medium',
                                  diff == null && 'text-muted-foreground',
                                  diff != null && diff >= 0 && 'text-emerald-600',
                                  diff != null && diff < 0 && 'text-red-600',
                                )}>{diff == null ? '—' : fmtDiff(diff)}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="inline-flex items-center">
                                    <DateCell value={p.payment_due_date}
                                      onSave={(v) => updateDateField.mutate({ id: p.id, field: 'payment_due_date', value: v })} />
                                    <PaymentInfoBadges p={p} />
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <StatusCell purchase={p} onSave={(id, v, paidDate) => updateStatus.mutate({ id, value: v, paidDate })} />
                                </TableCell>
                                <TableCell className="w-10 text-right pr-2">
                                  <PurchaseRowActions
                                    purchase={p}
                                    onEdit={handleEditPurchase}
                                    onRequestDelete={setDeleteTarget}
                                  />
                                </TableCell>
                              </TableRow>
                              {expanded && hasDetails && (
                                <TableRow className="bg-muted/10 hover:bg-muted/10">
                                  <TableCell colSpan={10} className="p-0">
                                    <PurchaseRowDetail p={p} onUpdateField={handleUpdateField} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </PageContainer>
      </div>
    </div>
  );
}
