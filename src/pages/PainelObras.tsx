/**
 * Painel de Obras — visão executiva unificada para a equipe.
 * UX densa tipo planilha (Airtable/Monday): cabeçalho leve, linhas compactas,
 * colunas prioritárias fixas à esquerda, edição inline com affordance visual.
 */
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  X,
  AlertTriangle,
  Table2,
  ShieldOff,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Headset,
  ArrowRight,
  Plus,
  MoreHorizontal,
  Trash2,
  User,
  LayoutGrid,
  Clock,
  FileText,
  RotateCcw,
  Filter,
  Check,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader, PageToolbar, MetricCard, MetricRail, SectionCard, FilterPill } from '@/components/ui-premium';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { matchesSearch } from '@/lib/searchNormalize';
import { countBusinessDaysInclusive } from '@/lib/businessDays';
import { useUserRole } from '@/hooks/useUserRole';
import {
  ETAPA_OPTIONS,
  RELACIONAMENTO_OPTIONS,
  STATUS_OPTIONS,
  usePainelObras,
  type PainelEtapa,
  type PainelObra,
  type PainelObraPatch,
  type PainelRelacionamento,
  type PainelStatus,
} from '@/hooks/usePainelObras';
import { EmptyState } from '@/components/ui/states';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { DailyLogInline } from '@/components/admin/obras/DailyLogInline';
import { DadosClienteDialog } from '@/components/admin/obras/DadosClienteDialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton as PageSkeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

// Lazy: a aba Fornecedores carrega o módulo completo só quando ativada.
const Fornecedores = lazy(() => import('@/pages/gestao/Fornecedores'));

// ----- helpers -----
const ALL = '__all__';
type SortKey =
  | 'atraso'
  | 'inicio_oficial' | 'entrega_oficial' | 'inicio_real'
  | 'entrega_real'   | 'responsavel_nome' | null;
const NONE = '__none__';

const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) : '—';


const toIsoDate = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null);

const computeDisplayStatus = (obra: {
  status: PainelStatus | null;
  entrega_oficial: string | null;
  entrega_real: string | null;
}): PainelStatus | null => {
  const { status, entrega_oficial, entrega_real } = obra;
  if (!entrega_oficial || entrega_real) return status;
  const hojeIso = format(new Date(), 'yyyy-MM-dd');
  if (entrega_oficial < hojeIso) return 'Atrasado';
  return status;
};

/**
 * Calcula dias úteis de atraso entre `entrega_oficial` (cronograma planejado) e
 * hoje. Retorna 0 quando: não há data planejada, a obra já foi entregue
 * (`entrega_real`), está marcada como `Finalizada`, ou a entrega oficial ainda
 * é hoje/futura. Reformular o cronograma (mover `entrega_oficial` para o
 * futuro) zera o atraso automaticamente.
 */
const computeOverdueDays = (obra: {
  entrega_oficial: string | null;
  entrega_real: string | null;
  etapa: PainelEtapa | null;
}): number => {
  if (!obra.entrega_oficial) return 0;
  if (obra.entrega_real) return 0;
  if (obra.etapa === 'Finalizada') return 0;
  const hojeIso = format(new Date(), 'yyyy-MM-dd');
  if (obra.entrega_oficial >= hojeIso) return 0;
  const planned = parseISO(obra.entrega_oficial);
  const today = new Date();
  // Dias úteis entre o dia seguinte à entrega oficial e hoje (inclusivo).
  const start = new Date(planned);
  start.setDate(start.getDate() + 1);
  return countBusinessDaysInclusive(start, today);
};

const statusDotClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando': return 'bg-info';
    case 'Em dia':     return 'bg-success';
    case 'Atrasado':   return 'bg-destructive';
    case 'Paralisada': return 'bg-muted-foreground';
    default:           return 'bg-muted';
  }
};

const statusPillClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando': return 'bg-info/10 text-info border border-info/25';
    case 'Em dia':     return 'bg-success/10 text-success border border-success/25';
    case 'Atrasado':   return 'bg-destructive/10 text-destructive border border-destructive/25';
    case 'Paralisada': return 'bg-muted text-muted-foreground border border-border';
    default:           return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

