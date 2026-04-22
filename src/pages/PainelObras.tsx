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
  PAINEL_PRAZO_OPTIONS,
  RELACIONAMENTO_OPTIONS,
  STATUS_OPTIONS,
  usePainelObras,
  type PainelEtapa,
  type PainelObra,
  type PainelObraPatch,
  type PainelPrazo,
  type PainelRelacionamento,
  type PainelStatus,
} from '@/hooks/usePainelObras';
import { EmptyState } from '@/components/ui/states';

// ----- helpers -----
const ALL = '__all__';
const NONE = '__none__';

const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

const fmtDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const toIsoDate = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null);

/** Cor sólida para o "dot" e badge tipo Monday (sem hover ruidoso). */
const statusDotClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando':
      return 'bg-sky-500';
    case 'Em dia':
      return 'bg-emerald-500';
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
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30';
    case 'Em dia':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
    case 'Atrasado':
      return 'bg-destructive/15 text-destructive border border-destructive/30';
    case 'Paralisada':
      return 'bg-muted text-muted-foreground border border-border';
    default:
      return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

const relacionamentoPillClass = (r: PainelRelacionamento | null): string => {
  switch (r) {
    case 'Normal':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
    case 'Atrito':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30';
    case 'Insatisfeito':
      return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30';
    case 'Crítico':
      return 'bg-destructive/15 text-destructive border border-destructive/30';
    default:
      return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

// Affordance comum a toda célula editável: hover sutil + ring no foco.
const editableCell =
  'group/cell w-full h-full text-left px-2 py-1 rounded text-sm transition-colors ' +
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
              <AlertTriangle className="h-5 w-5 text-amber-500" />
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
    | 'inicio_etapa'
    | 'previsao_avanco'
    | 'inicio_real'
    | 'entrega_real'
    | 'ultima_atualizacao'
    | null;
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
      rows = rows.filter((o) => (filterStatus === NONE ? !o.status : o.status === filterStatus));
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
  const summary = useMemo(() => {
    const total = obras.length;
    const aguardando = obras.filter((o) => o.status === 'Aguardando').length;
    const emDia = obras.filter((o) => o.status === 'Em dia').length;
    const atrasadas = obras.filter((o) => o.status === 'Atrasado').length;
    const paralisadas = obras.filter((o) => o.status === 'Paralisada').length;
    const pendencias = obras.reduce((s, o) => s + o.pending_count, 0);
    const atrasos = obras.reduce((s, o) => s + o.overdue_count, 0);
    return { total, aguardando, emDia, atrasadas, paralisadas, pendencias, atrasos };
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
              <KpiPill
                label="Pendências"
                value={summary.pendencias}
                emphasis={summary.atrasos > 0 ? 'danger' : undefined}
                hint={summary.atrasos > 0 ? `${summary.atrasos} atrasadas` : undefined}
              />
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
                  {/* === Colunas fixas (prioritárias) === */}
                  <TableHead className="min-w-[260px] sticky left-0 z-20 bg-muted/40 border-r border-border">
                    Cliente / Obra
                  </TableHead>
                  <TableHead className="min-w-[120px] sticky left-[260px] z-20 bg-muted/40 border-r border-border">
                    Status
                  </TableHead>
                  <TableHead className="min-w-[140px] sticky left-[380px] z-20 bg-muted/40 border-r border-border">
                    Etapa
                  </TableHead>
                  <TableHead className="min-w-[100px] text-center sticky left-[520px] z-20 bg-muted/40 border-r-2 border-border">
                    Pendências
                  </TableHead>

                  {/* === Colunas secundárias === */}
                  <TableHead className="min-w-[120px]">Responsável</TableHead>
                  <TableHead className="min-w-[100px] text-right">Progresso</TableHead>
                  <TableHead className="min-w-[110px]">Prazo</TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Início Of." sortKey="inicio_oficial" />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Entrega Of." sortKey="entrega_oficial" />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader label="Início Etapa" sortKey="inicio_etapa" />
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <SortableHeader label="Prev. Avanço" sortKey="previsao_avanco" />
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
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <ObraRow
                    key={o.id}
                    obra={o}
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
interface ObraRowProps {
  obra: PainelObra;
  onUpdate: (patch: PainelObraPatch) => void;
  onOpen: () => void;
}

function ObraRow({ obra, onUpdate, onOpen }: ObraRowProps) {
  // Cor da pendência: vermelha se há atrasos, âmbar se há pendências, neutra senão.
  const pendStyle =
    obra.overdue_count > 0
      ? 'bg-destructive/15 text-destructive border border-destructive/30'
      : obra.pending_count > 0
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
        : 'bg-muted text-muted-foreground border border-border';

  // Fundo das células fixas — precisa acompanhar o hover da row.
  const stickyBase = 'bg-card group-hover:bg-accent/40 transition-colors';

  return (
    <TableRow className="group hover:bg-accent/40">
      {/* === FIXAS === */}
      {/* Cliente / Obra (unificada com hierarquia tipográfica) */}
      <TableCell
        className={cn('sticky left-0 z-10 border-r border-border', stickyBase)}
      >
        <button
          type="button"
          onClick={onOpen}
          className="text-left flex flex-col gap-0.5 w-full group/link"
          title="Abrir obra"
        >
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate group-hover/link:text-primary transition-colors">
              {obra.customer_name ?? 'Sem cliente'}
            </span>
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </span>
          <span className="text-xs text-muted-foreground truncate">{obra.nome}</span>
        </button>
      </TableCell>

      {/* Status */}
      <TableCell className={cn('sticky left-[260px] z-10 border-r border-border', stickyBase)}>
        <Select
          value={obra.status ?? NONE}
          onValueChange={(v) => onUpdate({ status: v === NONE ? null : (v as PainelStatus) })}
        >
          <SelectTrigger
            className={cn(
              'h-7 text-xs border-0 shadow-none p-0 px-2 [&>svg]:hidden justify-start gap-1.5',
              'rounded-md',
              statusPillClass(obra.status),
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(obra.status))} />
            <span className="font-medium">{obra.status ?? 'Definir'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />
                  {s}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Etapa */}
      <TableCell className={cn('sticky left-[380px] z-10 border-r border-border', stickyBase)}>
        <Select
          value={obra.etapa ?? NONE}
          onValueChange={(v) => onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })}
        >
          <SelectTrigger
            className={cn(
              'h-7 text-xs border-0 shadow-none hover:bg-accent/60 [&>svg]:opacity-40',
              !obra.etapa && 'text-muted-foreground italic',
              obra.etapa === 'Finalizada' &&
                'text-emerald-700 dark:text-emerald-400 font-medium',
              obra.etapa === 'Vistoria reprovada' &&
                'text-destructive font-medium',
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
                    e === 'Finalizada' && 'text-emerald-700 dark:text-emerald-400 font-medium',
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

      {/* Pendências */}
      <TableCell
        className={cn('text-center sticky left-[520px] z-10 border-r-2 border-border', stickyBase)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[36px] h-6 px-2 rounded-md text-xs font-semibold tabular-nums',
                pendStyle,
              )}
            >
              {obra.pending_count}
              {obra.overdue_count > 0 && (
                <span className="ml-1 opacity-80">↓{obra.overdue_count}</span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {obra.pending_count} pendência(s)
            {obra.overdue_count > 0 ? ` · ${obra.overdue_count} atrasada(s)` : ''}
          </TooltipContent>
        </Tooltip>
      </TableCell>

      {/* === SECUNDÁRIAS === */}
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
                  obra.progress_percentage >= 100 ? 'bg-emerald-500' : 'bg-primary',
                )}
                style={{ width: `${Math.min(100, obra.progress_percentage)}%` }}
              />
            </div>
            <span
              className={cn(
                'text-xs tabular-nums w-9 text-right',
                obra.progress_percentage >= 100 && 'text-emerald-600 dark:text-emerald-400 font-semibold',
              )}
            >
              {obra.progress_percentage}%
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Prazo - select controlado (55/60/65/75 dias) */}
      <TableCell>
        <Select
          value={obra.prazo ?? NONE}
          onValueChange={(v) =>
            onUpdate({ prazo: v === NONE ? null : (v as PainelPrazo) })
          }
        >
          <SelectTrigger
            className={cn(
              'h-7 text-xs border-0 shadow-none hover:bg-accent/60 [&>svg]:opacity-40 tabular-nums',
              !obra.prazo && 'text-muted-foreground italic',
            )}
          >
            <SelectValue placeholder="Definir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {PAINEL_PRAZO_OPTIONS.map((p) => (
              <SelectItem key={p} value={p} className="tabular-nums">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Início da etapa */}
      <TableCell>
        <DateCell value={obra.inicio_etapa} onChange={(v) => onUpdate({ inicio_etapa: v })} />
      </TableCell>

      {/* Previsão de avanço */}
      <TableCell>
        <DateCell value={obra.previsao_avanco} onChange={(v) => onUpdate({ previsao_avanco: v })} />
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
      <TableCell>
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
              'h-7 text-xs border-0 shadow-none p-0 px-2 [&>svg]:hidden justify-start',
              'rounded-md',
              relacionamentoPillClass(obra.relacionamento),
            )}
          >
            <span className="font-medium">{obra.relacionamento ?? 'Definir'}</span>
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

      {/* Ação: abrir obra */}
      <TableCell>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onOpen}
          title="Abrir obra"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
