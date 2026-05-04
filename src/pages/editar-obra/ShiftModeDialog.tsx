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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarRange, Maximize2 } from 'lucide-react';
import { shiftActivityDates, type ShiftMode, type ShiftableActivity } from '@/lib/shiftActivityDates';
import { differenceInCalendarDays, parseISO } from 'date-fns';

interface ShiftModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startChanged: boolean;
  endChanged: boolean;
  activityCount: number;
  onConfirm: (mode: ShiftMode | null) => void;
  // New: preview inputs
  activities?: ShiftableActivity[];
  oldStart?: string | null;
  oldEnd?: string | null;
  newStart?: string | null;
  newEnd?: string | null;
}

function formatShiftDays(days: number): string {
  if (days === 0) return 'sem deslocamento';
  const abs = Math.abs(days);
  const dir = days > 0 ? 'adiante' : 'para trás';
  return `${abs} dia${abs === 1 ? '' : 's'} ${dir}`;
}

function formatScale(scale: number): string {
  if (Math.abs(scale - 1) < 0.001) return 'sem escala (durações mantidas)';
  const pct = Math.round(scale * 100);
  return scale > 1 ? `expansão para ${pct}%` : `compressão para ${pct}%`;
}

export function ShiftModeDialog({
  open,
  onOpenChange,
  startChanged,
  endChanged,
  activityCount,
  onConfirm,
  activities = [],
  oldStart = null,
  oldEnd = null,
  newStart = null,
  newEnd = null,
}: ShiftModeDialogProps) {
  const [mode, setMode] = useState<ShiftMode>('proportional');

  const handleConfirm = (chosen: ShiftMode | null) => {
    onOpenChange(false);
    onConfirm(chosen);
  };

  // If only the start changed, both modes produce the same result. Suggest preserve-duration.
  const onlyStart = startChanged && !endChanged;

  // Compute preview metrics for the selected mode
  const preview = useMemo(() => {
    if (!open || activities.length === 0) return null;

    const valid = activities.filter(a => a.planned_start && a.planned_end);
    if (valid.length === 0) return null;

    const starts = valid.map(a => parseISO(a.planned_start as string).getTime());
    const ends = valid.map(a => parseISO(a.planned_end as string).getTime());
    const oldActivityStart = new Date(Math.min(...starts));
    const oldActivityEnd = new Date(Math.max(...ends));

    const refOldStart = oldStart ? parseISO(oldStart) : oldActivityStart;
    const refOldEnd = oldEnd ? parseISO(oldEnd) : oldActivityEnd;

    const shiftDays = startChanged && newStart
      ? differenceInCalendarDays(parseISO(newStart), refOldStart)
      : 0;

    const newProjStart = newStart ? parseISO(newStart) : refOldStart;
    const newProjEnd = newEnd ? parseISO(newEnd) : refOldEnd;
    const oldSpan = differenceInCalendarDays(refOldEnd, refOldStart);
    const newSpan = differenceInCalendarDays(newProjEnd, newProjStart);
    const scale = mode === 'proportional' && endChanged && oldSpan > 0 && newSpan > 0
      ? newSpan / oldSpan
      : 1;

    // Run real shift to get exact changed count
    const { changedIds } = shiftActivityDates(activities, oldStart, oldEnd, newStart, newEnd, mode);

    return {
      shiftDays,
      scale,
      changedCount: changedIds.length,
      total: activities.length,
    };
  }, [open, mode, activities, oldStart, oldEnd, newStart, newEnd, startChanged, endChanged]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recalcular cronograma?</AlertDialogTitle>
          <AlertDialogDescription>
            Você alterou as datas planejadas do projeto. Como deseja atualizar as {activityCount} atividade(s) do cronograma?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ShiftMode)} className="space-y-3 py-2">
          <div
            className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
            onClick={() => setMode('preserve-duration')}
          >
            <RadioGroupItem value="preserve-duration" id="preserve" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="preserve" className="cursor-pointer font-medium">
                Manter duração de cada atividade
              </Label>
              <p className="text-tiny text-muted-foreground mt-1">
                Desloca todas as atividades a partir do novo início. Cada atividade conserva sua duração original. O novo término do projeto é ignorado.
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
            onClick={() => setMode('proportional')}
          >
            <RadioGroupItem value="proportional" id="proportional" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="proportional" className="cursor-pointer font-medium">
                Encaixar proporcionalmente na nova janela
                {onlyStart && <span className="text-tiny text-muted-foreground font-normal"> (igual ao anterior se só o início mudou)</span>}
              </Label>
              <p className="text-tiny text-muted-foreground mt-1">
                Escala as durações das atividades para preencher exatamente o intervalo entre o novo início e o novo fim do projeto.
              </p>
            </div>
          </div>
        </RadioGroup>

        {preview && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-tiny font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3" />
              Prévia do recálculo
            </p>
            <div className="grid gap-1.5 text-sm">
              <div className="flex items-start gap-2">
                <CalendarRange className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Deslocamento:</span>{' '}
                  <span className="text-foreground">{formatShiftDays(preview.shiftDays)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Escala:</span>{' '}
                  <span className="text-foreground">{formatScale(preview.scale)}</span>
                </div>
              </div>
              <div className="text-tiny text-muted-foreground pt-1 border-t border-border/50">
                {preview.changedCount === 0
                  ? 'Nenhuma atividade será alterada com essa configuração.'
                  : `${preview.changedCount} de ${preview.total} atividade(s) terão suas datas atualizadas.`}
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleConfirm(null)}>
            Não recalcular
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => handleConfirm(mode)}>
            Aplicar e salvar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
