/**
 * Painel de Obras — visão executiva tabular para acompanhamento operacional
 * de obras com edição inline, filtros e badges coloridos.
 *
 * Spec: 11 colunas (Prazo, Início Oficial, Entrega Oficial, Etapa, Início da
 * Etapa, Previsão de Avanço, Status, Última Atualização, Início Real,
 * Entrega Real, Relacionamento). Última atualização é automática (trigger DB).
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Filter, X, AlertTriangle, Table2, ShieldOff } from 'lucide-react';
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

const toIsoDate = (d: Date | undefined) =>
  d ? format(d, 'yyyy-MM-dd') : null;

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
  const { isAdmin, isStaff, loading: roleLoading } = useUserRole();
  const { obras, isLoading, createObra, updateObra, removeObra, isCreating } = usePainelObras();

  // Filtros
  const [filterEtapa, setFilterEtapa] = useState<string>(ALL);
  const [filterStatus, setFilterStatus] = useState<string>(ALL);
  const [filterRelacionamento, setFilterRelacionamento] = useState<string>(ALL);
  const [removeId, setRemoveId] = useState<string | null>(null);

  // Ordenação por colunas de data
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
  }, [obras, filterEtapa, filterStatus, filterRelacionamento, sortKey, sortDir]);

  const toggleSort = (key: NonNullable<SortKey>) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setFilterEtapa(ALL);
    setFilterStatus(ALL);
    setFilterRelacionamento(ALL);
  };

  const hasFilters =
    filterEtapa !== ALL || filterStatus !== ALL || filterRelacionamento !== ALL;

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
      {sortKey === k && (
        <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
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
                Visão executiva para acompanhamento operacional. Clique em qualquer célula
                para editar.
              </p>
            </div>
            <Button
              onClick={() =>
                createObra({
                  nome: 'Nova obra',
                  status: 'Em dia',
                  relacionamento: 'Normal',
                })
              }
              disabled={isCreating}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova obra
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/40 rounded-lg border border-border">
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
            title={obras.length === 0 ? 'Nenhuma obra ainda' : 'Nenhum resultado'}
            description={
              obras.length === 0
                ? 'Comece adicionando uma nova obra ao painel.'
                : 'Tente ajustar ou limpar os filtros.'
            }
          />
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                {/* Cabeçalho com fundo escuro e texto claro (per spec) */}
                <TableRow className="bg-foreground hover:bg-foreground border-foreground/20">
                  <TableHead className="text-background font-semibold min-w-[160px]">
                    Obra
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
                  {isAdmin && <TableHead className="text-white w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o, idx) => (
                  <ObraRow
                    key={o.id}
                    obra={o}
                    zebra={idx % 2 === 1}
                    isAdmin={isAdmin}
                    onUpdate={(patch) => updateObra(o.id, patch)}
                    onRequestRemove={() => setRemoveId(o.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Confirmação de exclusão */}
        <AlertDialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover obra do painel?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Os dados desta linha serão excluídos
                permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (removeId) removeObra(removeId);
                  setRemoveId(null);
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </TooltipProvider>
  );
}

// ----- row component -----
interface ObraRowProps {
  obra: PainelObra;
  zebra: boolean;
  isAdmin: boolean;
  onUpdate: (patch: Partial<PainelObra>) => void;
  onRequestRemove: () => void;
}

function ObraRow({ obra, zebra, isAdmin, onUpdate, onRequestRemove }: ObraRowProps) {
  return (
    <TableRow className={cn(zebra && 'bg-muted/30')}>
      {/* Nome da obra (identificador) */}
      <TableCell className="font-medium">
        <TextCell
          value={obra.nome}
          onSave={(v) => onUpdate({ nome: v })}
          placeholder="Nome da obra"
        />
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

      {/* Etapa - select */}
      <TableCell>
        <Select
          value={obra.etapa ?? NONE}
          onValueChange={(v) =>
            onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })
          }
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

      {/* Status - badge select */}
      <TableCell>
        <Select
          value={obra.status ?? NONE}
          onValueChange={(v) =>
            onUpdate({ status: v === NONE ? null : (v as PainelStatus) })
          }
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

      {/* Última atualização - automática, com tooltip */}
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

      {/* Relacionamento - badge select */}
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
                <Badge className={cn('px-2 py-0.5', relacionamentoBadgeClass(r))}>
                  {r}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Ação: remover (admin) */}
      {isAdmin && (
        <TableCell>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRequestRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
