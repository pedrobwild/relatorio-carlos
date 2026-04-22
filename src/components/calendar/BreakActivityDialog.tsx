/**
 * BreakActivityDialog — modal interno (Admin/Engineer) para quebrar uma
 * atividade-mãe do cronograma em N micro-etapas (sub-atividades).
 *
 * Regras de negócio:
 *  - As datas de cada micro-etapa devem ficar dentro do intervalo da mãe.
 *  - O título é obrigatório.
 *  - Pelo menos 2 micro-etapas para que o "quebrar" faça sentido.
 *  - O cliente continua vendo apenas a atividade-mãe (a UI do calendário
 *    para Admin/Engineer mostra os children no lugar da mãe).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  format,
  parseISO,
  addDays,
  differenceInCalendarDays,
  isWithinInterval,
  areIntervalsOverlapping,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Split, Trash2, Wand2, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
import type { WeekActivity, SubActivityInput } from '@/hooks/useWeekActivities';

interface Row {
  description: string;
  planned_start: Date;
  planned_end: Date;
}

interface Props {
  parent: WeekActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (parent: WeekActivity, subs: SubActivityInput[]) => Promise<unknown>;
  isSubmitting: boolean;
}

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');
const labelDate = (d: Date) => format(d, "dd 'de' MMM", { locale: ptBR });

/**
 * Pré-visualização compacta do intervalo de uma micro-etapa, ex.:
 *   - mesmo dia       → "Seg, 22/04"
 *   - mesma semana    → "Seg–Ter (22/04 → 23/04)"
 *   - cruzando semanas→ "Qua 24/04 → Sex 03/05 · 11 dias"
 * Mantém português abreviado (Seg, Ter…) para densidade visual.
 */
const WEEKDAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function describeRange(start: Date, end: Date): string {
  const days = differenceInCalendarDays(end, start) + 1;
  const sw = WEEKDAY_PT[start.getDay()];
  const ew = WEEKDAY_PT[end.getDay()];
  if (days === 1) return `${sw}, ${format(start, 'dd/MM')}`;
  if (days <= 7) return `${sw}–${ew} (${format(start, 'dd/MM')} → ${format(end, 'dd/MM')}) · ${days} dias`;
  return `${sw} ${format(start, 'dd/MM')} → ${ew} ${format(end, 'dd/MM')} · ${days} dias`;
}

