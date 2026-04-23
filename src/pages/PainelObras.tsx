/**
 * Painel de Obras — visão executiva unificada para a equipe.
 * UX densa tipo planilha (Airtable/Monday): cabeçalho leve, linhas compactas,
 * colunas prioritárias fixas à esquerda, edição inline com affordance visual.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  Filter,
  X,
  AlertTriangle,
  Table2,
  ShieldOff,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search,
  LayoutGrid,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
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

// ----- helpers -----
const ALL = '__all__';
const NONE = '__none__';

const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

const fmtDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const toIsoDate = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null);

/**
 * Status exibido no painel.
 *
 * Regra derivada (apenas visual, não persiste no banco):
 *   - Se a Entrega Oficial (`entrega_oficial`) já passou e a Entrega Real
 *     (`entrega_real`) não foi preenchida, o status exibido é `Atrasado`.
 *   - Caso contrário, mantém o valor armazenado (`obra.status`).
 *
 * Projetado para:
 *   - reverter automaticamente quando a Entrega Real é preenchida ou a
 *     Entrega Oficial é adiada (sem precisar editar o Status manualmente);
 *   - não afetar `INSERT`/`UPDATE` — é sempre derivado no front.
 *
 * Observação sobre `Finalizada`: decisão do produto é que a etapa
 * `Finalizada` **não** isenta o atraso enquanto não houver Entrega Real —
 * isso força o registro da data para fechar a obra corretamente.
 */
const computeDisplayStatus = (obra: {
  status: PainelStatus | null;
  entrega_oficial: string | null;
  entrega_real: string | null;
}): PainelStatus | null => {
  const { status, entrega_oficial, entrega_real } = obra;
  if (!entrega_oficial || entrega_real) return status;
  // Compara como ISO (YYYY-MM-DD) — 'hoje' no fuso local do navegador.
  const hojeIso = format(new Date(), 'yyyy-MM-dd');
  if (entrega_oficial < hojeIso) return 'Atrasado';
  return status;
};

/** Cor sólida para o "dot" e badge tipo Monday (sem hover ruidoso). */
const statusDotClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando':
      return 'bg-info';
    case 'Em dia':
      return 'bg-success';
    case 'Atrasado':
      return 'bg-destructive';
    case 'Paralisada':
      return 'bg-muted-foreground';
    default:
      return 'bg-muted';
  }
};

const statusPillClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando':
      return 'bg-info/10 text-info border border-info/25';
    case 'Em dia':
      return 'bg-success/10 text-success border border-success/25';
    case 'Atrasado':
      return 'bg-destructive/10 text-destructive border border-destructive/25';
    case 'Paralisada':
      return 'bg-muted text-muted-foreground border border-border';
    default:
      return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

