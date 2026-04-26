/**
 * Painel de Obras — visão executiva unificada para a equipe.
 * UX densa tipo planilha (Airtable/Monday): cabeçalho leve, linhas compactas,
 * colunas prioritárias fixas à esquerda, edição inline com affordance visual.
 */
import { useMemo, useState, lazy, Suspense } from 'react';
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
  Search,
  Headset,
  ArrowRight,
  Plus,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader, PageToolbar, MetricCard, MetricRail, SectionCard, FilterPill } from '@/components/ui-premium';
import { Button } from '@/components/ui/button';
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
import { DailyLogInline } from '@/components/admin/obras/DailyLogInline';
import { ExternalBudgetCell } from '@/components/admin/painel/ExternalBudgetCell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton as PageSkeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

// Lazy: a aba Fornecedores carrega o módulo completo só quando ativada.
const Fornecedores = lazy(() => import('@/pages/gestao/Fornecedores'));

// ----- helpers -----
const ALL = '__all__';
const NONE = '__none__';

const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

const fmtDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

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
  'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

  const [search, setSearch] = useState('');
  const [filterEtapa, setFilterEtapa] = useState<string>(ALL);
  const [filterStatus, setFilterStatus] = useState<string>(ALL);
  const [filterRelacionamento, setFilterRelacionamento] = useState<string>(ALL);

  type SortKey =
    | 'inicio_oficial' | 'entrega_oficial' | 'inicio_real'
    | 'entrega_real'   | 'ultima_atualizacao' | null;
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Obra "${deleteTarget.nome}" excluída com sucesso.`);
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
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (o) =>
          o.nome.toLowerCase().includes(q) ||
          (o.customer_name ?? '').toLowerCase().includes(q) ||
          (o.engineer_name ?? '').toLowerCase().includes(q),
      );
    }
    if (filterEtapa !== ALL)
      rows = rows.filter((o) => (filterEtapa === NONE ? !o.etapa : o.etapa === filterEtapa));
    if (filterStatus !== ALL)
      rows = rows.filter((o) => {
        const display = computeDisplayStatus(o);
        return filterStatus === NONE ? !display : display === filterStatus;
      });
    if (filterRelacionamento !== ALL)
      rows = rows.filter((o) =>
        filterRelacionamento === NONE ? !o.relacionamento : o.relacionamento === filterRelacionamento,
      );
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
        if (!av && !bv) return 0; if (!av) return 1; if (!bv) return -1;
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [obras, search, filterEtapa, filterStatus, filterRelacionamento, sortKey, sortDir]);

  const toggleSort = (key: NonNullable<SortKey>) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setSearch(''); setFilterEtapa(ALL); setFilterStatus(ALL); setFilterRelacionamento(ALL);
  };

  const hasFilters = !!search.trim() || filterEtapa !== ALL || filterStatus !== ALL || filterRelacionamento !== ALL;

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
                    placeholder="Buscar obra, cliente ou responsável…"
                    className="h-9 pl-8 text-sm bg-surface border-border-subtle" />
                </div>
              }
              filters={
                <>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 w-[140px] text-xs border-border-subtle bg-surface">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos status</SelectItem>
                      <SelectItem value={NONE}>(sem status)</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-2">
                            <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />{s}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

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

                  {hasFilters && (
                    <Button size="sm" variant="ghost" onClick={clearFilters}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5 mr-1" />Limpar
                    </Button>
                  )}
                </>
              }
              meta={
                <span className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-semibold text-foreground">{filtered.length}</span>
                  <span className="opacity-60"> / {obras.length} obras</span>
                </span>
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
              ) : (
                <SectionCard flush>
                  <div className="overflow-x-auto">
                    <Table className="text-sm [&_th]:h-11 [&_td]:py-3 [&_td]:px-3 [&_th]:px-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-muted-foreground [&_th]:bg-surface-sunken [&_th]:uppercase [&_th]:tracking-[0.04em] [&_tr]:border-border-subtle">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border-subtle">
                          <TableHead className="min-w-[260px] sticky left-0 z-20 bg-surface-sunken border-r border-border-subtle">Cliente / Obra</TableHead>
                          <TableHead className="min-w-[130px]">Status</TableHead>
                         <TableHead className="min-w-[150px]">Etapa</TableHead>
                         <TableHead className="min-w-[110px] text-right">Progresso</TableHead>
                          <TableHead className="min-w-[110px]"><SortableHeader label="Início Of." sortKey="inicio_oficial" /></TableHead>
                          <TableHead className="min-w-[110px]"><SortableHeader label="Entrega Of." sortKey="entrega_oficial" /></TableHead>
                          <TableHead className="min-w-[110px]"><SortableHeader label="Início Real" sortKey="inicio_real" /></TableHead>
                          <TableHead className="min-w-[110px]"><SortableHeader label="Entrega Real" sortKey="entrega_real" /></TableHead>
                         <TableHead className="min-w-[140px]">Relacionamento</TableHead>
                          <TableHead className="w-16 sticky right-0 bg-surface-sunken border-l border-border-subtle" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((o) => (
                          <ObraRow
                            key={o.id}
                            obra={o}
                            expanded={expandedIds.has(o.id)}
                            onToggleExpanded={() => toggleExpanded(o.id)}
                            onUpdate={(patch) => updateObra(o.id, patch)}
                            onOpen={() => navigate(`/obra/${o.id}`)}
                            onDeleteRequest={() => setDeleteTarget(o)}
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
const PAINEL_COLUMN_COUNT = 10;

interface ObraRowProps {
  obra: PainelObra;
  expanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (patch: PainelObraPatch) => void;
  onOpen: () => void;
  onDeleteRequest: () => void;
}

function ObraRow({ obra, expanded, onToggleExpanded, onUpdate, onOpen, onDeleteRequest }: ObraRowProps) {
  const stickyBase = 'bg-card group-hover:bg-accent/40 transition-colors';

  return (
    <>
      <TableRow className={cn('group transition-colors hover:bg-accent/40', expanded && 'bg-accent/25 hover:bg-accent/30')}>
        {/* Cliente / Obra — sticky left */}
        <TableCell className={cn('sticky left-0 z-10 border-r border-border shadow-[1px_0_0_0_hsl(var(--border))]', stickyBase, expanded && 'bg-accent/25 group-hover:bg-accent/30')}>
          <div className="flex items-start gap-1.5">
            <Button type="button" size="icon" variant="ghost" onClick={onToggleExpanded}
              aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'} aria-expanded={expanded}
              className="h-6 w-6 shrink-0 mt-0.5 text-muted-foreground hover:text-primary hover:bg-transparent">
              <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-90 text-primary')} />
            </Button>
            <button type="button" onClick={onOpen}
              className="text-left flex flex-col gap-0.5 flex-1 min-w-0 group/link focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-0.5" title="Abrir obra">
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate group-hover/link:text-primary transition-colors">
                  {obra.customer_name ?? 'Sem cliente'}
                </span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </span>
              <span className="text-xs text-muted-foreground truncate">{obra.nome}</span>
            </button>
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="min-w-[120px]">
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
                      className={cn('h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start gap-1.5 rounded-md', statusPillClass(displayStatus))}
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
        <TableCell className="min-w-[140px]">
          <Select value={obra.etapa ?? NONE}
            onValueChange={(v) => onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })}>
            <SelectTrigger className={cn('h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 hover:bg-accent/60 [&>svg]:opacity-40 [&>svg]:ml-1',
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
        <TableCell className="min-w-[110px]">
          <Select value={obra.relacionamento ?? NONE}
            onValueChange={(v) => onUpdate({ relacionamento: v === NONE ? null : (v as PainelRelacionamento) })}>
            <SelectTrigger className={cn('h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start rounded-md', relacionamentoPillClass(obra.relacionamento))}>
              <span className="font-medium truncate">{obra.relacionamento ?? 'Definir'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(nenhum)</SelectItem>
              {RELACIONAMENTO_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Orçamento público */}
        <TableCell>
          <ExternalBudgetCell value={obra.external_budget_id} onChange={(id) => onUpdate({ external_budget_id: id })} />
        </TableCell>

        {/* Última atualização */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-default tabular-nums">{fmtDate(obra.ultima_atualizacao)}</span>
            </TooltipTrigger>
            <TooltipContent>{fmtDateTime(obra.ultima_atualizacao)}</TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Ações — sticky right */}
        <TableCell className={cn('sticky right-0 z-10 border-l border-border', stickyBase, expanded && 'bg-accent/25 group-hover:bg-accent/30')}>
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
        <TableRow className="bg-accent/15 hover:bg-accent/15">
          <TableCell colSpan={PAINEL_COLUMN_COUNT} className="p-0 border-t border-b-2 border-primary/20">
            <DailyLogInline projectId={obra.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
