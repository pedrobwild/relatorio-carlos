/**
 * Linha individual da tabela do Cronograma (desktop).
 *
 * Encapsula a célula de descrição + edição inline, datepickers, peso e ação
 * de remover, além do "detalhe" expansível (descrição da etapa + mini-Gantt
 * de predecessoras).
 *
 * O layout em grid é mantido idêntico ao do header da tabela em
 * `CronogramaTable.tsx`.
 */
import { AlertCircle, ChevronDown, FileText, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/DatePickerField';
import { StatusBadge } from '@/components/ui-premium';
import { cn } from '@/lib/utils';
import { getActivityState } from '@/lib/scheduleState';
import { AutoTextarea } from './AutoTextarea';
import { PredecessorMiniGantt } from './PredecessorMiniGantt';
import type { ActivityFormData, RowDateError } from './types';

export const ROW_GRID =
  'grid-cols-[44px_56px_minmax(320px,1fr)_170px_170px_88px_52px]';

interface CronogramaActivityRowProps {
  activity: ActivityFormData;
  index: number;
  totalActivities: number;
  allActivities: ActivityFormData[];
  rowError?: RowDateError;
  isDetailOpen: boolean;
  onToggleDetail: (id: string, open: boolean) => void;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>, index: number) => void;
  onDragEnd: () => void;
  onRowDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onRowDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onChange: (id: string, field: keyof ActivityFormData, value: string | string[]) => void;
  onRemove: (id: string) => void;
}

export function CronogramaActivityRow({
  activity,
  index,
  totalActivities,
  allActivities,
  rowError,
  isDetailOpen: detailOpen,
  onToggleDetail,
  draggedIndex,
  dragOverIndex,
  onDragStart,
  onDragEnd,
  onRowDragOver,
  onRowDrop,
  onChange,
  onRemove,
}: CronogramaActivityRowProps) {
  const hasDetail = !!activity.detailed_description?.trim();
  const isDetailOpen = hasDetail || detailOpen;
  const hasPlannedDates = !!(activity.plannedStart && activity.plannedEnd);
  const stateInfo = hasPlannedDates && !rowError?.plannedDates
    ? getActivityState({
        plannedStart: activity.plannedStart,
        plannedEnd: activity.plannedEnd,
        actualStart: activity.actualStart || null,
        actualEnd: activity.actualEnd || null,
      })
    : null;

  return (
    <div>
      <div
        className={cn(
          'grid items-start border-b border-border/30 transition-colors hover:bg-accent/30 group/row',
          ROW_GRID,
          index % 2 === 1 && 'bg-muted/15',
          rowError && 'bg-destructive/5 hover:bg-destructive/10',
          draggedIndex === index && 'opacity-55',
          dragOverIndex === index && draggedIndex !== index && 'bg-primary/10 ring-1 ring-inset ring-primary/30',
        )}
        onDragOver={(e) => onRowDragOver(e, index)}
        onDrop={(e) => onRowDrop(e, index)}
      >
        <div className="pl-2 py-2.5 flex items-center justify-center">
          <button
            type="button"
            draggable
            aria-label={`Reordenar atividade ${index + 1}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all cursor-grab active:cursor-grabbing group-hover/row:opacity-100 hover:bg-accent hover:text-foreground"
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <div className="pr-2 py-2.5 text-sm font-bold text-muted-foreground tabular-nums">
          {index + 1}
        </div>

        <div className="px-2 py-2">
          <AutoTextarea
            value={activity.description}
            onChange={(v) => onChange(activity.id, 'description', v)}
            placeholder="Ex: Mobilização e alinhamentos iniciais..."
          />
          <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
            {stateInfo && (
              <StatusBadge tone={stateInfo.tone} size="sm">
                {stateInfo.label}
              </StatusBadge>
            )}
            {rowError?.plannedDates && (
              <p className="text-[10px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {rowError.plannedDates}
              </p>
            )}
            {!isDetailOpen && !hasDetail && (
              <button
                type="button"
                className="text-[11px] text-primary/80 hover:text-primary flex items-center gap-1 transition-colors font-medium"
                onClick={() => onToggleDetail(activity.id, true)}
              >
                <FileText className="h-3 w-3" />
                Adicionar descrição da etapa
              </button>
            )}
            {(hasDetail || isDetailOpen) && (
              <button
                type="button"
                className={cn(
                  'text-[11px] flex items-center gap-1 transition-colors font-medium',
                  hasDetail
                    ? 'text-primary hover:text-primary/80'
                    : 'text-muted-foreground/60 hover:text-primary',
                )}
                onClick={() => onToggleDetail(activity.id, !detailOpen)}
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform', isDetailOpen && 'rotate-180')} />
                {hasDetail ? 'Descrição da etapa' : 'Fechar descrição'}
              </button>
            )}
          </div>
        </div>

        <div className="px-2 py-2">
          <DatePickerField
            value={activity.plannedStart}
            onChange={(val) => onChange(activity.id, 'plannedStart', val)}
            placeholder="dd/mm/aaaa"
            hasError={!!rowError?.plannedDates}
          />
        </div>

        <div className="px-2 py-2">
          <DatePickerField
            value={activity.plannedEnd}
            onChange={(val) => onChange(activity.id, 'plannedEnd', val)}
            placeholder="dd/mm/aaaa"
            hasError={!!rowError?.plannedDates}
          />
        </div>

        <div className="px-2 py-2">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={activity.weight}
            onChange={(e) => onChange(activity.id, 'weight', e.target.value)}
            className="h-10 w-full text-sm text-center font-semibold tabular-nums"
          />
        </div>

        <div className="pr-3 py-2 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(activity.id)}
            disabled={totalActivities === 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isDetailOpen && (
        <div
          className="border-b border-border/30 bg-muted/10 px-4 py-3 space-y-3"
          style={{ paddingLeft: 'calc(44px + 56px + 8px)' }}
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Descrição da etapa
            </label>
            <Textarea
              value={activity.detailed_description}
              onChange={(e) => onChange(activity.id, 'detailed_description', e.target.value)}
              placeholder="Descreva o escopo, objetivos e entregas desta etapa do cronograma..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>
          <PredecessorMiniGantt activity={activity} allActivities={allActivities} />
        </div>
      )}
    </div>
  );
}
