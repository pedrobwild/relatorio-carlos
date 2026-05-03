import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, CalendarCheck2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { recalculateWeeklyActivities, parseISODateLocal } from '@/lib/weeklySchedule';
import type { Activity } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
  startDate: string | null;
  currentEndDate: string | null;
  isBusy?: boolean;
  onConfirm: () => void;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return format(parseISODateLocal(iso), "dd 'de' MMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function WeeklyRecalcPreviewDialog({
  open,
  onOpenChange,
  activities,
  startDate,
  currentEndDate,
  isBusy,
  onConfirm,
}: Props) {
  const ordered = useMemo(
    () => [...activities].sort((a, b) => a.sort_order - b.sort_order),
    [activities],
  );

  const preview = useMemo(() => {
    if (!startDate || ordered.length === 0) return [];
    return recalculateWeeklyActivities(ordered, startDate);
  }, [ordered, startDate]);

  const previewById = useMemo(() => new Map(preview.map((p) => [p.id, p])), [preview]);

  const changedCount = useMemo(
    () =>
      ordered.filter((a) => {
        const r = previewById.get(a.id);
        return r && (r.planned_start !== a.planned_start || r.planned_end !== a.planned_end);
      }).length,
    [ordered, previewById],
  );

  const newEndDate = preview.length > 0 ? preview[preview.length - 1].planned_end : null;
  const endChanged = !!newEndDate && newEndDate !== currentEndDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5" />
            Pré-visualização do recálculo semanal
          </DialogTitle>
          <DialogDescription>
            Revise as etapas reorganizadas em semanas úteis (Seg→Sex) antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
          <Summary label="Início Previsto" value={formatDate(startDate)} />
          <Summary
            label="Novo Término"
            value={formatDate(newEndDate)}
            hint={
              endChanged && currentEndDate
                ? `Antes: ${formatDate(currentEndDate)}`
                : undefined
            }
            highlight={endChanged}
          />
          <Summary
            label="Etapas afetadas"
            value={`${changedCount} de ${ordered.length}`}
          />
        </div>

        {/* Lista de etapas */}
        <ScrollArea className="flex-1 -mx-1 px-1 max-h-[50vh]">
          <ul className="space-y-2 py-2">
            {ordered.map((a, idx) => {
              const r = previewById.get(a.id);
              const changed =
                !!r && (r.planned_start !== a.planned_start || r.planned_end !== a.planned_end);
              return (
                <li
                  key={a.id}
                  className={`rounded-md border p-3 text-sm ${
                    changed ? 'border-primary/30 bg-primary/5' : 'bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-medium truncate">
                        {a.description || a.etapa || 'Sem descrição'}
                      </span>
                    </div>
                    {changed ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Alterada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        Sem mudança
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className={changed ? 'line-through' : ''}>
                      {formatDate(a.planned_start)} → {formatDate(a.planned_end)}
                    </span>
                    {changed && r && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-foreground font-medium">
                          {formatDate(r.planned_start)} → {formatDate(r.planned_end)}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={isBusy || changedCount === 0}
          >
            {changedCount === 0 ? 'Nada para aplicar' : `Aplicar a ${changedCount} etapa(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium truncate ${highlight ? 'text-primary' : ''}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
