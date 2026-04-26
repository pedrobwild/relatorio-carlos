/**
 * Tabela editável do Cronograma — composição desktop (grid) + mobile (cards).
 *
 * O botão "Adicionar atividade" agora vive no `CronogramaBottomBar` (sticky),
 * mas a tabela continua autocontida visualmente.
 */
import { AlertCircle, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/DatePickerField';
import { StatusBadge } from '@/components/ui-premium';
import { cn } from '@/lib/utils';
import { getActivityState } from '@/lib/scheduleState';
import { AutoTextarea } from './AutoTextarea';
import { CronogramaActivityRow, ROW_GRID } from './CronogramaActivityRow';
import type { ActivityFormData, RowDateError } from './types';

interface CronogramaTableProps {
  activities: ActivityFormData[];
  dateValidationErrors: Record<string, RowDateError>;
  openDetails: Record<string, boolean>;
  setOpenDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>, index: number) => void;
  onDragEnd: () => void;
  onRowDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onRowDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onChange: (id: string, field: keyof ActivityFormData, value: string | string[]) => void;
  onRemove: (id: string) => void;
}

export function CronogramaTable({
  activities,
  dateValidationErrors,
  openDetails,
  setOpenDetails,
  draggedIndex,
  dragOverIndex,
  onDragStart,
  onDragEnd,
  onRowDragOver,
  onRowDrop,
  onChange,
  onRemove,
}: CronogramaTableProps) {
  const handleToggleDetail = (id: string, open: boolean) =>
    setOpenDetails((prev) => ({ ...prev, [id]: open }));

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Desktop grid */}
      <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[700px]">
          <div className={cn('grid bg-muted/60 border-b border-border/60', ROW_GRID)}>
            <div className="py-3 pl-2" />
            <div className="py-3 pr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</div>
            <div className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</div>
            <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Início Prev.</div>
            <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Término Prev.</div>
            <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peso</div>
            <div className="py-3 pr-3" />
          </div>
          <div>
            {activities.map((activity, index) => (
              <CronogramaActivityRow
                key={activity.id}
                activity={activity}
                index={index}
                totalActivities={activities.length}
                allActivities={activities}
                rowError={dateValidationErrors[activity.id]}
                isDetailOpen={openDetails[activity.id] || false}
                onToggleDetail={handleToggleDetail}
                draggedIndex={draggedIndex}
                dragOverIndex={dragOverIndex}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onRowDragOver={onRowDragOver}
                onRowDrop={onRowDrop}
                onChange={onChange}
                onRemove={onRemove}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border/40">
        {activities.map((activity, index) => {
          const rowError = dateValidationErrors[activity.id];
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
            <div
              key={activity.id}
              className={cn('p-3 space-y-2.5', rowError && 'bg-destructive/5')}
            >
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-primary/10 text-primary shrink-0 mt-1">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <AutoTextarea
                    value={activity.description}
                    onChange={(v) => onChange(activity.id, 'description', v)}
                    placeholder="Descrição da atividade..."
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-destructive"
                  onClick={() => onRemove(activity.id)}
                  disabled={activities.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {stateInfo && (
                <div className="pl-8">
                  <StatusBadge tone={stateInfo.tone} size="sm">
                    {stateInfo.label}
                  </StatusBadge>
                </div>
              )}
              {(rowError?.plannedDates || rowError?.actualDates) && (
                <p className="text-[10px] text-destructive flex items-center gap-1 pl-8">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {rowError?.plannedDates || rowError?.actualDates}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 pl-8">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Início Prev.</span>
                  <DatePickerField
                    value={activity.plannedStart}
                    onChange={(v) => onChange(activity.id, 'plannedStart', v)}
                    placeholder="dd/mm/aaaa"
                    hasError={!!rowError?.plannedDates}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Término Prev.</span>
                  <DatePickerField
                    value={activity.plannedEnd}
                    onChange={(v) => onChange(activity.id, 'plannedEnd', v)}
                    placeholder="dd/mm/aaaa"
                    hasError={!!rowError?.plannedDates}
                  />
                </div>
              </div>
              <div className="pl-8 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium">Peso:</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={activity.weight}
                  onChange={(e) => onChange(activity.id, 'weight', e.target.value)}
                  className="h-8 w-16 text-xs text-center font-semibold"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <div className="pl-8 space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Descrição da etapa
                </label>
                <Textarea
                  value={activity.detailed_description}
                  onChange={(e) => onChange(activity.id, 'detailed_description', e.target.value)}
                  placeholder="Escopo, objetivos e entregas desta etapa..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
