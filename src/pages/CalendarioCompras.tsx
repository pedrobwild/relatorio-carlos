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
  FileText, Truck, ArrowUpDown,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ProjectPurchase } from '@/hooks/useProjectPurchases';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { Clock, ThumbsUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PaymentSection } from '@/pages/compras/PaymentSection';

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
  /**
   * Override defensivo: embora a coluna `created_at` seja NOT NULL no banco,
   * registros antigos sincronizados ou casos de borda podem chegar sem o campo.
   * Tratamos como opcional/nulo para forçar o uso do helper `fmtRequestedDate`,
   * que já retorna "—" para null/undefined/strings inválidas.
   */
  created_at?: string | null;
}

type CalendarStatus = 'pending' | 'approved' | 'delivered' | 'delayed';

/**
 * Tons das badges de status — usam variantes claras + escuras com `dark:` para
 * manter contraste AA tanto em light quanto em dark mode. Usar tokens semânticos
 * resolveria de forma mais limpa, mas mantemos a paleta cromática (amber/blue/
 * emerald/red) para preservar o reconhecimento visual já consolidado em outras
 * telas (Compras, Painel de Obras).
 */
const calendarStatusConfig: Record<CalendarStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Pendente',  color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',           icon: Clock },
  approved:  { label: 'Aprovado',  color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40',                 icon: ThumbsUp },
  delivered: { label: 'Entregue',  color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40', icon: CheckCircle2 },
  delayed:   { label: 'Atrasado',  color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',                       icon: AlertTriangle },
};

const CALENDAR_STATUS_OPTIONS: CalendarStatus[] = ['pending', 'approved', 'delivered', 'delayed'];

function toCalendarStatus(s: string | null | undefined): CalendarStatus {
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
function StatusCell({ purchase, onSave }: { purchase: PurchaseWithProject; onSave: (id: string, v: CalendarStatus) => void }) {
  const current = toCalendarStatus(purchase.status);
  const cfg = calendarStatusConfig[current];
  const Icon = cfg.icon;
  return (
    <Select value={current} onValueChange={(v) => onSave(purchase.id, v as CalendarStatus)}>
      <SelectTrigger
        className={cn(
          // h-7 + padding fino + cor do status. `[&>span]:line-clamp-none` evita
          // que o SelectValue corte o label em uma linha muito apertada.
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
  category: string;
  supplier_name: string;
  estimated_cost: string;
  planned_purchase_date: Date | undefined;
  quantity: string;
  unit: string;
  description: string;
  notes: string;
}

const EMPTY_FORM: NewPurchaseForm = {
  project_id: '',
  item_name: '',
  category: '',
  supplier_name: '',
  estimated_cost: '',
  planned_purchase_date: undefined,
  quantity: '',
  unit: '',
  description: '',
  notes: '',
};

function NewPurchaseDialog({
  open,
  onClose,
  projects,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<NewPurchaseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => { if (open) setForm(EMPTY_FORM); }, [open]);

  const set = (field: keyof NewPurchaseForm, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

      const payload: ProjectPurchaseInsert = {
        project_id: form.project_id,
        created_by: user.id,
        item_name: form.item_name.trim(),
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
      };
      const { error } = await supabase.from('project_purchases').insert(payload);
      if (error) throw error;
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
            <Select value={form.project_id} onValueChange={(v) => set('project_id', v)}>
              <SelectTrigger className={cn('h-9', !form.project_id && 'border-destructive/50')}>
                <SelectValue placeholder="Selecionar obra…" />
              </SelectTrigger>
              <SelectContent className="z-[300]">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item — obrigatório */}
          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Item / Produto <span className="text-destructive">*</span></Label>
            <Input placeholder="Ex: Cimento CP-II, Vergalhão 10mm…" value={form.item_name}
              onChange={(e) => set('item_name', e.target.value)} className="h-9" />
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
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActualCost, setFilterActualCost] = useState<'all' | 'informed' | 'pending'>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  // Ordenação por "Solicitada em" (created_at). null = ordem padrão (planned_purchase_date asc).
  const [requestedSort, setRequestedSort] = useState<'asc' | 'desc' | null>(null);
  const toggleRequestedSort = () => {
    setRequestedSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
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
        .from('projects').select('id, name').in('id', projectIds);
      const projectMap = new Map((projects || []).map((p) => [p.id, p.name]));
      return (purchases || []).map((p) => ({
        ...p,
        project_name: projectMap.get(p.project_id) || 'Projeto',
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
        .from('projects').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
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
    mutationFn: async ({ id, value }: { id: string; value: CalendarStatus }) => {
      const { error } = await supabase.from('project_purchases').update({ status: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] }); toast.success('Status atualizado'); },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar status'); },
  });

  const updateDateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'planned_purchase_date' | 'payment_due_date'; value: string | null }) => {
      const { error } = await supabase.from('project_purchases').update({ [field]: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success(vars.field === 'planned_purchase_date' ? 'Data da compra atualizada' : 'Data de pagamento atualizada');
    },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar data'); },
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

      if (
        ['required_by_date', 'planned_purchase_date', 'order_date', 'expected_delivery_date',
         'actual_delivery_date', 'start_date', 'end_date', 'stock_entry_date', 'stock_exit_date',
         'payment_due_date'].includes(field)
      ) {
        updateValue = value && value.trim() ? value : null;
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
    onError: (e) => { console.error(e); toast.error('Erro ao salvar alteração'); },
  });

  const handleUpdateField = (id: string, field: string, value: string | null) => {
    updateField.mutate({ id, field, value });
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
      if (filterStatus !== 'all' && toCalendarStatus(p.status) !== filterStatus) return false;
      if (filterProject !== 'all' && p.project_id !== filterProject) return false;
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
  }, [allPurchases, filterStatus, filterProject, filterSupplier, filterCategory, filterActualCost, dateFromStr, dateToStr]);

  const activeFilterCount =
    (filterStatus !== 'all' ? 1 : 0) + (filterProject !== 'all' ? 1 : 0) +
    (filterSupplier !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0) +
    (filterActualCost !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus('all'); setFilterProject('all'); setFilterSupplier('all');
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

  const sortedForList = useMemo(() => {
    const base = [...filtered].filter((p) => p.planned_purchase_date);
    if (requestedSort) {
      return base.sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    }
    return base.sort((a, b) => (a.planned_purchase_date || '').localeCompare(b.planned_purchase_date || ''));
  }, [filtered, requestedSort]);

  const withoutDate = useMemo(() => {
    const base = filtered.filter((p) => !p.planned_purchase_date);
    if (requestedSort) {
      return [...base].sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    }
    return base;
  }, [filtered, requestedSort]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // KPIs
  const totalItems = filtered.length;
  const pendingItems = filtered.filter((p) => toCalendarStatus(p.status) === 'pending').length;
  const thisMonthItems = filtered.filter((p) => p.planned_purchase_date && isSameMonth(parseISO(p.planned_purchase_date), currentMonth)).length;
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

      <div className="py-6">
        <PageContainer maxWidth="full" className="space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total de Itens', value: totalItems, cls: '' },
              { label: 'Pendentes', value: pendingItems, cls: 'text-amber-600' },
              { label: 'Este Mês', value: thisMonthItems, cls: '' },
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
                            const cs = toCalendarStatus(p.status);
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
                        <TableHead className="whitespace-nowrap">Data Compra</TableHead>
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

                              <TableCell className="font-medium whitespace-nowrap">
                                <DateCell value={p.planned_purchase_date}
                                  onSave={(v) => updateDateField.mutate({ id: p.id, field: 'planned_purchase_date', value: v })} />
                              </TableCell>

                              <TableCell className="whitespace-nowrap max-w-[160px]">
                                <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block font-normal">
                                  {p.project_name}
                                </Badge>
                              </TableCell>

                              <TableCell className="max-w-[200px]">
                                <p className="font-medium truncate" title={p.item_name}>{p.item_name}</p>
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
                                <DateCell value={p.payment_due_date}
                                  onSave={(v) => updateDateField.mutate({ id: p.id, field: 'payment_due_date', value: v })} />
                              </TableCell>

                              <TableCell className="whitespace-nowrap">
                                <StatusCell purchase={p} onSave={(id, v) => updateStatus.mutate({ id, value: v })} />
                              </TableCell>
                            </TableRow>

                            {/* Expanded detail row */}
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
                      {sortedForList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
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
                                  <DateCell value={p.payment_due_date}
                                    onSave={(v) => updateDateField.mutate({ id: p.id, field: 'payment_due_date', value: v })} />
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <StatusCell purchase={p} onSave={(id, v) => updateStatus.mutate({ id, value: v })} />
                                </TableCell>
                              </TableRow>
                              {expanded && hasDetails && (
                                <TableRow className="bg-muted/10 hover:bg-muted/10">
                                  <TableCell colSpan={9} className="p-0">
                                    <PurchaseRowDetail p={p} />
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
