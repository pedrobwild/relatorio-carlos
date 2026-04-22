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
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Split, Trash2, Wand2 } from 'lucide-react';
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

  const errors = useMemo(() => {
    const out: string[] = [];
    if (rows.length < 2) out.push('Crie ao menos 2 micro-etapas para fazer sentido em quebrar.');
    rows.forEach((r, i) => {
      if (!r.description.trim()) out.push(`Micro-etapa ${i + 1}: título obrigatório.`);
      if (r.planned_end < r.planned_start)
        out.push(`Micro-etapa ${i + 1}: data fim anterior ao início.`);
      if (ps && r.planned_start < ps)
        out.push(`Micro-etapa ${i + 1}: início anterior ao da atividade-mãe.`);
      if (pe && r.planned_end > pe)
        out.push(`Micro-etapa ${i + 1}: fim posterior ao da atividade-mãe.`);
    });
    return out;
  }, [rows, ps?.getTime(), pe?.getTime()]);

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

            {rows.map((row, i) => (
              <div
                key={i}
                className="rounded-lg border bg-card p-3 grid grid-cols-12 gap-2 items-end"
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
              </div>
            ))}

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

            {errors.length > 0 && (
              <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                {errors.slice(0, 3).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {errors.length > 3 && <li>+{errors.length - 3} outro(s) ajuste(s) necessário(s)</li>}
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
