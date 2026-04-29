/**
 * BreakActivityDialog — modal interno (Admin/Engineer) para quebrar uma
 * atividade-mãe do cronograma em N micro-etapas (sub-atividades).
 *
 * Regras de negócio:
 *  - As datas de cada micro-etapa devem ficar dentro do intervalo da mãe.
 *  - O título é obrigatório.
 *  - Pelo menos 2 micro-etapas para que o "quebrar" faça sentido.
 *  - Não pode haver sobreposição entre intervalos.
 *  - O intervalo de uma micro-etapa não pode cobrir dias não úteis
 *    (fins de semana, feriados nacionais/SP, ou dias customizados marcados
 *    como folga/feriado específico para a obra).
 *  - O cliente continua vendo apenas a atividade-mãe (a UI do calendário
 *    para Admin/Engineer mostra os children no lugar da mãe).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  format,
  parseISO,
  addDays,
  differenceInCalendarDays,
  areIntervalsOverlapping,
  eachDayOfInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarIcon,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  LayoutGrid,
  Plus,
  Split,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { isNonBusinessDay } from '@/lib/businessDays';
import { useNonWorkingDays } from '@/hooks/useNonWorkingDays';
import type { WeekActivity, SubActivityInput } from '@/hooks/useWeekActivities';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useFornecedoresPrestadores } from '@/hooks/useFornecedoresPrestadores';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Row {
  description: string;
  planned_start: Date;
  planned_end: Date;
  responsible_user_id: string | null;
  /**
   * Prestador (fornecedor terceirizado) que executará esta micro-etapa.
   * Indicado direto no mesmo modal — sem precisar abrir outro fluxo.
   */
  fornecedor_id: string | null;
}

const NO_RESPONSIBLE = '__none__';
const NO_FORNECEDOR = '__none__';

interface Props {
  parent: WeekActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (parent: WeekActivity, subs: SubActivityInput[]) => Promise<unknown>;
  isSubmitting: boolean;
  /**
   * Quantidade de micro-etapas (children) já existentes para a atividade-mãe.
   * Quando > 0, o dialog exibe a ação "Desfazer quebra", que remove todos os
   * children e restaura a atividade original como única no cronograma.
   */
  existingChildrenCount?: number;
  /**
   * Disparado ao confirmar o "Desfazer quebra" — deve remover todos os
   * children da atividade-mãe (idealmente via `mergeSubActivities`).
   */
  onUndoBreak?: (parent: WeekActivity) => Promise<unknown>;
  /** True enquanto a operação de undo está em andamento. */
  isUndoing?: boolean;
}

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');
const labelDate = (d: Date) => format(d, "dd 'de' MMM", { locale: ptBR });
const shortWeekday = (d: Date) =>
  format(d, 'EEE', { locale: ptBR }).replace('.', '').replace(/^./, (c) => c.toUpperCase());

