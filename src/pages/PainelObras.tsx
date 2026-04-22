/**
 * Painel de Obras — visão executiva unificada para a equipe.
 * Lista TODAS as obras do sistema (fonte única: tabela `projects`) com
 * edição inline dos campos operacionais e métricas de progresso/pendências.
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
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

// ----- helpers -----
const ALL = '__all__';
const NONE = '__none__';

const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) : '—';

const fmtDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const toIsoDate = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null);

const statusBadgeClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Em dia':
      return 'bg-green-600 text-white hover:bg-green-700';
    case 'Atrasado':
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
    case 'Paralisada':
      return 'bg-muted-foreground text-background hover:bg-muted-foreground/90';
    default:
      return 'bg-muted text-muted-foreground hover:bg-muted';
  }
};

const relacionamentoBadgeClass = (r: PainelRelacionamento | null): string => {
  switch (r) {
    case 'Normal':
      return 'bg-green-600 text-white hover:bg-green-700';
    case 'Atrito':
      return 'bg-yellow-500 text-white hover:bg-yellow-600';
    case 'Insatisfeito':
      return 'bg-orange-500 text-white hover:bg-orange-600';
    case 'Crítico':
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
    default:
      return 'bg-muted text-muted-foreground hover:bg-muted';
  }
};

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
              'flex items-center gap-1.5 px-2 py-1 rounded text-sm w-full text-left',
              'hover:bg-accent transition-colors',
              !value && 'text-muted-foreground',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
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

// ----- inline text cell -----
function TextCell({
  value,
  onSave,
  placeholder,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const next = draft.trim() || null;
          if (next !== value) onSave(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value ?? '');
            setEditing(false);
          }
        }}
        className="h-8 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'w-full text-left px-2 py-1 rounded text-sm hover:bg-accent transition-colors',
        !value && 'text-muted-foreground italic',
      )}
    >
      {value ?? placeholder ?? '—'}
    </button>
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
      className="flex items-center gap-1 hover:text-primary transition-colors"
    >
      {label}
      {sortKey === k && <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <TooltipProvider>
      <PageContainer>
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Painel de Obras</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Visão executiva unificada de todas as obras. Clique em qualquer célula para
                editar.
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/40 rounded-lg border border-border">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por obra, cliente ou responsável…"
              className="h-8 w-[260px] text-sm"
            />

            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>

            <Select value={filterEtapa} onValueChange={setFilterEtapa}>
              <SelectTrigger className="h-8 w-[180px] text-sm">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as etapas</SelectItem>
                <SelectItem value={NONE}>(sem etapa)</SelectItem>
                {ETAPA_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
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
              <SelectTrigger className="h-8 w-[180px] text-sm">
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
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} de {obras.length} {obras.length === 1 ? 'obra' : 'obras'}
            </span>
          </div>
        </div>

        {/* Tabela */}
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
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-foreground hover:bg-foreground border-foreground/20">
                  <TableHead className="text-background font-semibold min-w-[180px] sticky left-0 bg-foreground z-10">
                    Obra
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[160px]">
                    Cliente
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">
                    Responsável
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[120px]">
                    Prazo
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">
                    <SortableHeader label="Início Oficial" sortKey="inicio_oficial" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">
                    <SortableHeader label="Entrega Oficial" sortKey="entrega_oficial" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">Etapa</TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">
                    <SortableHeader label="Início da Etapa" sortKey="inicio_etapa" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[150px]">
                    <SortableHeader label="Previsão de Avanço" sortKey="previsao_avanco" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[120px]">Status</TableHead>
                  <TableHead className="text-white font-semibold min-w-[110px] text-right">
                    Progresso
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[110px] text-center">
                    Pendências
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">
                    <SortableHeader label="Última Atualização" sortKey="ultima_atualizacao" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[130px]">
                    <SortableHeader label="Início Real" sortKey="inicio_real" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[130px]">
                    <SortableHeader label="Entrega Real" sortKey="entrega_real" />
                  </TableHead>
                  <TableHead className="text-white font-semibold min-w-[140px]">
                    Relacionamento
                  </TableHead>
                  <TableHead className="text-white w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o, idx) => (
                  <ObraRow
                    key={o.id}
                    obra={o}
                    zebra={idx % 2 === 1}
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

// ----- row component -----
interface ObraRowProps {
  obra: PainelObra;
  zebra: boolean;
  onUpdate: (patch: PainelObraPatch) => void;
  onOpen: () => void;
}