const relacionamentoPillClass = (r: PainelRelacionamento | null): string => {
  switch (r) {
    case 'Normal':
      return 'bg-success/10 text-success border border-success/25';
    case 'Atrito':
      return 'bg-warning/10 text-warning border border-warning/25';
    case 'Insatisfeito':
      return 'bg-warning/15 text-warning border border-warning/30';
    case 'Crítico':
      return 'bg-destructive/10 text-destructive border border-destructive/25';
    default:
      return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

// Affordance comum a toda célula editável: hover sutil + ring no foco.
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
    if (confirmEdit && value) {
      setPending(d);
      setConfirmOpen(true);
      return;
    }
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
        <PopoverContent className="w-auto p-0 z-[200]" align="start">
          <Calendar
            mode="single"
            selected={value ? parseISO(value) : undefined}
            onSelect={handleSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
          {value && (
            <div className="p-2 border-t border-border">
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => {
                  setOpen(false);
                  if (confirmEdit) {
                    setPending(undefined);
                    setConfirmOpen(true);
                  } else {
                    onChange(null);
                  }
                }}
              >
                Limpar data
              </Button>
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
            <AlertDialogAction
              onClick={() => {
                onChange(toIsoDate(pending));
                setPending(undefined);
              }}
            >
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

  // Filtros
  const [search, setSearch] = useState('');
  const [filterEtapa, setFilterEtapa] = useState<string>(ALL);
  const [filterStatus, setFilterStatus] = useState<string>(ALL);
  const [filterRelacionamento, setFilterRelacionamento] = useState<string>(ALL);

  // Ordenação
  type SortKey =
    | 'inicio_oficial'
    | 'entrega_oficial'
    | 'inicio_real'
    | 'entrega_real'
    | 'ultima_atualizacao'
    | null;
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Linhas com detalhes expandidos (registro da semana)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        // Filtramos pelo status *exibido* para que a regra automática de
        // 'Atrasado' (entrega_oficial vencida sem entrega_real) seja
        // coerente com o que aparece na coluna Status.
        const display = computeDisplayStatus(o);
        return filterStatus === NONE ? !display : display === filterStatus;
      });
    if (filterRelacionamento !== ALL)
      rows = rows.filter((o) =>
        filterRelacionamento === NONE
          ? !o.relacionamento
          : o.relacionamento === filterRelacionamento,
      );

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [obras, search, filterEtapa, filterStatus, filterRelacionamento, sortKey, sortDir]);

  const toggleSort = (key: NonNullable<SortKey>) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterEtapa(ALL);
    setFilterStatus(ALL);
    setFilterRelacionamento(ALL);
  };

  const hasFilters =
    !!search.trim() ||
    filterEtapa !== ALL ||
    filterStatus !== ALL ||
    filterRelacionamento !== ALL;

  // Resumo executivo no topo (densidade de informação)
  // Usa o status *exibido* — o mesmo que aparece em cada linha — para
  // manter os KPIs consistentes com a coluna Status.
  const summary = useMemo(() => {
    const displayed = obras.map((o) => computeDisplayStatus(o));
    const total = obras.length;
    const aguardando = displayed.filter((s) => s === 'Aguardando').length;
    const emDia = displayed.filter((s) => s === 'Em dia').length;
    const atrasadas = displayed.filter((s) => s === 'Atrasado').length;
    const paralisadas = displayed.filter((s) => s === 'Paralisada').length;
    return { total, aguardando, emDia, atrasadas, paralisadas };
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
        <EmptyState
          icon={ShieldOff}
          title="Acesso restrito"
          description="O Painel de Obras é exclusivo da equipe interna."
        />
      </PageContainer>
    );
  }

  const SortableHeader = ({
    label,
    sortKey: k,
  }: {
    label: string;
    sortKey: NonNullable<SortKey>;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wide"
    >
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
        {/* Cabeçalho + KPIs */}
        <div className="flex flex-col gap-4 mb-4 pt-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Painel de Obras</h1>
              <p className="text-sm text-muted-foreground">
                Visão executiva unificada de todas as obras
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <KpiPill label="Total" value={summary.total} />
              <KpiPill label="Aguardando" value={summary.aguardando} dot="bg-sky-500" />
              <KpiPill label="Em dia" value={summary.emDia} dot="bg-emerald-500" />
              <KpiPill label="Atrasadas" value={summary.atrasadas} dot="bg-destructive" />
              <KpiPill label="Paralisadas" value={summary.paralisadas} dot="bg-muted-foreground" />
            </div>
          </div>

          {/* Toolbar de filtros — compacta e leve */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar obra, cliente ou responsável…"
              className="h-8 w-[280px] text-sm"
            />

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filtros</span>
            </div>

            <Select value={filterEtapa} onValueChange={setFilterEtapa}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas etapas</SelectItem>
                <SelectItem value={NONE}>(sem etapa)</SelectItem>
                {ETAPA_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos status</SelectItem>
                <SelectItem value={NONE}>(sem status)</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRelacionamento} onValueChange={setFilterRelacionamento}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="Relacionamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos relacionamentos</SelectItem>
                <SelectItem value={NONE}>(sem relacionamento)</SelectItem>
                {RELACIONAMENTO_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {filtered.length} de {obras.length}
            </span>
          </div>
        </div>

        {/* Tabela densa */}
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Table2}
            title={obras.length === 0 ? 'Nenhuma obra cadastrada' : 'Nenhum resultado'}
            description={
              obras.length === 0
                ? 'Crie uma nova obra a partir do menu lateral.'
                : 'Tente ajustar ou limpar os filtros.'
            }
          />
        ) : (
          <div className="rounded-md border border-border overflow-x-auto bg-card">
            <Table className="text-sm [&_th]:h-9 [&_td]:py-1.5 [&_td]:px-2 [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:bg-muted/40 [&_tr]:border-border">
              <TableHeader>
                <TableRow>
                  {/* === Única coluna fixa === */}
                  <TableHead className="min-w-[260px] sticky left-0 z-20 bg-muted/40 border-r-2 border-border">
                    Cliente / Obra
                  </TableHead>

                  {/* === Demais colunas (rolláveis) === */}
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[140px]">Etapa</TableHead>
                  <TableHead className="min-w-[120px]">Responsável</TableHead>
                  <TableHead className="min-w-[100px] text-right">Progresso</TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Início Of." sortKey="inicio_oficial" />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Entrega Of." sortKey="entrega_oficial" />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Início Real" sortKey="inicio_real" />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Entrega Real" sortKey="entrega_real" />
                  </TableHead>
                  <TableHead className="min-w-[140px]">Relacionamento</TableHead>
                  <TableHead className="min-w-[110px]">
                    <SortableHeader label="Atualizado" sortKey="ultima_atualizacao" />
                  </TableHead>
                  <TableHead className="w-20"></TableHead>
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
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      </PageContainer>
    </TooltipProvider>
  );
}

// ----- KPI pill -----
function KpiPill({
  label,
  value,
  dot,
  emphasis,
  hint,
}: {
  label: string;
  value: number;
  dot?: string;
  emphasis?: 'danger';
  hint?: string;
}) {
  const content = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card',
        emphasis === 'danger' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      {dot && <span className={cn('h-2 w-2 rounded-full', dot)} />}
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          emphasis === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
  if (hint) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

// ----- row component -----
const PAINEL_COLUMN_COUNT = 12;

interface ObraRowProps {
  obra: PainelObra;
  expanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (patch: PainelObraPatch) => void;
  onOpen: () => void;
}

function ObraRow({ obra, expanded, onToggleExpanded, onUpdate, onOpen }: ObraRowProps) {
  // Fundo da célula fixa — precisa acompanhar o hover da row.
  const stickyBase = 'bg-card group-hover:bg-accent/40 transition-colors';

  return (
    <>
    <TableRow className={cn('group hover:bg-accent/40', expanded && 'bg-accent/20')}>
      {/* === Única coluna fixa === */}
      {/* Cliente / Obra (unificada com hierarquia tipográfica) */}
      <TableCell
        className={cn('sticky left-0 z-10 border-r-2 border-border', stickyBase)}
      >
        <div className="flex items-start gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            aria-expanded={expanded}
            className="h-6 w-6 shrink-0 mt-0.5 text-muted-foreground hover:text-[hsl(var(--primary))] hover:bg-transparent"
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                expanded && 'rotate-90',
              )}
            />
          </Button>
          <button
            type="button"
            onClick={onOpen}
            className="text-left flex flex-col gap-0.5 flex-1 min-w-0 group/link"
            title="Abrir obra"
          >
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate group-hover/link:text-[hsl(var(--primary))] transition-colors">
                {obra.customer_name ?? 'Sem cliente'}
              </span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </span>
            <span className="text-xs text-muted-foreground truncate">{obra.nome}</span>
          </button>
        </div>
      </TableCell>

      {/* Status — exibe valor derivado quando a regra de atraso automático
          aplica (entrega_oficial vencida sem entrega_real). O valor salvo
          no banco permanece em obra.status e volta à vista quando a
          condição deixa de ser verdadeira. */}
      <TableCell className="min-w-[120px]">
        {(() => {
          const displayStatus = computeDisplayStatus(obra);
          const isAuto =
            displayStatus === 'Atrasado' && obra.status !== 'Atrasado';
          const autoHint =
            'Atraso automático: Entrega Oficial vencida sem Entrega Real preenchida. ' +
            (obra.status
              ? `Valor salvo: “${obra.status}”.`
              : 'Nenhum status salvo.');
          return (
            <Select
              value={obra.status ?? NONE}
              onValueChange={(v) =>
                onUpdate({ status: v === NONE ? null : (v as PainelStatus) })
              }
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger
                    className={cn(
                      'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start gap-1.5',
                      'rounded-md',
                      statusPillClass(displayStatus),
                    )}
                    aria-label={isAuto ? autoHint : undefined}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        statusDotClass(displayStatus),
                      )}
                    />
                    <span className="font-medium truncate">
                      {displayStatus ?? 'Definir'}
                    </span>
                    {isAuto && (
                      <AlertTriangle
                        className="h-3 w-3 opacity-70 shrink-0"
                        aria-hidden
                      />
                    )}
                  </SelectTrigger>
                </TooltipTrigger>
                {isAuto && (
                  <TooltipContent side="top" className="max-w-[280px] text-xs">
                    {autoHint}
                  </TooltipContent>
                )}
              </Tooltip>
              <SelectContent>
                <SelectItem value={NONE}>(nenhum)</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))}
                      />
                      {s}
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
        <Select
          value={obra.etapa ?? NONE}
          onValueChange={(v) => onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })}
        >
          <SelectTrigger
            className={cn(
              'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 hover:bg-accent/60 [&>svg]:opacity-40 [&>svg]:ml-1',
              !obra.etapa && 'text-muted-foreground italic',
              obra.etapa === 'Finalizada' && 'text-success font-medium',
              obra.etapa === 'Vistoria reprovada' && 'text-destructive font-medium',
            )}
          >
            <SelectValue placeholder="Definir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhuma)</SelectItem>
            {ETAPA_OPTIONS.map((e) => (
              <SelectItem key={e} value={e}>
                <span
                  className={cn(
                    e === 'Finalizada' && 'text-success font-medium',
                    e === 'Vistoria reprovada' && 'text-destructive font-medium',
                  )}
                >
                  {e}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Responsável */}
      <TableCell className="text-muted-foreground">
        <span className="truncate block">
          {obra.engineer_name ?? <span className="italic">—</span>}
        </span>
      </TableCell>

      {/* Progresso — barra compacta */}
      <TableCell className="text-right">
        {obra.progress_percentage != null ? (
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  obra.progress_percentage >= 100 ? 'bg-success' : 'bg-primary',
                )}
                style={{ width: `${Math.min(100, obra.progress_percentage)}%` }}
              />
            </div>
            <span
              className={cn(
                'text-xs tabular-nums w-9 text-right',
                obra.progress_percentage >= 100 && 'text-success font-semibold',
              )}
            >
              {obra.progress_percentage}%
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Início oficial - exige confirmação */}
      <TableCell>
        <DateCell
          value={obra.inicio_oficial}
          onChange={(v) => onUpdate({ inicio_oficial: v })}
          confirmEdit
          confirmTitle="Alterar início oficial?"
        />
      </TableCell>

      {/* Entrega oficial - exige confirmação */}
      <TableCell>
        <DateCell
          value={obra.entrega_oficial}
          onChange={(v) => onUpdate({ entrega_oficial: v })}
          confirmEdit
          confirmTitle="Alterar entrega oficial?"
        />
      </TableCell>

      {/* Início real */}
      <TableCell>
        <DateCell value={obra.inicio_real} onChange={(v) => onUpdate({ inicio_real: v })} />
      </TableCell>

      {/* Entrega real */}
      <TableCell>
        <DateCell value={obra.entrega_real} onChange={(v) => onUpdate({ entrega_real: v })} />
      </TableCell>

      {/* Relacionamento */}
      <TableCell className="min-w-[110px]">
        <Select
          value={obra.relacionamento ?? NONE}
          onValueChange={(v) =>
            onUpdate({
              relacionamento: v === NONE ? null : (v as PainelRelacionamento),
            })
          }
        >
          <SelectTrigger
            className={cn(
              'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start',
              'rounded-md',
              relacionamentoPillClass(obra.relacionamento),
            )}
          >
            <span className="font-medium truncate">{obra.relacionamento ?? 'Definir'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {RELACIONAMENTO_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Última atualização */}
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-default tabular-nums">
              {fmtDate(obra.ultima_atualizacao)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{fmtDateTime(obra.ultima_atualizacao)}</TooltipContent>
        </Tooltip>
      </TableCell>

      {/* Ações: abrir obra */}
      <TableCell>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-[hsl(var(--primary))]"
                onClick={onOpen}
                aria-label="Abrir obra"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Abrir obra</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
    {expanded && (
      <TableRow className="bg-accent/10 hover:bg-accent/10">
        <TableCell
          colSpan={PAINEL_COLUMN_COUNT}
          className="p-0 border-t border-b border-border"
        >
          <DailyLogInline projectId={obra.id} />
        </TableCell>
      </TableRow>
    )}
    </>
  );
}