export function BreakActivityDialog({
  parent,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);

  // Reseta os rows quando abre o dialog ou troca a atividade-mãe.
  useEffect(() => {
    if (parent && open) {
      const ps = parseISO(parent.planned_start);
      const pe = parseISO(parent.planned_end);
      const totalDays = differenceInCalendarDays(pe, ps) + 1;
      // Default: 2 micro-etapas dividindo o intervalo ao meio.
      if (totalDays >= 2) {
        const mid = Math.floor(totalDays / 2);
        setRows([
          { description: '', planned_start: ps, planned_end: addDays(ps, mid - 1) },
          { description: '', planned_start: addDays(ps, mid), planned_end: pe },
        ]);
      } else {
        setRows([{ description: '', planned_start: ps, planned_end: pe }]);
      }
    }
  }, [parent?.id, open]);

  const ps = parent ? parseISO(parent.planned_start) : null;
  const pe = parent ? parseISO(parent.planned_end) : null;
  const totalDays = ps && pe ? differenceInCalendarDays(pe, ps) + 1 : 0;

  // Validação por linha (aponta exatamente o que está errado em cada item)
  // + detecção de pares sobrepostos para bloquear o submit. As regras são:
  //   1) título obrigatório
  //   2) intervalo válido (fim ≥ início, ambos no escopo da mãe)
  //   3) sem sobreposição entre micro-etapas (mesmo 1 dia em comum bloqueia)
  type RowIssue =
    | { kind: 'no-title' }
    | { kind: 'inverted' }
    | { kind: 'before-parent' }
    | { kind: 'after-parent' }
    | { kind: 'overlap'; withIndex: number };

  const rowIssues = useMemo<RowIssue[][]>(() => {
    const issues: RowIssue[][] = rows.map(() => []);
    rows.forEach((r, i) => {
      if (!r.description.trim()) issues[i].push({ kind: 'no-title' });
      if (r.planned_end < r.planned_start) issues[i].push({ kind: 'inverted' });
      if (ps && r.planned_start < ps) issues[i].push({ kind: 'before-parent' });
      if (pe && r.planned_end > pe) issues[i].push({ kind: 'after-parent' });
    });
    // Detecção de sobreposição (par a par, intervalos inclusivos)
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      if (a.planned_end < a.planned_start) continue; // já marcado como invertido
      for (let j = i + 1; j < rows.length; j++) {
        const b = rows[j];
        if (b.planned_end < b.planned_start) continue;
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
  }, [rows, ps?.getTime(), pe?.getTime()]);

  // Cobertura de dias: ajuda o usuário a ver lacunas (dias da mãe não cobertos).
  const uncoveredDays = useMemo(() => {
    if (!ps || !pe) return 0;
    let count = 0;
    for (let d = ps; d <= pe; d = addDays(d, 1)) {
      const covered = rows.some(
        (r) =>
          r.planned_end >= r.planned_start &&
          isWithinInterval(d, { start: r.planned_start, end: r.planned_end }),
      );
      if (!covered) count++;
    }
    return count;
  }, [rows, ps?.getTime(), pe?.getTime()]);

  const errors = useMemo(() => {
    const out: string[] = [];
    if (rows.length < 2) out.push('Crie ao menos 2 micro-etapas para fazer sentido em quebrar.');
    rowIssues.forEach((list, i) => {
      list.forEach((iss) => {
        switch (iss.kind) {
          case 'no-title':
            out.push(`Micro-etapa ${i + 1}: título obrigatório.`);
            break;
          case 'inverted':
            out.push(`Micro-etapa ${i + 1}: data fim anterior ao início.`);
            break;
          case 'before-parent':
            out.push(`Micro-etapa ${i + 1}: início anterior ao da atividade-mãe.`);
            break;
          case 'after-parent':
            out.push(`Micro-etapa ${i + 1}: fim posterior ao da atividade-mãe.`);
            break;
          case 'overlap':
            // Reporta apenas no índice menor para evitar duplicação na lista geral.
            if (iss.withIndex > i) {
              out.push(`Micro-etapas ${i + 1} e ${iss.withIndex + 1} têm dias em comum.`);
            }
            break;
        }
      });
    });
    return out;
  }, [rows, rowIssues]);

  const canSubmit = errors.length === 0 && !isSubmitting;

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (!pe) return;
    const last = rows[rows.length - 1];
    const start = last ? addDays(last.planned_end, 1) : ps!;
    const safeStart = start > pe ? pe : start;
    setRows((prev) => [
      ...prev,
      { description: '', planned_start: safeStart, planned_end: pe },
    ]);
  };

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

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

  const handleConfirm = async () => {
    if (!parent || !canSubmit) return;
    const payload: SubActivityInput[] = rows.map((r) => ({
      description: r.description.trim(),
      planned_start: fmtDate(r.planned_start),
      planned_end: fmtDate(r.planned_end),
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
              ({totalDays} dia{totalDays > 1 ? 's' : ''}). As micro-etapas só são vistas pela equipe
              interna no Calendário. O cliente continua vendo apenas a atividade-mãe.
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 pb-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                {rows.length} micro-etapa{rows.length !== 1 ? 's' : ''}
              </Label>
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

            {rows.map((row, i) => {
              const issues = rowIssues[i] ?? [];
              const hasOverlap = issues.some((x) => x.kind === 'overlap');
              const hasOtherIssue = issues.some((x) => x.kind !== 'overlap' && x.kind !== 'no-title');
              const isInverted = issues.some((x) => x.kind === 'inverted');
              const overlapsWith = issues
                .filter((x): x is Extract<RowIssue, { kind: 'overlap' }> => x.kind === 'overlap')
                .map((x) => x.withIndex + 1);
              const isValid = issues.length === 0 && row.description.trim().length > 0;
              const days = isInverted
                ? 0
                : differenceInCalendarDays(row.planned_end, row.planned_start) + 1;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg border p-3 grid grid-cols-12 gap-2 items-end transition-colors',
                    hasOverlap || hasOtherIssue
                      ? 'border-destructive/60 bg-destructive/5'
                      : 'border-border bg-card',
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
                    <DatePopover
                      value={row.planned_start}
                      onChange={(d) => d && updateRow(i, { planned_start: d })}
                      min={ps ?? undefined}
                      max={pe ?? undefined}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-[11px] text-muted-foreground">Fim</Label>
                    <DatePopover
                      value={row.planned_end}
                      onChange={(d) => d && updateRow(i, { planned_end: d })}
                      min={ps ?? undefined}
                      max={pe ?? undefined}
                    />
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

                  {/* Pré-visualização legível do intervalo + sinalização de status */}
                  <div className="col-span-12 flex flex-wrap items-center gap-2 text-xs">
                    {isInverted ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Intervalo inválido (fim anterior ao início)
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-medium',
                          hasOverlap ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {describeRange(row.planned_start, row.planned_end)}
                      </span>
                    )}
                    {hasOverlap && (
                      <Badge variant="destructive" className="text-[10px]">
                        Sobrepõe com {overlapsWith.map((n) => `#${n}`).join(', ')}
                      </Badge>
                    )}
                    {isValid && days > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-primary/40 text-primary"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        OK · {days} dia{days > 1 ? 's' : ''}
                      </Badge>
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

            {/* Sumário de cobertura: ajuda o usuário a perceber lacunas sem ser bloqueante.
                Lacunas (dias não cobertos) são apenas um aviso — o submit só é bloqueado por
                erros reais (sobreposição, intervalo inválido ou título faltando). */}
            {totalDays > 0 && rows.length > 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-muted-foreground">
                  Cobertura: <strong className="text-foreground">{totalDays - uncoveredDays}</strong> de{' '}
                  <strong className="text-foreground">{totalDays}</strong> dia(s) da atividade-mãe.
                </span>
                {uncoveredDays > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    {uncoveredDays} dia(s) sem micro-etapa (lacuna)
                  </span>
                )}
                {uncoveredDays === 0 && errors.length === 0 && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    Todos os dias cobertos, sem sobreposição
                  </span>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                {errors.slice(0, 4).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {errors.length > 4 && <li>+{errors.length - 4} outro(s) ajuste(s) necessário(s)</li>}
              </ul>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            <Split className="h-4 w-4 mr-1" />
            Quebrar atividade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatePopover({
  value,
  onChange,
  min,
  max,
}: {
  value: Date;
  onChange: (d: Date | undefined) => void;
  min?: Date;
  max?: Date;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('w-full justify-start text-left font-normal mt-1')}
        >
          <CalendarIcon className="h-3.5 w-3.5 mr-2" />
          {format(value, 'dd/MM/yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={(d) => (min && d < min) || (max && d > max) || false}
          initialFocus
          locale={ptBR}
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