function ObraRow({ obra, zebra, onUpdate, onOpen }: ObraRowProps) {
  const overdueColor =
    obra.overdue_count > 0
      ? 'bg-destructive text-destructive-foreground'
      : obra.pending_count > 0
        ? 'bg-amber-500 text-white'
        : 'bg-muted text-muted-foreground';

  return (
    <TableRow className={cn(zebra && 'bg-muted/30')}>
      {/* Nome da obra (link p/ detalhes; não editável aqui) */}
      <TableCell className={cn('font-bold sticky left-0 z-10', zebra ? 'bg-muted/30' : 'bg-background')}>
        <button
          type="button"
          onClick={onOpen}
          className="text-left hover:text-primary transition-colors flex items-center gap-1.5 group"
          title="Abrir obra"
        >
          <span className="truncate">{obra.nome}</span>
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </TableCell>

      {/* Cliente (negrito por preferência registrada) */}
      <TableCell className="font-bold text-sm">
        {obra.customer_name ?? <span className="italic text-muted-foreground">—</span>}
      </TableCell>

      {/* Responsável */}
      <TableCell className="text-sm">
        {obra.engineer_name ?? <span className="italic text-muted-foreground">—</span>}
      </TableCell>

      {/* Prazo - texto livre */}
      <TableCell>
        <TextCell value={obra.prazo} onSave={(v) => onUpdate({ prazo: v })} placeholder="—" />
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

      {/* Etapa */}
      <TableCell>
        <Select
          value={obra.etapa ?? NONE}
          onValueChange={(v) => onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })}
        >
          <SelectTrigger className="h-8 text-sm border-0 shadow-none hover:bg-accent">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhuma)</SelectItem>
            {ETAPA_OPTIONS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Início da etapa */}
      <TableCell>
        <DateCell value={obra.inicio_etapa} onChange={(v) => onUpdate({ inicio_etapa: v })} />
      </TableCell>

      {/* Previsão de avanço */}
      <TableCell>
        <DateCell
          value={obra.previsao_avanco}
          onChange={(v) => onUpdate({ previsao_avanco: v })}
        />
      </TableCell>

      {/* Status */}
      <TableCell>
        <Select
          value={obra.status ?? NONE}
          onValueChange={(v) => onUpdate({ status: v === NONE ? null : (v as PainelStatus) })}
        >
          <SelectTrigger className="h-8 text-sm border-0 shadow-none hover:bg-accent p-0 [&>span]:w-full">
            {obra.status ? (
              <Badge className={cn('w-full justify-center', statusBadgeClass(obra.status))}>
                {obra.status}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm pl-2">Selecionar...</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                <Badge className={cn('px-2 py-0.5', statusBadgeClass(s))}>{s}</Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Progresso (%) — somente leitura */}
      <TableCell className="text-right tabular-nums text-sm">
        {obra.progress_percentage != null ? (
          <span className={cn(obra.progress_percentage >= 100 && 'text-green-600 font-semibold')}>
            {obra.progress_percentage}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Pendências (vermelho se atrasadas) */}
      <TableCell className="text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={cn('tabular-nums', overdueColor)}>
              {obra.pending_count}
              {obra.overdue_count > 0 && ` (${obra.overdue_count}↓)`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {obra.pending_count} pendência(s)
            {obra.overdue_count > 0 ? ` · ${obra.overdue_count} atrasada(s)` : ''}
          </TooltipContent>
        </Tooltip>
      </TableCell>

      {/* Última atualização */}
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground cursor-default">
              {fmtDate(obra.ultima_atualizacao)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{fmtDateTime(obra.ultima_atualizacao)}</TooltipContent>
        </Tooltip>
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
          <SelectTrigger className="h-8 text-sm border-0 shadow-none hover:bg-accent p-0 [&>span]:w-full">
            {obra.relacionamento ? (
              <Badge
                className={cn(
                  'w-full justify-center',
                  relacionamentoBadgeClass(obra.relacionamento),
                )}
              >
                {obra.relacionamento}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm pl-2">Selecionar...</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {RELACIONAMENTO_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                <Badge className={cn('px-2 py-0.5', relacionamentoBadgeClass(r))}>{r}</Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Ação: abrir obra */}
      <TableCell>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={onOpen}
          title="Abrir obra"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
