import { useEffect, useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  Clock,
  FileText,
  History,
  Layers,
  Save,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { WeekActivity } from '@/hooks/useWeekActivities';

interface ActivityDetailDialogProps {
  activity: WeekActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    activityId: string,
    updates: { actual_start?: string | null; actual_end?: string | null },
  ) => Promise<unknown>;
  isUpdating: boolean;
  /**
   * Sub-atividades (micro-etapas) já cadastradas para esta atividade-mãe.
   * Vem do dataset da página (visível só para Admin/Engineer).
   */
  subActivities?: WeekActivity[];
  /** Se true, exibe a seção de quebra em micro-etapas (Admin/Engineer). */
  canBreak?: boolean;
  /** Callback para abrir o diálogo de quebra. */
  onBreak?: (parent: WeekActivity) => void;
  /** Callback para mesclar (apagar todas as micro-etapas). */
  onMerge?: (parentId: string) => Promise<unknown>;
  /** Callback para remover uma micro-etapa específica. */
  onRemoveSub?: (subId: string) => Promise<unknown>;
  /** Callback para abrir/focar uma micro-etapa específica. */
  onOpenSub?: (sub: WeekActivity) => void;
  isMerging?: boolean;
  isRemovingSub?: boolean;
}

const toDate = (s: string | null | undefined) => (s ? parseISO(s) : undefined);
const fromDate = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null);

export function ActivityDetailDialog({
  activity,
  open,
  onOpenChange,
  onSave,
  isUpdating,
}: ActivityDetailDialogProps) {
  const [actualStart, setActualStart] = useState<Date | undefined>();
  const [actualEnd, setActualEnd] = useState<Date | undefined>();
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    if (activity) {
      setActualStart(toDate(activity.actual_start));
      setActualEnd(toDate(activity.actual_end));
    }
  }, [activity]);

  if (!activity) return null;

  const ps = parseISO(activity.planned_start);
  const pe = parseISO(activity.planned_end);
  const plannedDays = differenceInCalendarDays(pe, ps) + 1;

  const dirty =
    fromDate(actualStart) !== (activity.actual_start ?? null) ||
    fromDate(actualEnd) !== (activity.actual_end ?? null);

  const handleSave = async () => {
    await onSave(activity.id, {
      actual_start: fromDate(actualStart),
      actual_end: fromDate(actualEnd),
    });
    setConfirmSaveOpen(false);
    onOpenChange(false);
  };

  const handleClear = async () => {
    setActualStart(undefined);
    setActualEnd(undefined);
    await onSave(activity.id, { actual_start: null, actual_end: null });
    setConfirmClearOpen(false);
    onOpenChange(false);
  };

  const formatPreview = (d: Date | undefined) =>
    d ? format(d, "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : '—';

  // Build inline history from available signals
  type Event = { date: string; label: string; tone: 'muted' | 'info' | 'success' | 'warn' };
  const history: Event[] = [];
  history.push({
    date: activity.created_at,
    label: 'Atividade criada no cronograma',
    tone: 'muted',
  });
  if (activity.baseline_saved_at) {
    history.push({
      date: activity.baseline_saved_at,
      label: `Baseline registrado (${format(parseISO(activity.baseline_start!), 'dd/MM')} → ${format(
        parseISO(activity.baseline_end!),
        'dd/MM',
      )})`,
      tone: 'info',
    });
  }
  if (activity.actual_start) {
    history.push({
      date: activity.actual_start,
      label: 'Início real registrado',
      tone: 'info',
    });
  }
  if (activity.actual_end) {
    history.push({
      date: activity.actual_end,
      label: 'Conclusão real registrada',
      tone: 'success',
    });
  }
  if (
    activity.updated_at &&
    activity.updated_at !== activity.created_at &&
    !activity.actual_end
  ) {
    history.push({
      date: activity.updated_at,
      label: 'Atividade atualizada',
      tone: 'muted',
    });
  }
  history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const toneClass: Record<Event['tone'], string> = {
    muted: 'bg-muted-foreground',
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warn: 'bg-amber-500',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {activity.etapa && (
                <Badge variant="outline" className="mb-2 text-[10px]">
                  {activity.etapa}
                </Badge>
              )}
              <DialogTitle className="text-lg leading-tight pr-8">
                {activity.description}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {activity.project_name}
                {activity.client_name && ` · Cliente: ${activity.client_name}`}
                {' · '}Peso {activity.weight}%
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-2">
            {/* Planned dates summary */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                Planejamento
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">Início previsto</div>
                  <div className="font-medium">
                    {format(ps, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Fim previsto</div>
                  <div className="font-medium">
                    {format(pe, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </div>
                </div>
                <div className="col-span-2 text-[11px] text-muted-foreground">
                  Duração planejada: <strong>{plannedDays} dia(s)</strong>
                </div>
              </div>
            </div>

            {/* Editable actual dates */}
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Clock className="h-3.5 w-3.5" />
                Datas reais
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateField
                  label="Início real"
                  value={actualStart}
                  onChange={setActualStart}
                  onClear={() => setActualStart(undefined)}
                />
                <DateField
                  label="Fim real"
                  value={actualEnd}
                  onChange={setActualEnd}
                  onClear={() => setActualEnd(undefined)}
                />
              </div>
              {actualStart && actualEnd && actualEnd < actualStart && (
                <p className="text-xs text-destructive mt-2">
                  O fim real não pode ser antes do início real.
                </p>
              )}
            </div>

            {/* Detailed description */}
            {activity.detailed_description && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                    <FileText className="h-3.5 w-3.5" />
                    Descrição completa
                  </div>
                  <div className="rounded-md border bg-card p-3 text-sm whitespace-pre-wrap leading-relaxed">
                    {activity.detailed_description}
                  </div>
                </div>
              </>
            )}

            {/* History */}
            <Separator />
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                <History className="h-3.5 w-3.5" />
                Histórico
              </div>
              <ol className="space-y-3">
                {history.map((ev, idx) => (
                  <li key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn('h-2 w-2 rounded-full mt-1.5', toneClass[ev.tone])} />
                      {idx < history.length - 1 && (
                        <span className="flex-1 w-px bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="text-sm">{ev.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(parseISO(ev.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClearOpen(true)}
            disabled={isUpdating || (!activity.actual_start && !activity.actual_end)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpar datas
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmSaveOpen(true)}
              disabled={
                isUpdating ||
                !dirty ||
                Boolean(actualStart && actualEnd && actualEnd < actualStart)
              }
            >
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Confirm Save */}
      <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de datas reais</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Você está prestes a registrar as seguintes datas reais para esta atividade:</p>
                <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                  <div>
                    <span className="text-muted-foreground">Início real: </span>
                    <strong className="text-foreground">{formatPreview(actualStart)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fim real: </span>
                    <strong className="text-foreground">{formatPreview(actualEnd)}</strong>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Esta alteração ficará registrada no histórico da atividade.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={isUpdating}>
              Confirmar e salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Clear */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar datas reais?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá o início e o fim reais já registrados. A atividade voltará a ser tratada
              como pendente segundo o planejamento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, limpar datas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

interface DateFieldProps {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  onClear: () => void;
}

function DateField({ label, value, onChange, onClear }: DateFieldProps) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground block mb-1">{label}</label>
      <div className="flex gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'flex-1 justify-start text-left font-normal',
                !value && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-2" />
              {value ? format(value, "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : 'Selecionar'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={onChange}
              initialFocus
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-9 w-9 shrink-0"
            title="Limpar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