export function BreakActivityDialog({
  parent,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  existingChildrenCount = 0,
  onUndoBreak,
  isUndoing = false,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  /** Confirmação para a ação destrutiva "Desfazer quebra" (apaga todos os children). */
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  /** Tamanho (em dias úteis) de cada bloco gerado pelo "Cobrir 100%". */
  const [chunkSize, setChunkSize] = useState<number>(2);
  const { data: staffUsers = [], isLoading: loadingStaff } = useStaffUsers();
  const { data: prestadores = [], isLoading: loadingPrestadores } = useFornecedoresPrestadores();
  const { isNonWorking: isCustomNonWorking, reasonFor } = useNonWorkingDays(parent?.project_id);

  /** True quando o dia é fim de semana, feriado SP/nacional OU custom (folga/feriado obra). */
  const isBlockedDay = (d: Date): boolean => isNonBusinessDay(d) || isCustomNonWorking(d);

  /** Lista os dias bloqueados que caem dentro do intervalo informado. */
  const blockedDaysInRange = (start: Date, end: Date): Date[] => {
    if (end < start) return [];
    return eachDayOfInterval({ start, end }).filter(isBlockedDay);
  };

  // Reseta os rows quando abre o dialog ou troca a atividade-mãe.
  useEffect(() => {
    if (parent && open) {
      const ps = parseISO(parent.planned_start);
      const pe = parseISO(parent.planned_end);
      const totalDays = differenceInCalendarDays(pe, ps) + 1;
      // Default: 2 micro-etapas dividindo o intervalo ao meio.
      const inheritedResp = parent?.responsible_user_id ?? null;
      const inheritedForn = parent?.fornecedor_id ?? null;
      if (totalDays >= 2) {
        const mid = Math.floor(totalDays / 2);
        setRows([
          { description: '', planned_start: ps, planned_end: addDays(ps, mid - 1), responsible_user_id: inheritedResp, fornecedor_id: inheritedForn },
          { description: '', planned_start: addDays(ps, mid), planned_end: pe, responsible_user_id: inheritedResp, fornecedor_id: inheritedForn },
        ]);
      } else {
        setRows([{ description: '', planned_start: ps, planned_end: pe, responsible_user_id: inheritedResp, fornecedor_id: inheritedForn }]);
      }
    }
  }, [parent?.id, open]);

  const ps = parent ? parseISO(parent.planned_start) : null;
  const pe = parent ? parseISO(parent.planned_end) : null;
  const totalDays = ps && pe ? differenceInCalendarDays(pe, ps) + 1 : 0;

  /**
   * Diagnóstico por linha: lista os problemas estruturais (datas inválidas,
   * fora do range da mãe, dias bloqueados cobertos) E também sobreposições
   * com outras linhas. Usado tanto para bloquear o submit quanto para exibir
   * feedback inline em cada cartão.
   */
  type RowIssue =
    | { kind: 'no-title' }
    | { kind: 'inverted' }
    | { kind: 'before-parent' }
    | { kind: 'after-parent' }
    | { kind: 'blocked-days'; days: Date[] }
    | { kind: 'overlap'; withIndex: number };

  const rowIssues = useMemo<RowIssue[][]>(() => {
    const issues: RowIssue[][] = rows.map(() => []);
    rows.forEach((r, i) => {
      if (!r.description.trim()) issues[i].push({ kind: 'no-title' });
      if (r.planned_end < r.planned_start) issues[i].push({ kind: 'inverted' });
      if (ps && r.planned_start < ps) issues[i].push({ kind: 'before-parent' });
      if (pe && r.planned_end > pe) issues[i].push({ kind: 'after-parent' });
      const blocked = blockedDaysInRange(r.planned_start, r.planned_end);
      if (blocked.length > 0) issues[i].push({ kind: 'blocked-days', days: blocked });
    });
    // Detecção de sobreposição entre pares
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (a.planned_end < a.planned_start || b.planned_end < b.planned_start) continue;
        const overlaps = areIntervalsOverlapping(
          { start: a.planned_start, end: a.planned_end },
          { start: b.planned_start, end: b.planned_end },
          { inclusive: true },
        );
        if (overlaps) {
          issues[i].push({ kind: 'overlap', withIndex: j });
          issues[j].push({ kind: 'overlap', withIndex: i });
        }
      }
    }
    return issues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ps?.getTime(), pe?.getTime(), isCustomNonWorking]);

  const totalIssues = rowIssues.reduce((acc, arr) => acc + arr.length, 0);
  const minRowsViolated = rows.length < 2;
  const canSubmit = !minRowsViolated && totalIssues === 0 && !isSubmitting;

  // Métricas de cobertura para exibição no rodapé.
  const businessDaysInParent = useMemo(() => {
    if (!ps || !pe || pe < ps) return 0;
    return eachDayOfInterval({ start: ps, end: pe }).filter((d) => !isBlockedDay(d)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ps?.getTime(), pe?.getTime(), isCustomNonWorking]);

  const businessDaysCovered = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.planned_end < r.planned_start) continue;
      for (const d of eachDayOfInterval({ start: r.planned_start, end: r.planned_end })) {
        if (!isBlockedDay(d)) set.add(format(d, 'yyyy-MM-dd'));
      }
    }
    return set.size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isCustomNonWorking]);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (!pe) return;
    const last = rows[rows.length - 1];
    const start = last ? addDays(last.planned_end, 1) : ps!;
    const safeStart = start > pe ? pe : start;
    setRows((prev) => [...prev, { description: '', planned_start: safeStart, planned_end: pe, responsible_user_id: parent?.responsible_user_id ?? null }]);
  };

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  /**
   * Avança/recua uma data em N dias *úteis*, pulando fins de semana, feriados
   * e dias customizados como folga. Respeita os limites da atividade-mãe.
   * Retorna `null` se não houver dia útil disponível dentro do range.
   */
  const shiftBusinessDays = (date: Date, delta: number): Date | null => {
    if (delta === 0) return date;
    const step = delta > 0 ? 1 : -1;
    let remaining = Math.abs(delta);
    let cursor = date;
    while (remaining > 0) {
      cursor = addDays(cursor, step);
      if (ps && cursor < ps) return null;
      if (pe && cursor > pe) return null;
      if (!isBlockedDay(cursor)) remaining -= 1;
    }
    return cursor;
  };

  /** Nudge no início (mantém o fim fixo). */
  const nudgeStart = (i: number, delta: number) => {
    const row = rows[i];
    const next = shiftBusinessDays(row.planned_start, delta);
    if (!next || next > row.planned_end) return;
    updateRow(i, { planned_start: next });
  };

  /** Nudge no fim (mantém o início fixo). */
  const nudgeEnd = (i: number, delta: number) => {
    const row = rows[i];
    const next = shiftBusinessDays(row.planned_end, delta);
    if (!next || next < row.planned_start) return;
    updateRow(i, { planned_end: next });
  };

  /**
   * "Encaixa" a micro-etapa logo após o fim da anterior, pulando dias
   * bloqueados. Preserva a duração (em dias corridos) sempre que possível;
   * caso o range remanescente não comporte, encurta para caber.
   */
  const snapAfterPrevious = (i: number) => {
    if (i === 0 || !pe) return;
    const prev = rows[i - 1];
    if (prev.planned_end >= pe) return;
    let nextStart = addDays(prev.planned_end, 1);
    while (nextStart <= pe && isBlockedDay(nextStart)) nextStart = addDays(nextStart, 1);
    if (nextStart > pe) return;
    const current = rows[i];
    const currentSpan =
      current.planned_end >= current.planned_start
        ? differenceInCalendarDays(current.planned_end, current.planned_start) + 1
        : 1;
    let nextEnd = addDays(nextStart, currentSpan - 1);
    if (nextEnd > pe) nextEnd = pe;
    updateRow(i, { planned_start: nextStart, planned_end: nextEnd });
  };

  /** Distribui igualmente os dias entre as micro-etapas existentes. */
  const distributeEvenly = () => {
    if (!ps || !pe || rows.length === 0) return;
    const perChunk = Math.max(1, Math.floor(totalDays / rows.length));
    const next: Row[] = rows.map((r, i) => {
      const start = addDays(ps, i * perChunk);
      const end = i === rows.length - 1 ? pe : addDays(ps, (i + 1) * perChunk - 1);
      return { ...r, planned_start: start, planned_end: end };
    });
    setRows(next);
  };

  /**
   * Gera automaticamente micro-etapas para cobrir 100% dos dias *úteis* da
   * atividade-mãe em blocos do tamanho informado. Pula fins de semana,
   * feriados e folgas. O último bloco pode ser menor que `size` para fechar
   * exatamente no fim da atividade-mãe (sem deixar dias úteis descobertos).
   *
   * Substitui as linhas atuais (mantém esta operação como uma "ação" — o
   * usuário pode editar título/datas em seguida normalmente).
   */
  const generateChunks = (size: number) => {
    if (!ps || !pe) return;
    const safeSize = Math.max(1, Math.floor(size));
    // Lista ordenada de dias úteis dentro do range da mãe.
    const businessDays = eachDayOfInterval({ start: ps, end: pe }).filter(
      (d) => !isBlockedDay(d),
    );
    if (businessDays.length === 0) {
      setRows([]);
      return;
    }
    const next: Row[] = [];
    for (let i = 0; i < businessDays.length; i += safeSize) {
      const chunk = businessDays.slice(i, i + safeSize);
      const start = chunk[0];
      const end = chunk[chunk.length - 1];
      next.push({
        description: `Parte ${next.length + 1}`,
        planned_start: start,
        planned_end: end,
        responsible_user_id: parent?.responsible_user_id ?? null,
      });
    }
    setRows(next);
  };

  const handleConfirm = async () => {
    if (!parent || !canSubmit) return;
    const payload: SubActivityInput[] = rows.map((r) => ({
      description: r.description.trim(),
      planned_start: fmtDate(r.planned_start),
      planned_end: fmtDate(r.planned_end),
      responsible_user_id: r.responsible_user_id,
    }));
    await onConfirm(parent, payload);
    onOpenChange(false);
  };

  if (!parent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            <DialogTitle>Quebrar em micro-etapas</DialogTitle>
          </div>
          <DialogDescription className="space-y-1">
            <span className="block">
              <strong>{parent.description}</strong>
              {parent.etapa && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {parent.etapa}
                </Badge>
              )}
            </span>
            <span className="block text-xs">
              Período da atividade-mãe:{' '}
              <strong>
                {ps && labelDate(ps)} → {pe && labelDate(pe)}
              </strong>{' '}
              ({totalDays} dia{totalDays > 1 ? 's' : ''} corridos · {businessDaysInParent} útei
              {businessDaysInParent !== 1 ? 's' : ''}). Fins de semana, feriados e folgas marcadas
              não podem ser cobertos.
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-xs text-muted-foreground">
                {rows.length} micro-etapa{rows.length !== 1 ? 's' : ''}
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Gerador automático: cobre 100% dos dias úteis em blocos de N dias */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1"
                  title="Gera micro-etapas cobrindo 100% dos dias úteis da atividade-mãe, em blocos do tamanho escolhido. Pula fins de semana, feriados e folgas."
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Cobrir 100% em blocos de</span>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, businessDaysInParent || 1)}
                    value={chunkSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v) && v > 0) setChunkSize(v);
                    }}
                    className="h-7 w-14 px-2 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    dia{chunkSize !== 1 ? 's' : ''} úte{chunkSize !== 1 ? 'is' : 'l'}
                    {businessDaysInParent > 0 && (
                      <>
                        {' '}
                        ·{' '}
                        <strong className="text-foreground">
                          {Math.ceil(businessDaysInParent / Math.max(1, chunkSize))}
                        </strong>{' '}
                        bloco{Math.ceil(businessDaysInParent / Math.max(1, chunkSize)) !== 1 ? 's' : ''}
                      </>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => generateChunks(chunkSize)}
                    disabled={!ps || !pe || businessDaysInParent === 0}
                  >
                    Gerar
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={distributeEvenly}
                  title="Distribuir os dias entre as micro-etapas existentes"
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Distribuir igualmente
                </Button>
              </div>
            </div>

            {rows.map((row, i) => {
              const issues = rowIssues[i] ?? [];
              const hasError = issues.length > 0;
              const span =
                row.planned_end >= row.planned_start
                  ? differenceInCalendarDays(row.planned_end, row.planned_start) + 1
                  : 0;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg border bg-card p-3 grid grid-cols-12 gap-2 items-end transition-colors',
                    hasError && 'border-destructive/40 bg-destructive/5',
                  )}
                >
                  <div className="col-span-12 md:col-span-5">
                    <Label htmlFor={`desc-${i}`} className="text-[11px] text-muted-foreground">
                      Título da micro-etapa {i + 1}
                    </Label>
                    <Input
                      id={`desc-${i}`}
                      value={row.description}
                      onChange={(e) => updateRow(i, { description: e.target.value })}
                      placeholder={`Ex.: Parte ${i + 1} – descrição interna`}
                      className="mt-1"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-[11px] text-muted-foreground">Início</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-7 shrink-0"
                        onClick={() => nudgeStart(i, -1)}
                        title="Recuar 1 dia útil (mantém o fim)"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <DatePopover
                        value={row.planned_start}
                        onChange={(d) => d && updateRow(i, { planned_start: d })}
                        min={ps ?? undefined}
                        max={pe ?? undefined}
                        isBlocked={isBlockedDay}
                        reasonFor={reasonFor}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-7 shrink-0"
                        onClick={() => nudgeStart(i, 1)}
                        title="Avançar 1 dia útil (mantém o fim)"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-[11px] text-muted-foreground">Fim</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-7 shrink-0"
                        onClick={() => nudgeEnd(i, -1)}
                        title="Recuar 1 dia útil (mantém o início)"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <DatePopover
                        value={row.planned_end}
                        onChange={(d) => d && updateRow(i, { planned_end: d })}
                        min={ps ?? undefined}
                        max={pe ?? undefined}
                        isBlocked={isBlockedDay}
                        reasonFor={reasonFor}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-7 shrink-0"
                        onClick={() => nudgeEnd(i, 1)}
                        title="Avançar 1 dia útil (mantém o início)"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-1 flex md:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(i)}
                      disabled={rows.length <= 1}
                      title="Remover esta micro-etapa"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Responsável pela micro-etapa (Staff interno) */}
                  <div className="col-span-12 md:col-span-6">
                    <Label className="text-[11px] text-muted-foreground">Responsável</Label>
                    <Select
                      value={row.responsible_user_id ?? NO_RESPONSIBLE}
                      onValueChange={(value) =>
                        updateRow(i, {
                          responsible_user_id: value === NO_RESPONSIBLE ? null : value,
                        })
                      }
                      disabled={loadingStaff}
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue placeholder={loadingStaff ? 'Carregando...' : 'Selecionar responsável'} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value={NO_RESPONSIBLE}>Sem responsável</SelectItem>
                        {staffUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview / status do intervalo */}
                  <div className="col-span-12 -mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                    {span > 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {hasError ? (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        )}
                        <strong className="text-foreground">
                          {shortWeekday(row.planned_start)}–{shortWeekday(row.planned_end)}
                        </strong>{' '}
                        ({format(row.planned_start, 'dd/MM')} → {format(row.planned_end, 'dd/MM')})
                        · {span} dia{span !== 1 ? 's' : ''}
                      </span>
                    )}
                    {issues.map((iss, k) => (
                      <IssueBadge key={k} issue={iss} />
                    ))}
                    {/* Atalho contextual: aparece quando a linha sobrepõe a anterior */}
                    {i > 0 && issues.some((iss) => iss.kind === 'overlap' && iss.withIndex === i - 1) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => snapAfterPrevious(i)}
                        title={`Mover esta micro-etapa para logo após o fim da #${i}`}
                      >
                        <CornerDownRight className="h-3 w-3" />
                        Encaixar após #{i}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}


            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar micro-etapa
            </Button>

            {/* Cobertura agregada */}
            {ps && pe && businessDaysInParent > 0 && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />
                Cobertura:{' '}
                <strong className="text-foreground">
                  {businessDaysCovered} de {businessDaysInParent} dia
                  {businessDaysInParent !== 1 ? 's' : ''} útei{businessDaysInParent !== 1 ? 's' : ''}
                </strong>
                {businessDaysCovered < businessDaysInParent && (
                  <span className="text-amber-600">
                    · {businessDaysInParent - businessDaysCovered} dia(s) sem cobertura
                  </span>
                )}
              </div>
            )}

            {minRowsViolated && (
              <p className="text-xs text-destructive">
                Crie ao menos 2 micro-etapas para fazer sentido em quebrar.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          {/* Ação destrutiva: aparece apenas quando já existem micro-etapas para esta mãe. */}
          {existingChildrenCount > 0 && onUndoBreak ? (
            <Button
              variant="ghost"
              onClick={() => setConfirmUndoOpen(true)}
              disabled={isSubmitting || isUndoing}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title={`Remove as ${existingChildrenCount} micro-etapa(s) e mantém apenas a atividade original.`}
            >
              <Undo2 className="h-4 w-4 mr-1" />
              {isUndoing ? 'Desfazendo…' : `Desfazer quebra (${existingChildrenCount})`}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isUndoing}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!canSubmit || isUndoing}>
              <Split className="h-4 w-4 mr-1" />
              Quebrar atividade
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Confirmação destrutiva — exigida pelo padrão de UI Safety. */}
      <AlertDialog open={confirmUndoOpen} onOpenChange={setConfirmUndoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer quebra em micro-etapas?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto vai remover {existingChildrenCount} micro-etapa
              {existingChildrenCount !== 1 ? 's' : ''} de
              {' '}
              <strong>{parent?.description}</strong> e restaurar a atividade original como única
              no cronograma. As datas e responsáveis das micro-etapas serão perdidos. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Manter micro-etapas</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!parent || !onUndoBreak) return;
                try {
                  await onUndoBreak(parent);
                  setConfirmUndoOpen(false);
                  onOpenChange(false);
                } catch {
                  // Erro já exibido via toast no hook.
                }
              }}
              disabled={isUndoing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              {isUndoing ? 'Desfazendo…' : 'Desfazer quebra'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function IssueBadge({
  issue,
}: {
  issue:
    | { kind: 'no-title' }
    | { kind: 'inverted' }
    | { kind: 'before-parent' }
    | { kind: 'after-parent' }
    | { kind: 'blocked-days'; days: Date[] }
    | { kind: 'overlap'; withIndex: number };
}) {
  switch (issue.kind) {
    case 'no-title':
      return (
        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
          Título obrigatório
        </Badge>
      );
    case 'inverted':
      return (
        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
          Fim antes do início
        </Badge>
      );
    case 'before-parent':
      return (
        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
          Início fora da mãe
        </Badge>
      );
    case 'after-parent':
      return (
        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
          Fim fora da mãe
        </Badge>
      );
    case 'overlap':
      return (
        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
          Sobrepõe a #{issue.withIndex + 1}
        </Badge>
      );
    case 'blocked-days': {
      const preview = issue.days
        .slice(0, 3)
        .map((d) => format(d, 'dd/MM'))
        .join(', ');
      const more = issue.days.length > 3 ? ` +${issue.days.length - 3}` : '';
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-destructive/40 text-destructive inline-flex items-center gap-1"
        >
          <CalendarOff className="h-3 w-3" />
          Cobre dia(s) não útil(eis): {preview}
          {more}
        </Badge>
      );
    }
  }
}

function DatePopover({
  value,
  onChange,
  min,
  max,
  isBlocked,
  reasonFor,
}: {
  value: Date;
  onChange: (d: Date | undefined) => void;
  min?: Date;
  max?: Date;
  isBlocked: (d: Date) => boolean;
  reasonFor: (d: Date) => string | null;
}) {
  const valueIsBlocked = isBlocked(value);
  const reason = valueIsBlocked ? reasonFor(value) : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-full justify-start text-left font-normal mt-1',
            valueIsBlocked && 'border-destructive/40 text-destructive',
          )}
          title={
            valueIsBlocked
              ? `Dia não útil${reason ? ` — ${reason}` : ' (fim de semana/feriado)'}`
              : undefined
          }
        >
          {valueIsBlocked ? (
            <CalendarOff className="h-3.5 w-3.5 mr-2" />
          ) : (
            <CalendarIcon className="h-3.5 w-3.5 mr-2" />
          )}
          {format(value, 'dd/MM/yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          // Apenas as bordas (min/max) são realmente desabilitadas. Dias não úteis
          // são marcados visualmente via `modifiers` para o usuário entender por
          // que aquele dia geraria conflito, mas continuam selecionáveis caso a
          // intenção seja apenas tocar levemente o limite (a validação no
          // submit explica claramente o problema).
          disabled={(d) => (min && d < min) || (max && d > max) || false}
          modifiers={{ blocked: (d) => isBlocked(d) }}
          modifiersClassNames={{
            blocked:
              'line-through text-destructive/70 opacity-90 hover:text-destructive',
          }}
          initialFocus
          locale={ptBR}
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