const relacionamentoPillClass = (r: PainelRelacionamento | null): string => {
  switch (r) {
    case 'Normal':       return 'bg-success/10 text-success border border-success/25';
    case 'Atrito':       return 'bg-warning/10 text-warning border border-warning/25';
    case 'Insatisfeito': return 'bg-warning/15 text-warning border border-warning/30';
    case 'Crítico':      return 'bg-destructive/10 text-destructive border border-destructive/25';
    default:             return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

const editableCell =
  'group/cell w-full h-full text-left px-2 py-1 rounded-md text-sm transition-colors ' +
  'hover:bg-accent/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0';

// Ring contido (ring-inset + offset-0) usado em SelectTrigger inline em
// pills da tabela — evita que o halo de foco vaze para fora da célula
// (especialmente sobre a coluna sticky "Cliente / Obra").
const inlinePillTrigger =
  'focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0';

// ----- inline date cell -----
interface DateCellProps {
  value: string | null;
  onChange: (iso: string | null) => void;
  confirmEdit?: boolean;
  confirmTitle?: string;
  disabled?: boolean;
}

function DateCell({ value, onChange, confirmEdit, confirmTitle, disabled }: DateCellProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSelect = (d: Date | undefined) => {
    setOpen(false);
    if (confirmEdit && value) { setPending(d); setConfirmOpen(true); return; }
    onChange(toIsoDate(d));
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              editableCell,
              'flex items-center gap-1.5 tabular-nums',
              !value && 'text-muted-foreground',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <CalendarIcon className="h-3 w-3 shrink-0 opacity-60 group-hover/cell:opacity-100" />
            <span className="truncate">{fmtDate(value)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? parseISO(value) : undefined}
            onSelect={handleSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
          {value && (
            <div className="p-2 border-t border-border">
              <Button size="sm" variant="ghost" className="w-full text-destructive"
                onClick={() => {
                  setOpen(false);
                  if (confirmEdit) { setPending(undefined); setConfirmOpen(true); }
                  else onChange(null);
                }}
              >Limpar data</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {confirmTitle ?? 'Confirmar alteração'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta data representa um <strong>prazo contratual</strong> e não deve ser alterada
              rotineiramente. Tem certeza de que deseja modificá-la?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPending(undefined)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onChange(toIsoDate(pending)); setPending(undefined); }}>
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ----- main page -----
export default function PainelObras() {
  const navigate = useNavigate();
  const { isStaff, loading: roleLoading } = useUserRole();
  const { obras, isLoading, updateObra } = usePainelObras();
  const { data: staffUsers = [] } = useStaffUsers();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'fornecedores' ? 'fornecedores' : 'obras';
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'obras') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  // Modo de visualização da aba "Obras": tabela densa (default) ou kanban.
  // Persistido em URL para que o usuário compartilhe / volte na mesma visão.
  const viewParam = searchParams.get('view');
  const activeView: 'table' | 'kanban' = viewParam === 'kanban' ? 'kanban' : 'table';
  const handleViewChange = (next: 'table' | 'kanban') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'table') params.delete('view');
    else params.set('view', next);
    setSearchParams(params, { replace: true });
  };

  // Critério de agrupamento do Kanban: por etapa (default) ou por status (estilo Monday).
  // Persistido em URL para preservar a visão escolhida ao compartilhar / recarregar.
  const groupByParam = searchParams.get('groupBy');
  const kanbanGroupBy: 'etapa' | 'status' = groupByParam === 'status' ? 'status' : 'etapa';
  const handleGroupByChange = (next: 'etapa' | 'status') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'etapa') params.delete('groupBy');
    else params.set('groupBy', next);
    setSearchParams(params, { replace: true });
  };

  const [search, setSearch] = useState('');
  const [filterEtapa, setFilterEtapa] = useState<string>(ALL);
  /**
   * Filtro de status agora é multi-seleção (Set vazio = sem filtro / mostra
   * todos). Modelado como Set para performance O(1) no filtro de linhas e
   * para permitir refinar quais colunas/cards aparecem mesmo quando o
   * Kanban está agrupado por status (filtro independe da seleção visual da
   * coluna ativa). Inclui o sentinel `NONE` para representar "sem status".
   */
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(() => new Set());
  const [filterRelacionamento, setFilterRelacionamento] = useState<string>(ALL);
  const [filterResponsavel, setFilterResponsavel] = useState<string>(ALL);

  const toggleStatusFilter = (value: string) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };
  const clearStatusFilter = () => setFilterStatuses(new Set());

  /**
   * Seleção múltipla de obras no Kanban — Set de ids selecionados.
   * Vazio = nenhuma seleção (oculta a barra de ações em lote).
   * Mantida no nível da página para sobreviver a re-renders do Kanban.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const bulkUpdate = async (
    ids: string[],
    patch: { etapa?: PainelEtapa | null; status?: PainelStatus | null },
  ) => {
    if (ids.length === 0) return;
    setBulkUpdating(true);
    try {
      // Atualiza em paralelo; cada chamada é uma mutation independente.
      const results = await Promise.allSettled(ids.map((id) => updateObra(id, patch)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.success(`${ok} ${ok === 1 ? 'obra atualizada' : 'obras atualizadas'}.`);
      } else if (ok === 0) {
        toast.error('Não foi possível atualizar as obras selecionadas.');
      } else {
        toast.warning(`${ok} atualizadas, ${fail} com falha.`);
      }
      clearSelection();
    } finally {
      setBulkUpdating(false);
    }
  };

  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<PainelObra | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Popup "Dados do cliente" — abre a feature completa em dialog,
  // disparado pelo ícone de documento na coluna após Cliente/Obra.
  const [dadosTarget, setDadosTarget] = useState<PainelObra | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('soft_delete_project', { p_project_id: deleteTarget.id });
      if (error) throw error;
      toast.success(`Obra "${deleteTarget.nome}" movida para a lixeira.`);
      queryClient.invalidateQueries({ queryKey: ['painel-obras'] });
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir obra. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    let rows = obras;
    if (search.trim()) {
      rows = rows.filter((o) => matchesSearch(search, [o.nome, o.customer_name, o.responsavel_nome]));
    }
    if (filterEtapa !== ALL)
      rows = rows.filter((o) => (filterEtapa === NONE ? !o.etapa : o.etapa === filterEtapa));
    if (filterStatuses.size > 0)
      rows = rows.filter((o) => {
        const display = computeDisplayStatus(o);
        const key = display ?? NONE;
        return filterStatuses.has(key);
      });
    if (filterRelacionamento !== ALL)
      rows = rows.filter((o) =>
        filterRelacionamento === NONE ? !o.relacionamento : o.relacionamento === filterRelacionamento,
      );
    if (filterResponsavel !== ALL)
      rows = rows.filter((o) =>
        filterResponsavel === NONE ? !o.responsavel_id : o.responsavel_id === filterResponsavel,
      );
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        if (sortKey === 'atraso') {
          const av = computeOverdueDays(a);
          const bv = computeOverdueDays(b);
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
        if (!av && !bv) return 0; if (!av) return 1; if (!bv) return -1;
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    } else {
      // Ordenação padrão: entrega oficial mais próxima / já atrasada primeiro.
      // Obras já entregues (com entrega_real) e sem data vão para o final.
      rows = [...rows].sort((a, b) => {
        const aDelivered = !!a.entrega_real;
        const bDelivered = !!b.entrega_real;
        if (aDelivered !== bDelivered) return aDelivered ? 1 : -1;
        const av = a.entrega_oficial ?? '';
        const bv = b.entrega_oficial ?? '';
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return av.localeCompare(bv);
      });
    }
    return rows;
  }, [obras, search, filterEtapa, filterStatuses, filterRelacionamento, filterResponsavel, sortKey, sortDir]);

  const toggleSort = (key: NonNullable<SortKey>) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setSearch(''); setFilterEtapa(ALL); setFilterStatuses(new Set()); setFilterRelacionamento(ALL); setFilterResponsavel(ALL);
  };

  const hasFilters = !!search.trim() || filterEtapa !== ALL || filterStatuses.size > 0 || filterRelacionamento !== ALL || filterResponsavel !== ALL;

  const summary = useMemo(() => {
    const displayed = obras.map((o) => computeDisplayStatus(o));
    return {
      total:       obras.length,
      aguardando:  displayed.filter((s) => s === 'Aguardando').length,
      emDia:       displayed.filter((s) => s === 'Em dia').length,
      atrasadas:   displayed.filter((s) => s === 'Atrasado').length,
      paralisadas: displayed.filter((s) => s === 'Paralisada').length,
    };
  }, [obras]);

  if (roleLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }

  if (!isStaff) {
    return (
      <PageContainer>
        <EmptyState icon={ShieldOff} title="Acesso restrito"
          description="O Painel de Obras é exclusivo da equipe interna." />
      </PageContainer>
    );
  }

  const SortableHeader = ({ label, sortKey: k }: { label: string; sortKey: NonNullable<SortKey> }) => (
    <button type="button" onClick={() => toggleSort(k)}
      className="flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wide">
      {label}
      {sortKey === k ? (
        <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <PageContainer maxWidth="full">
        <PageHeader
          eyebrow="Operações"
          title="Painel de Obras"
          description="Cockpit operacional unificado — monitore status, prazos e relacionamento de todas as obras em execução."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/gestao/cs/operacional')} className="h-9 gap-2">
                <Headset className="h-4 w-4" />
                <span className="hidden sm:inline">Customer Success</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-60" />
              </Button>
              <Button size="sm" onClick={() => navigate('/gestao/nova-obra')} className="h-9 gap-2">
                <Plus className="h-4 w-4" />Nova obra
              </Button>
            </>
          }
          flush
        />

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Excluir obra?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Você está prestes a excluir permanentemente a obra:
                </span>
                <span className="block font-semibold text-foreground">
                  {deleteTarget?.customer_name && (
                    <>{deleteTarget.customer_name} — </>
                  )}
                  {deleteTarget?.nome}
                </span>
                <span className="block text-destructive/80 font-medium">
                  Esta ação não pode ser desfeita. Todos os dados vinculados
                  (compras, pagamentos, registros diários) serão excluídos.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Excluindo…' : 'Sim, excluir obra'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Popup "Dados do cliente" — feature completa em dialog (Contratante / Imóvel / Info). */}
        <DadosClienteDialog
          open={!!dadosTarget}
          onOpenChange={(o) => { if (!o) setDadosTarget(null); }}
          projectId={dadosTarget?.id ?? null}
          projectName={dadosTarget?.nome ?? null}
          customerName={dadosTarget?.customer_name ?? null}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
          <TabsList className="bg-surface-sunken border border-border-subtle">
            <TabsTrigger value="obras" className="text-xs data-[state=active]:bg-card">Obras</TabsTrigger>
            <TabsTrigger value="fornecedores" className="text-xs data-[state=active]:bg-card">Fornecedores</TabsTrigger>
          </TabsList>

          <TabsContent value="obras" className="mt-4 focus-visible:outline-none">
            <div>
              <MetricRail>
                <MetricCard label="Total" value={summary.total} />
                <MetricCard label="Aguardando" value={summary.aguardando} accent="info" />
                <MetricCard label="Em dia" value={summary.emDia} accent="success" />
                <MetricCard label="Atrasadas" value={summary.atrasadas} accent="destructive" />
                <MetricCard label="Paralisadas" value={summary.paralisadas} accent="muted" />
              </MetricRail>
            </div>

            <PageToolbar
              className="mt-6"
              sticky={false}
              search={
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por obra, cliente ou responsável…"
                    className="h-9 pl-8 text-sm bg-surface border-border-subtle" />
                </div>
              }
              filters={
                <>
                  {/* Filtro de status: multi-seleção via popover. Independe da
                      seleção visual da coluna no Kanban (que destaca um status
                      por vez). Permite refinar quais cards aparecem mantendo
                      múltiplas colunas/status visíveis simultaneamente. */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-[160px] justify-between text-xs border-border-subtle bg-surface px-3 font-normal"
                        aria-label="Filtrar por status"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Filter className="h-3.5 w-3.5 opacity-60" />
                          {filterStatuses.size === 0
                            ? 'Status'
                            : filterStatuses.size === 1
                              ? (() => {
                                  const only = [...filterStatuses][0];
                                  return only === NONE ? '(sem status)' : only;
                                })()
                              : `${filterStatuses.size} status`}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[220px] p-1">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Filtrar status
                        </span>
                        {filterStatuses.size > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearStatusFilter}
                            className="h-6 px-1.5 text-[11px] text-muted-foreground"
                          >
                            Limpar
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-col">
                        {[NONE, ...STATUS_OPTIONS].map((s) => {
                          const checked = filterStatuses.has(s);
                          const label = s === NONE ? '(sem status)' : s;
                          return (
                            <button
                              type="button"
                              key={`statusfilter-${s}`}
                              onClick={() => toggleStatusFilter(s)}
                              role="menuitemcheckbox"
                              aria-checked={checked}
                              className={cn(
                                'flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs text-left',
                                'hover:bg-accent hover:text-accent-foreground',
                                'focus:outline-none focus:bg-accent',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-4 w-4 items-center justify-center rounded border',
                                  checked
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-border bg-surface',
                                )}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                              {s !== NONE && (
                                <span
                                  className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusDotClass(s as PainelStatus))}
                                  aria-hidden
                                />
                              )}
                              <span className="truncate flex-1">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="px-2 pt-1.5 pb-1 text-[10px] text-muted-foreground leading-snug">
                        Vazio mostra todos. Refina cards mesmo no Kanban agrupado por status.
                      </p>
                    </PopoverContent>
                  </Popover>

                  <Select value={filterEtapa} onValueChange={setFilterEtapa}>
                    <SelectTrigger className="h-8 w-[150px] text-xs border-border-subtle bg-surface">
                      <SelectValue placeholder="Etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas etapas</SelectItem>
                      <SelectItem value={NONE}>(sem etapa)</SelectItem>
                      {ETAPA_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={filterRelacionamento} onValueChange={setFilterRelacionamento}>
                    <SelectTrigger className="h-8 w-[160px] text-xs border-border-subtle bg-surface">
                      <SelectValue placeholder="Relacionamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos relacionamentos</SelectItem>
                      <SelectItem value={NONE}>(sem relacionamento)</SelectItem>
                      {RELACIONAMENTO_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                    <SelectTrigger className="h-8 w-[170px] text-xs border-border-subtle bg-surface">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos responsáveis</SelectItem>
                      <SelectItem value={NONE}>(sem responsável)</SelectItem>
                      {staffUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {hasFilters && (
                    <Button size="sm" variant="ghost" onClick={clearFilters}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5 mr-1" />Limpar
                    </Button>
                  )}
                </>
              }
              meta={
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span className="font-semibold text-foreground">{filtered.length}</span>
                    <span className="opacity-60"> / {obras.length} obras</span>
                  </span>
                  {/* Ordenação visível no Kanban (no modo Tabela é feita pelos cabeçalhos) */}
                  {activeView === 'kanban' && (
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={sortKey ?? 'default'}
                        onValueChange={(v) => {
                          if (v === 'default') { setSortKey(null); setSortDir('asc'); }
                          else { setSortKey(v as NonNullable<SortKey>); }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Ordenar cards">
                          <SelectValue placeholder="Ordenar por" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Entrega + próxima (padrão)</SelectItem>
                          <SelectItem value="entrega_oficial">Entrega oficial</SelectItem>
                          <SelectItem value="inicio_oficial">Início oficial</SelectItem>
                          <SelectItem value="entrega_real">Entrega real</SelectItem>
                          <SelectItem value="inicio_real">Início real</SelectItem>
                          <SelectItem value="responsavel_nome">Responsável</SelectItem>
                          <SelectItem value="atraso">Atraso</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                        disabled={!sortKey}
                        className="h-8 px-2 text-xs"
                        aria-label={`Direção: ${sortDir === 'asc' ? 'crescente' : 'decrescente'}`}
                        title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
                      >
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </Button>
                    </div>
                  )}
                  {/* Toggle de visualização: Tabela (densa) ou Kanban (por etapa) */}
                  <div
                    role="group"
                    aria-label="Modo de visualização"
                    className="inline-flex items-center rounded-md border border-border-subtle bg-surface p-0.5"
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant={activeView === 'table' ? 'secondary' : 'ghost'}
                      aria-pressed={activeView === 'table'}
                      onClick={() => handleViewChange('table')}
                      className="h-7 gap-1.5 px-2 text-xs"
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Tabela</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeView === 'kanban' ? 'secondary' : 'ghost'}
                      aria-pressed={activeView === 'kanban'}
                      onClick={() => handleViewChange('kanban')}
                      className="h-7 gap-1.5 px-2 text-xs"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Kanban</span>
                    </Button>
                  </div>
                </div>
              }
            />

            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-96 w-full rounded-xl" />
              ) : filtered.length === 0 ? (
                <SectionCard>
                  <EmptyState icon={Table2}
                    title={obras.length === 0 ? 'Nenhuma obra cadastrada' : 'Nenhum resultado'}
                    description={obras.length === 0 ? 'Crie uma nova obra a partir do botão acima.' : 'Tente ajustar ou limpar os filtros.'} />
                </SectionCard>
              ) : activeView === 'kanban' ? (
                <KanbanView
                  obras={filtered}
                  groupBy={kanbanGroupBy}
                  onGroupByChange={handleGroupByChange}
                  selectedEtapa={filterEtapa}
                  onSelectEtapa={setFilterEtapa}
                  filterStatuses={filterStatuses}
                  onToggleStatusFilter={toggleStatusFilter}
                  onClearStatusFilter={clearStatusFilter}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelectId}
                  onClearSelection={clearSelection}
                  onBulkUpdate={bulkUpdate}
                  bulkUpdating={bulkUpdating}
                  onOpen={(id) => navigate(`/obra/${id}`)}
                  onUpdateEtapa={(id, etapa) => updateObra(id, { etapa })}
                  onUpdateStatus={(id, status) => updateObra(id, { status })}
                />
              ) : (
                <SectionCard flush>
                  <div className="overflow-x-auto">
                    <Table className="w-full text-sm [&_th]:h-11 [&_th]:sticky [&_th]:top-0 [&_th]:z-table-header [&_td]:py-3 [&_td]:px-3 [&_th]:px-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-muted-foreground [&_th]:bg-surface-sunken [&_th]:uppercase [&_th]:tracking-[0.04em] [&_tr]:border-border-subtle">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border-subtle">
                          <TableHead data-testid="painel-obras-th-cliente" className="w-[240px] min-w-[240px] max-w-[240px] sticky left-0 z-table-header-corner-left bg-surface-sunken border-r border-border-subtle">Cliente / Obra</TableHead>
                          <TableHead className="w-[60px] text-center" aria-label="Dados do cliente">Dados</TableHead>
                          <TableHead data-testid="painel-obras-th-status" className="min-w-[120px]">Status</TableHead>
                          <TableHead className="min-w-[140px]">Etapa</TableHead>
                          <TableHead className="min-w-[120px] text-right">Progresso</TableHead>
                          <TableHead className="min-w-[100px]"><SortableHeader label="Início Of." sortKey="inicio_oficial" /></TableHead>
                          <TableHead className="min-w-[100px]"><SortableHeader label="Entrega Of." sortKey="entrega_oficial" /></TableHead>
                          <TableHead className="min-w-[100px]"><SortableHeader label="Início Real" sortKey="inicio_real" /></TableHead>
                          <TableHead className="min-w-[100px]"><SortableHeader label="Entrega Real" sortKey="entrega_real" /></TableHead>
                          <TableHead className="min-w-[130px]">Relacionamento</TableHead>
                          <TableHead className="min-w-[150px]"><SortableHeader label="Responsável" sortKey="responsavel_nome" /></TableHead>
                          <TableHead className="min-w-[110px] text-right"><SortableHeader label="Atraso" sortKey="atraso" /></TableHead>
                          <TableHead className="w-16 sticky right-0 z-table-header-corner-right bg-surface-sunken border-l border-border-subtle" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((o) => (
                          <ObraRow
                            key={o.id}
                            obra={o}
                            staffUsers={staffUsers}
                            expanded={expandedIds.has(o.id)}
                            onToggleExpanded={() => toggleExpanded(o.id)}
                            onUpdate={(patch) => updateObra(o.id, patch)}
                            onOpen={() => navigate(`/obra/${o.id}`)}
                            onDeleteRequest={() => setDeleteTarget(o)}
                            onOpenDados={() => setDadosTarget(o)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </SectionCard>
              )}
            </div>
          </TabsContent>

          <TabsContent value="fornecedores" className="mt-4 focus-visible:outline-none">
            <Suspense fallback={
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Carregando fornecedores">
                <PageSkeleton className="h-10 w-64" />
                <PageSkeleton className="h-32 w-full" />
                <PageSkeleton className="h-96 w-full" />
              </div>
            }>
              <Fornecedores />
            </Suspense>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </TooltipProvider>
  );
}

// ----- row component -----
// Total de colunas da tabela do Painel de Obras. Mantenha em sincronia com o
// <TableHeader> acima e com as <TableCell> de <ObraRow>:
// 1) Cliente / Obra · 2) Dados · 3) Status · 4) Etapa · 5) Progresso ·
// 6) Início Of. · 7) Entrega Of. · 8) Início Real · 9) Entrega Real ·
// 10) Relacionamento · 11) Responsável · 12) Atraso · 13) Ações
const PAINEL_COLUMN_COUNT = 13;

interface ObraRowProps {
  obra: PainelObra;
  staffUsers: { id: string; nome: string }[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (patch: PainelObraPatch) => void;
  onOpen: () => void;
  onDeleteRequest: () => void;
  /** Abre o popup com a feature "Dados do cliente" para esta obra. */
  onOpenDados: () => void;
}

function ObraRow({ obra, staffUsers, expanded, onToggleExpanded, onUpdate, onOpen, onDeleteRequest, onOpenDados }: ObraRowProps) {
  const stickyBase = 'bg-card group-hover:bg-accent/40 transition-colors';

  return (
    <>
      <TableRow data-testid="painel-obras-row" data-expanded={expanded ? 'true' : 'false'} className={cn('group transition-colors hover:bg-accent/40', expanded && 'bg-accent/25 hover:bg-accent/30')}>
        {/* Cliente / Obra — sticky left */}
        <TableCell
          data-testid="painel-obras-cell-cliente"
          className={cn(
            'sticky left-0 z-sticky-left border-r border-border shadow-[1px_0_0_0_hsl(var(--border))] w-[240px] max-w-[240px]',
            // overflow-hidden na própria célula impede que halo/ring de
            // foco interno (botões, links) vaze para fora da coluna sticky.
            'overflow-hidden',
            // Fundo SEMPRE opaco (bg-card) — nunca aplicar tonalidades
            // translúcidas (`bg-accent/25`) aqui, porque elas permitem que
            // badges/conteúdo de colunas não-sticky apareçam por baixo
            // durante o scroll horizontal ou linha expandida.
            stickyBase,
          )}
        >
          <div className="flex items-start gap-1.5 min-w-0 max-w-full">
            <Button type="button" size="icon" variant="ghost" onClick={onToggleExpanded}
              aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'} aria-expanded={expanded}
              className="h-6 w-6 shrink-0 mt-0.5 text-muted-foreground hover:text-primary hover:bg-transparent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0">
              <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-90 text-primary')} />
            </Button>
            <button type="button" onClick={onOpen}
              // ring-inset + offset-0 mantém o halo de foco DENTRO do botão,
              // evitando vazamento visual sobre a borda da célula sticky.
              className="text-left flex flex-col gap-0.5 flex-1 min-w-0 max-w-full overflow-hidden group/link focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0 rounded-md px-0.5"
              title={`${obra.customer_name ?? 'Sem cliente'} — ${obra.nome ?? ''}`.trim()}
            >
              <span className="flex items-center gap-1.5 min-w-0 max-w-full w-full">
                <span className="font-semibold text-sm truncate [overflow-wrap:anywhere] group-hover/link:text-primary transition-colors min-w-0 flex-1">
                  {obra.customer_name ?? 'Sem cliente'}
                </span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" aria-hidden="true" />
              </span>
              <span className="block text-xs text-muted-foreground truncate [overflow-wrap:anywhere] min-w-0 max-w-full w-full">
                {obra.nome ?? '—'}
              </span>
            </button>
          </div>
        </TableCell>

        {/* Dados do cliente — abre popup com a feature completa (Contratante / Imóvel / Info). */}
        <TableCell className="w-[60px] text-center align-middle">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onOpenDados}
                aria-label={`Abrir dados do cliente da obra ${obra.nome ?? ''}`}
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-accent/60"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Dados do cliente</TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Status */}
        <TableCell className="min-w-[120px] relative z-table-body overflow-hidden">
          {(() => {
            const displayStatus = computeDisplayStatus(obra);
            const isAuto = displayStatus === 'Atrasado' && obra.status !== 'Atrasado';
            const autoHint =
              'Atraso automático: Entrega Oficial vencida sem Entrega Real preenchida. ' +
              (obra.status ? `Valor salvo: "${obra.status}".` : 'Nenhum status salvo.');
            return (
              <Select value={obra.status ?? NONE}
                onValueChange={(v) => onUpdate({ status: v === NONE ? null : (v as PainelStatus) })}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SelectTrigger
                      className={cn('h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start gap-1.5 rounded-md', inlinePillTrigger, statusPillClass(displayStatus))}
                      aria-label={isAuto ? autoHint : undefined}>
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusDotClass(displayStatus))} />
                      <span className="font-medium truncate">{displayStatus ?? 'Definir'}</span>
                      {isAuto && <AlertTriangle className="h-3 w-3 opacity-70 shrink-0" aria-hidden />}
                    </SelectTrigger>
                  </TooltipTrigger>
                  {isAuto && <TooltipContent side="top" className="max-w-[280px] text-xs">{autoHint}</TooltipContent>}
                </Tooltip>
                <SelectContent>
                  <SelectItem value={NONE}>(nenhum)</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />{s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}
        </TableCell>

        {/* Etapa */}
        <TableCell className="min-w-[140px] relative z-table-body overflow-hidden">
          <Select value={obra.etapa ?? NONE}
            onValueChange={(v) => onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })}>
            <SelectTrigger className={cn('h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 hover:bg-accent/60 [&>svg]:opacity-40 [&>svg]:ml-1 rounded-md',
              inlinePillTrigger,
              !obra.etapa && 'text-muted-foreground italic',
              obra.etapa === 'Finalizada' && 'text-success font-medium',
              obra.etapa === 'Vistoria reprovada' && 'text-destructive font-medium')}>
              <SelectValue placeholder="Definir…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(nenhuma)</SelectItem>
              {ETAPA_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>
                  <span className={cn(e === 'Finalizada' && 'text-success font-medium', e === 'Vistoria reprovada' && 'text-destructive font-medium')}>{e}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Progresso */}
        <TableCell className="text-right">
          {obra.progress_percentage != null ? (
            <div className="flex items-center justify-end gap-2">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full transition-all', obra.progress_percentage >= 100 ? 'bg-success' : 'bg-primary')}
                  style={{ width: `${Math.min(100, obra.progress_percentage)}%` }} />
              </div>
              <span className={cn('text-xs tabular-nums w-9 text-right', obra.progress_percentage >= 100 && 'text-success font-semibold')}>
                {obra.progress_percentage}%
              </span>
            </div>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>

        {/* Datas */}
        <TableCell><DateCell value={obra.inicio_oficial} onChange={(v) => onUpdate({ inicio_oficial: v })} confirmEdit confirmTitle="Alterar início oficial?" /></TableCell>
        <TableCell><DateCell value={obra.entrega_oficial} onChange={(v) => onUpdate({ entrega_oficial: v })} confirmEdit confirmTitle="Alterar entrega oficial?" /></TableCell>
        <TableCell><DateCell value={obra.inicio_real} onChange={(v) => onUpdate({ inicio_real: v })} /></TableCell>
        <TableCell><DateCell value={obra.entrega_real} onChange={(v) => onUpdate({ entrega_real: v })} /></TableCell>

        {/* Relacionamento */}
        <TableCell className="min-w-[110px] relative z-table-body overflow-hidden">
          <Select value={obra.relacionamento ?? NONE}
            onValueChange={(v) => onUpdate({ relacionamento: v === NONE ? null : (v as PainelRelacionamento) })}>
            <SelectTrigger className={cn('h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start rounded-md', inlinePillTrigger, relacionamentoPillClass(obra.relacionamento))}>
              <span className="font-medium truncate">{obra.relacionamento ?? 'Definir'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(nenhum)</SelectItem>
              {RELACIONAMENTO_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Responsável */}
        <TableCell className="min-w-[150px] relative z-table-body overflow-hidden">
          <Select
            value={obra.responsavel_id ?? NONE}
            onValueChange={(v) => onUpdate({ responsavel_id: v === NONE ? null : v })}
          >
            <SelectTrigger
              className={cn(
                'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:opacity-40 [&>svg]:ml-1 hover:bg-accent/60 rounded-md justify-start gap-1.5',
                inlinePillTrigger,
                !obra.responsavel_id && 'text-muted-foreground italic',
              )}
              aria-label="Responsável pela obra"
            >
              <User className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate font-medium">
                {obra.responsavel_nome ?? (obra.responsavel_id ? '—' : 'Definir')}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(sem responsável)</SelectItem>
              {staffUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Atraso (dias úteis vs. cronograma planejado) */}
        <TableCell className="text-right tabular-nums">
          {(() => {
            const dias = computeOverdueDays(obra);
            if (dias <= 0) {
              return <span className="text-xs text-muted-foreground">—</span>;
            }
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold',
                      dias > 10
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-warning/15 text-warning-foreground',
                    )}
                    aria-label={`${dias} dias úteis de atraso`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {dias}d
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {dias} dia{dias === 1 ? '' : 's'} útil{dias === 1 ? '' : 'eis'} de atraso vs. entrega oficial. Ajuste o cronograma para zerar.
                </TooltipContent>
              </Tooltip>
            );
          })()}
        </TableCell>

        <TableCell className={cn(
          'sticky right-0 z-sticky-right border-l border-border',
          // Fundo SEMPRE opaco (bg-card) — sem tonalidades translúcidas para
          // garantir que conteúdo de colunas não-sticky (badges de Status/
          // Etapa/Relacionamento) não apareça por baixo desta coluna durante
          // scroll horizontal ou quando a linha está expandida.
          stickyBase,
        )}>
          <div className="flex items-center justify-center gap-0.5">
            {/* Abrir obra */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={onOpen} aria-label="Abrir obra">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Abrir obra</TooltipContent>
            </Tooltip>

            {/* Quick actions menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                      aria-label="Mais ações">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">Mais ações</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onOpen} className="text-xs gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />Abrir obra
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeleteRequest}
                  className="text-xs gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />Excluir obra
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow data-testid="painel-obras-row-expanded" className="bg-accent/15 hover:bg-accent/15">
          <TableCell
            colSpan={PAINEL_COLUMN_COUNT}
            className="p-0 border-t border-b-2 border-primary/20 align-top"
          >
            <ExpandedRowContent projectId={obra.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * ExpandedRowContent — renderiza o conteúdo expandido alinhado às colunas
 * da linha pai. Usa um wrapper interno `position: sticky; left: 0` que
 * acompanha o scroll horizontal da tabela e fica preso à largura visível
 * do container scrollável, evitando que o formulário "vaze" para fora do
 * viewport útil ou cresça o bloco horizontalmente.
 *
 * Estratégia:
 *  - O <td colSpan> ocupa naturalmente toda a largura da tabela (somatório
 *    das colunas), mantendo o alinhamento visual com a linha pai.
 *  - O conteúdo interno usa `sticky left-0` + largura medida do scroller
 *    horizontal (overflow-x-auto), garantindo que o formulário caiba
 *    exatamente na área visível, sem provocar scroll vertical extra.
 */
function ExpandedRowContent({ projectId }: { projectId: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let scroller: HTMLElement | null = node.parentElement;
    while (scroller && scroller !== document.body) {
      const style = window.getComputedStyle(scroller);
      if (/(auto|scroll)/.test(style.overflowX)) break;
      scroller = scroller.parentElement;
    }
    const target = scroller ?? document.documentElement;
    const update = () => setWidth(target.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(target);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="sticky left-0 max-w-full overflow-hidden"
      style={width ? { width: `${width}px` } : undefined}
    >
      <div className="min-w-0 w-full px-3 sm:px-4 py-3 sm:py-4">
        <DailyLogInline projectId={projectId} />
      </div>
    </div>
  );
}

// ----- Kanban view -----
// Visão de quadro estilo Monday: o usuário escolhe o critério de
// agrupamento (etapa ou status), reordena colunas manualmente
// (persistido em localStorage por critério) ou ativa modo automático
// que segue a ordenação ativa da tabela.
type KanbanGroupBy = 'etapa' | 'status';
type KanbanColKey = string; // PainelEtapa | PainelStatus | 'none'

const ETAPA_COL_ORDER: KanbanColKey[] = [
  'none',
  ...(ETAPA_OPTIONS as readonly PainelEtapa[]),
];
const ETAPA_COL_LABELS: Record<string, string> = {
  none: 'Sem etapa',
  ...(Object.fromEntries(ETAPA_OPTIONS.map((e) => [e, e])) as Record<PainelEtapa, string>),
};

// Ordem dos status segue o ciclo de vida operacional:
// Aguardando (preparação) → Em dia (executando) → Atrasado (alerta) →
// Paralisada (bloqueio). "Sem status" entra primeiro como bucket de
// triagem para obras ainda não classificadas.
const STATUS_COL_ORDER: KanbanColKey[] = [
  'none',
  ...(STATUS_OPTIONS as readonly PainelStatus[]),
];
const STATUS_COL_LABELS: Record<string, string> = {
  none: 'Sem status',
  ...(Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s])) as Record<PainelStatus, string>),
};

function getDefaultOrderFor(groupBy: KanbanGroupBy): KanbanColKey[] {
  return groupBy === 'status' ? STATUS_COL_ORDER : ETAPA_COL_ORDER;
}

/**
 * Cor de acento (faixa do header da coluna) — referencial visual estilo Monday.
 * Para `groupBy=status` usamos a paleta semântica já existente; para `etapa`
 * mapeamos cores frias (preparação) → quentes (execução) → verde (entrega).
 */
function getColumnAccent(groupBy: KanbanGroupBy, key: KanbanColKey): string {
  if (key === 'none') return 'bg-muted-foreground/30';
  if (groupBy === 'status') {
    switch (key as PainelStatus) {
      case 'Aguardando': return 'bg-info';
      case 'Em dia':     return 'bg-success';
      case 'Atrasado':   return 'bg-destructive';
      case 'Paralisada': return 'bg-muted-foreground';
      default:           return 'bg-muted-foreground/30';
    }
  }
  switch (key as PainelEtapa) {
    case 'Medição':            return 'bg-sky-400';
    case 'Executivo':          return 'bg-indigo-400';
    case 'Emissão RRT':        return 'bg-violet-400';
    case 'Condomínio':         return 'bg-purple-400';
    case 'Planejamento':       return 'bg-blue-400';
    case 'Mobilização':        return 'bg-amber-400';
    case 'Execução':           return 'bg-orange-400';
    case 'Vistoria':           return 'bg-teal-400';
    case 'Vistoria reprovada': return 'bg-destructive';
    case 'Finalizada':         return 'bg-success';
    default:                   return 'bg-muted-foreground/30';
  }
}
function getLabelsFor(groupBy: KanbanGroupBy): Record<string, string> {
  return groupBy === 'status' ? STATUS_COL_LABELS : ETAPA_COL_LABELS;
}
function getStorageKeyFor(groupBy: KanbanGroupBy): string {
  return groupBy === 'status'
    ? 'painelObras:kanbanColumnOrder:status:v1'
    : 'painelObras:kanbanColumnOrder:etapa:v1';
}

function loadKanbanOrder(groupBy: KanbanGroupBy): KanbanColKey[] {
  const fallback = getDefaultOrderFor(groupBy);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(getStorageKeyFor(groupBy));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const valid = parsed.filter((k): k is KanbanColKey =>
      typeof k === 'string' && (fallback as string[]).includes(k),
    );
    // Acrescenta opções novas (ainda não vistas) ao final, preservando ordem do usuário.
    const missing = fallback.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return fallback;
  }
}

// Layout das colunas (manual vs automático) também é persistido por critério —
// trocar entre Etapa/Status preserva a preferência feita em cada um.
type KanbanLayoutMode = 'manual' | 'auto';
function getLayoutStorageKeyFor(groupBy: KanbanGroupBy): string {
  return groupBy === 'status'
    ? 'painelObras:kanbanLayoutMode:status:v1'
    : 'painelObras:kanbanLayoutMode:etapa:v1';
}
function loadKanbanLayoutMode(groupBy: KanbanGroupBy): KanbanLayoutMode {
  if (typeof window === 'undefined') return 'manual';
  try {
    const raw = window.localStorage.getItem(getLayoutStorageKeyFor(groupBy));
    return raw === 'auto' ? 'auto' : 'manual';
  } catch {
    return 'manual';
  }
}

interface KanbanViewProps {
  obras: PainelObra[];
  /** Critério de agrupamento (define colunas, label, edição inline, filtros). */
  groupBy: KanbanGroupBy;
  onGroupByChange: (next: KanbanGroupBy) => void;
  /** Filtro de etapa: seleção única (chip ativo == filtro vigente). */
  selectedEtapa: string;
  onSelectEtapa: (value: string) => void;
  /** Filtro de status: multi-seleção (Set vazio = todos). Os chips de status
   *  toggleam membros do Set, permitindo refinar mantendo várias colunas
   *  visíveis ao mesmo tempo (independente do agrupamento ativo). */
  filterStatuses: Set<string>;
  onToggleStatusFilter: (value: string) => void;
  onClearStatusFilter: () => void;
  /** Critério atual de ordenação da tabela (compartilhado com o Kanban). */
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  /** Seleção múltipla: ids de obras marcadas para ação em lote. */
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onBulkUpdate: (
    ids: string[],
    patch: { etapa?: PainelEtapa | null; status?: PainelStatus | null },
  ) => Promise<void>;
  bulkUpdating: boolean;
  onOpen: (id: string) => void;
  onUpdateEtapa: (id: string, etapa: PainelEtapa | null) => void;
  onUpdateStatus: (id: string, status: PainelStatus | null) => void;
}

function KanbanView({
  obras,
  groupBy,
  onGroupByChange,
  selectedEtapa,
  onSelectEtapa,
  filterStatuses,
  onToggleStatusFilter,
  onClearStatusFilter,
  sortKey,
  sortDir,
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onBulkUpdate,
  bulkUpdating,
  onOpen,
  onUpdateEtapa,
  onUpdateStatus,
}: KanbanViewProps) {
  const labels = getLabelsFor(groupBy);
  const defaultOrder = getDefaultOrderFor(groupBy);

  // Ordem das colunas é persistida por critério; troca de critério remonta o estado.
  const [order, setOrder] = useState<KanbanColKey[]>(() => loadKanbanOrder(groupBy));
  useEffect(() => {
    setOrder(loadKanbanOrder(groupBy));
  }, [groupBy]);
  useEffect(() => {
    try {
      window.localStorage.setItem(getStorageKeyFor(groupBy), JSON.stringify(order));
    } catch {
      /* ignore (modo privado, quota etc.) */
    }
  }, [order, groupBy]);

  const moveColumn = (key: KanbanColKey, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const resetOrder = () => setOrder(defaultOrder);
  const isCustomOrder = useMemo(
    () => order.some((k, i) => k !== defaultOrder[i]),
    [order, defaultOrder],
  );

  // Resolve o "valor de coluna" de uma obra conforme o critério.
  // Para status, usamos `computeDisplayStatus` para refletir a mesma lógica
  // visual da tabela (e.g., obras com entrega oficial vencida aparecem como
  // "Atrasado" mesmo sem flag manual).
  const colKeyOf = (o: PainelObra): KanbanColKey => {
    if (groupBy === 'status') {
      return (computeDisplayStatus(o) as PainelStatus | null) ?? 'none';
    }
    return (o.etapa as PainelEtapa | null) ?? 'none';
  };

  // Agrupamento O(n) por coluna para renderização.
  const grouped = useMemo(() => {
    const map = new Map<KanbanColKey, PainelObra[]>();
    order.forEach((k) => map.set(k, []));
    for (const o of obras) {
      const key = colKeyOf(o);
      const arr = map.get(key);
      if (arr) arr.push(o);
      else map.get('none')?.push(o);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras, order, groupBy]);

  // Helpers de "chip ativo" e "ação ao clicar no chip" por critério:
  // - Etapa: single-select clássico (clica = filtra; reclicar = limpa).
  // - Status: multi-select que reflete o popover de status na toolbar
  //   (clica = toggle no Set; chip aparece marcado se status está no filtro).
  const isChipActive = (filterValue: string): boolean => {
    if (groupBy === 'status') return filterStatuses.has(filterValue);
    return selectedEtapa === filterValue;
  };
  const onChipClick = (filterValue: string): void => {
    if (groupBy === 'status') {
      onToggleStatusFilter(filterValue);
      return;
    }
    onSelectEtapa(selectedEtapa === filterValue ? ALL : filterValue);
  };
  const hasGroupFilter = groupBy === 'status' ? filterStatuses.size > 0 : selectedEtapa !== ALL;
  const clearGroupFilter = () => {
    if (groupBy === 'status') onClearStatusFilter();
    else onSelectEtapa(ALL);
  };

  // Modo de layout das colunas (manual vs auto pela ordenação ativa).
  // Persistido em localStorage por critério de agrupamento — ao recarregar
  // a página ou alternar Etapa/Status, voltamos no mesmo modo escolhido.
  const [layoutMode, setLayoutMode] = useState<KanbanLayoutMode>(() =>
    loadKanbanLayoutMode(groupBy),
  );
  // Ao trocar o critério de agrupamento, recarrega a preferência salva
  // daquele critério (cada um tem seu próprio modo).
  useEffect(() => {
    setLayoutMode(loadKanbanLayoutMode(groupBy));
  }, [groupBy]);
  // Persiste sempre que o usuário alterna entre manual/auto.
  useEffect(() => {
    try {
      window.localStorage.setItem(getLayoutStorageKeyFor(groupBy), layoutMode);
    } catch {
      /* ignore (modo privado, quota etc.) */
    }
  }, [layoutMode, groupBy]);

  const aggregateByCol = useMemo(() => {
    const agg = new Map<KanbanColKey, { num: number | null; str: string | null }>();
    for (const key of order) {
      const items = grouped.get(key) ?? [];
      if (items.length === 0) { agg.set(key, { num: null, str: null }); continue; }
      if (sortKey === 'atraso') {
        const max = Math.max(...items.map((o) => computeOverdueDays(o)));
        agg.set(key, { num: max, str: null });
      } else if (sortKey === 'responsavel_nome') {
        const names = items.map((o) => o.responsavel_nome ?? '').filter(Boolean).sort();
        agg.set(key, { num: null, str: names[0] ?? null });
      } else if (sortKey) {
        const dates = items.map((o) => o[sortKey] ?? '').filter(Boolean).sort();
        agg.set(key, { num: null, str: dates[0] ?? null });
      } else {
        agg.set(key, { num: null, str: null });
      }
    }
    return agg;
  }, [order, grouped, sortKey]);

  const displayedOrder = useMemo<KanbanColKey[]>(() => {
    if (layoutMode === 'manual' || !sortKey) return order;
    const withVal: KanbanColKey[] = [];
    const empty: KanbanColKey[] = [];
    for (const k of order) {
      const items = grouped.get(k) ?? [];
      (items.length === 0 ? empty : withVal).push(k);
    }
    withVal.sort((a, b) => {
      const va = aggregateByCol.get(a);
      const vb = aggregateByCol.get(b);
      if (sortKey === 'atraso') {
        const an = va?.num ?? -Infinity;
        const bn = vb?.num ?? -Infinity;
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      const sa = va?.str ?? '';
      const sb = vb?.str ?? '';
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return [...withVal, ...empty];
  }, [layoutMode, sortKey, sortDir, order, grouped, aggregateByCol]);

  const autoAvailable = !!sortKey;
  const isAuto = layoutMode === 'auto' && autoAvailable;

  // Bulk action handlers — recebem o novo valor e disparam onBulkUpdate.
  const handleBulkChangeEtapa = (value: string) => {
    const next = value === NONE ? null : (value as PainelEtapa);
    void onBulkUpdate(Array.from(selectedIds), { etapa: next });
  };
  const handleBulkChangeStatus = (value: string) => {
    const next = value === NONE ? null : (value as PainelStatus);
    void onBulkUpdate(Array.from(selectedIds), { status: next });
  };

  return (
    <SectionCard flush>
      {/* Barra de ações em lote — visível só quando há seleção. Sticky no topo
          do quadro para permanecer acessível durante o scroll horizontal. */}
      {selectedIds.size > 0 && (
        <div
          role="region"
          aria-label="Ações em lote"
          className="sticky top-0 z-sticky flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border-subtle bg-primary/10 backdrop-blur"
        >
          <span className="text-xs font-medium text-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'obra selecionada' : 'obras selecionadas'}
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select
              value=""
              onValueChange={handleBulkChangeEtapa}
              disabled={bulkUpdating}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs bg-surface" aria-label="Mudar etapa em lote">
                <SelectValue placeholder="Mudar etapa…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(sem etapa)</SelectItem>
                {ETAPA_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value=""
              onValueChange={handleBulkChangeStatus}
              disabled={bulkUpdating}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs bg-surface" aria-label="Mudar status em lote">
                <SelectValue placeholder="Mudar status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(sem status)</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={onClearSelection}
              disabled={bulkUpdating}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

      {/* Toggle do critério de agrupamento (estilo Monday). */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 flex-wrap">
        <div
          role="group"
          aria-label="Agrupar quadro por"
          className="inline-flex items-center rounded-md border border-border-subtle bg-surface p-0.5"
        >
          <span className="px-2 text-[11px] text-muted-foreground">Agrupar por</span>
          <Button
            type="button"
            size="sm"
            variant={groupBy === 'etapa' ? 'secondary' : 'ghost'}
            aria-pressed={groupBy === 'etapa'}
            onClick={() => onGroupByChange('etapa')}
            className="h-7 px-2 text-xs"
          >
            Etapa
          </Button>
          <Button
            type="button"
            size="sm"
            variant={groupBy === 'status' ? 'secondary' : 'ghost'}
            aria-pressed={groupBy === 'status'}
            onClick={() => onGroupByChange('status')}
            className="h-7 px-2 text-xs"
          >
            Status
          </Button>
        </div>
      </div>

      {/* Filtro por coluna agora é feito clicando no header da própria coluna —
          o resumo redundante foi removido para reduzir ruído visual. */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 flex-wrap">
        {/* Toggle de layout das colunas: manual vs automático (segue ordenação). */}
        <div
          role="group"
          aria-label="Layout das colunas"
          className="inline-flex items-center rounded-md border border-border-subtle bg-surface p-0.5"
        >
          <Button
            type="button"
            size="sm"
            variant={!isAuto ? 'secondary' : 'ghost'}
            aria-pressed={!isAuto}
            onClick={() => setLayoutMode('manual')}
            className="h-7 gap-1.5 px-2 text-xs"
            title="Definir a ordem manualmente"
          >
            Manual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isAuto ? 'secondary' : 'ghost'}
            aria-pressed={isAuto}
            disabled={!autoAvailable}
            onClick={() => setLayoutMode('auto')}
            className="h-7 gap-1.5 px-2 text-xs"
            title={autoAvailable
              ? 'Reordenar pelas colunas conforme o critério de ordenação ativo'
              : 'Selecione um critério de ordenação para usar o modo automático'}
          >
            Automático
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasGroupFilter && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearGroupFilter}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar filtro de {groupBy === 'status' ? 'status' : 'etapa'}
            </Button>
          )}
          {isAuto && (
            <span className="text-[11px] text-muted-foreground">
              Ordem automática pelo critério da tabela
            </span>
          )}
          {!isAuto && isCustomOrder && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetOrder}
              className="h-7 px-2 text-xs"
              title="Restaurar a ordem padrão das colunas"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Restaurar ordem
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto p-3">
        <div className="flex gap-3 min-w-max items-start">
          {displayedOrder.map((key, idx) => {
            const items = grouped.get(key) ?? [];
            const label = labels[key] ?? key;
            const canMoveLeft = !isAuto && idx > 0;
            const canMoveRight = !isAuto && idx < displayedOrder.length - 1;
            const filterValue = key === 'none' ? NONE : key;
            const isActive = isChipActive(filterValue);
            const accent = getColumnAccent(groupBy, key);
            return (
              <div
                key={`${groupBy}-${key}`}
                className={cn(
                  'flex flex-col w-[280px] shrink-0 rounded-lg bg-surface-sunken border overflow-hidden transition-colors',
                  isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border-subtle',
                )}
              >
                {/* Faixa colorida estilo Monday no topo da coluna */}
                <div className={cn('h-1 w-full shrink-0', accent)} aria-hidden />
                <button
                  type="button"
                  onClick={() => onChipClick(filterValue)}
                  aria-pressed={isActive}
                  aria-label={`Filtrar por ${label}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle hover:bg-surface/60 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {label}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground bg-muted rounded-full px-1.5 min-w-[20px] text-center shrink-0">
                      {items.length}
                    </span>
                  </div>
                  {!isAuto && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                          aria-label={`Opções da coluna ${label}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[180px]">
                        <DropdownMenuItem
                          disabled={!canMoveLeft}
                          onClick={() => moveColumn(key, -1)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-2" />
                          Mover para a esquerda
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canMoveRight}
                          onClick={() => moveColumn(key, 1)}
                        >
                          <ChevronRight className="h-3.5 w-3.5 mr-2" />
                          Mover para a direita
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </button>
                <div className="flex flex-col gap-1.5 p-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-6 italic">
                      Nenhuma obra
                    </p>
                  ) : (
                    items.map((o) => (
                      <KanbanCard
                        key={o.id}
                        obra={o}
                        groupBy={groupBy}
                        selected={selectedIds.has(o.id)}
                        anySelected={selectedIds.size > 0}
                        onToggleSelect={() => onToggleSelect(o.id)}
                        onOpen={() => onOpen(o.id)}
                        onChangeEtapa={(e) => onUpdateEtapa(o.id, e)}
                        onChangeStatus={(s) => onUpdateStatus(o.id, s)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

interface KanbanCardProps {
  obra: PainelObra;
  /** Define qual Select inline aparece no rodapé do card (etapa ou status). */
  groupBy: KanbanGroupBy;
  /** Marcado para ação em lote. */
  selected: boolean;
  /** Há ao menos um card selecionado em qualquer coluna — mantém o
   *  checkbox visível mesmo sem hover, para reforçar o modo "seleção". */
  anySelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onChangeEtapa: (etapa: PainelEtapa | null) => void;
  onChangeStatus: (status: PainelStatus | null) => void;
}

function KanbanCard({
  obra,
  groupBy,
  selected,
  anySelected,
  onToggleSelect,
  onOpen,
  onChangeEtapa,
  onChangeStatus,
}: KanbanCardProps) {
  const displayStatus = computeDisplayStatus(obra);
  const overdueDays = computeOverdueDays(obra);

  // Card é navegável (clique/Enter abrem a obra). Controles internos
  // interrompem propagação para preservar interação inline (mover etapa).
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Abrir obra ${obra.nome}`}
      aria-selected={selected}
      className={cn(
        'group relative rounded-md bg-card border p-2.5 text-left',
        'hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border-subtle',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        {/* Checkbox de seleção em lote — visível em hover, focus ou quando
            já há seleção ativa. Para o clique no card de navegar. */}
        <div
          className={cn(
            'shrink-0 pt-0.5 transition-opacity',
            selected || anySelected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={selected ? `Desmarcar ${obra.nome}` : `Selecionar ${obra.nome}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          {obra.customer_name && (
            <p className="text-[11px] text-muted-foreground truncate" title={obra.customer_name}>
              {obra.customer_name}
            </p>
          )}
          <p className="text-sm font-medium text-foreground leading-tight truncate" title={obra.nome}>
            {obra.nome}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
            statusPillClass(displayStatus),
          )}
          aria-label={`Status: ${displayStatus ?? 'sem status'}`}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(displayStatus))} aria-hidden />
          {displayStatus ?? '—'}
        </span>
      </div>

      {/* Progresso */}
      {obra.progress_percentage != null && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>Progresso</span>
            <span className="tabular-nums font-medium text-foreground">
              {Math.round(obra.progress_percentage)}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.max(0, Math.min(100, obra.progress_percentage))}%` }}
            />
          </div>
        </div>
      )}

      {/* Linha inferior: entrega + responsável + atraso */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        {obra.entrega_oficial && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <CalendarIcon className="h-3 w-3 opacity-60" />
            {fmtDate(obra.entrega_oficial)}
          </span>
        )}
        {obra.responsavel_nome && (
          <span className="inline-flex items-center gap-1 truncate max-w-[120px]" title={obra.responsavel_nome}>
            <User className="h-3 w-3 opacity-60" />
            <span className="truncate">{obra.responsavel_nome}</span>
          </span>
        )}
        {overdueDays > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive font-medium tabular-nums">
            <Clock className="h-3 w-3" />
            +{overdueDays}d
          </span>
        )}
      </div>

      {/* Mover obra de coluna — fica oculto até hover/focus para reduzir
          ruído (o card já está na coluna, então o select repetia o valor). */}
      <div
        className={cn(
          'mt-2 pt-2 border-t border-border-subtle transition-opacity',
          selected || anySelected
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {groupBy === 'status' ? (
          <Select
            value={obra.status ?? NONE}
            onValueChange={(v) => onChangeStatus(v === NONE ? null : (v as PainelStatus))}
          >
            <SelectTrigger
              className="h-7 text-[11px] border-border-subtle bg-surface"
              aria-label="Mover obra para outro status"
            >
              <SelectValue placeholder="Mover para…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(sem status)</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={obra.etapa ?? NONE}
            onValueChange={(v) => onChangeEtapa(v === NONE ? null : (v as PainelEtapa))}
          >
            <SelectTrigger
              className="h-7 text-[11px] border-border-subtle bg-surface"
              aria-label="Mover obra para outra etapa"
            >
              <SelectValue placeholder="Mover para…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(sem etapa)</SelectItem>
              {ETAPA_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
