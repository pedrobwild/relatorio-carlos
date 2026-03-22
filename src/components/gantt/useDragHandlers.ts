import { useState, useCallback, RefObject } from 'react';
import { addDays, format } from 'date-fns';
import { Activity } from '@/types/report';
import { ganttLogger } from '@/lib/devLogger';
import { toast } from 'sonner';
import type { DragState } from './types';

export function useDragHandlers(
  activities: Activity[],
  totalDays: number,
  chartRef: RefObject<HTMLDivElement | null>,
  editable: boolean,
  onActivityDateChange?: (activityId: string, newPlannedStart: string, newPlannedEnd: string) => void,
) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent, activityIndex: number, dragType: DragState['dragType']) => {
    if (!editable || !onActivityDateChange) return;

    e.preventDefault();
    e.stopPropagation();

    const activity = activities[activityIndex];
    setDragState({
      activityIndex,
      dragType,
      startX: e.clientX,
      originalStart: activity.plannedStart,
      originalEnd: activity.plannedEnd,
    });
  }, [editable, onActivityDateChange, activities]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !chartRef.current || !onActivityDateChange) return;

    const chartRect = chartRef.current.getBoundingClientRect();
    const chartWidthPx = chartRect.width;
    const deltaX = e.clientX - dragState.startX;
    const deltaDays = Math.round((deltaX / chartWidthPx) * totalDays);

    if (deltaDays === 0) return;

    const activity = activities[dragState.activityIndex];
    const originalStartDate = new Date(dragState.originalStart + 'T00:00:00');
    const originalEndDate = new Date(dragState.originalEnd + 'T00:00:00');

    let newStart: Date;
    let newEnd: Date;

    if (dragState.dragType === 'move') {
      newStart = addDays(originalStartDate, deltaDays);
      newEnd = addDays(originalEndDate, deltaDays);
    } else if (dragState.dragType === 'resize-start') {
      newStart = addDays(originalStartDate, deltaDays);
      newEnd = originalEndDate;
      if (newStart >= newEnd) return;
    } else {
      newStart = originalStartDate;
      newEnd = addDays(originalEndDate, deltaDays);
      if (newEnd <= newStart) return;
    }

    const newStartStr = format(newStart, 'yyyy-MM-dd');
    const newEndStr = format(newEnd, 'yyyy-MM-dd');

    if (activity.id) {
      onActivityDateChange(activity.id, newStartStr, newEndStr);
    }
  }, [dragState, activities, totalDays, onActivityDateChange, chartRef]);

  const handleDragEnd = useCallback(() => {
    if (dragState) {
      const activity = activities[dragState.activityIndex];
      ganttLogger.log('Date change completed', {
        activityId: activity?.id,
        from: { start: dragState.originalStart, end: dragState.originalEnd },
      });
      toast.success('Datas atualizadas');
    }
    setDragState(null);
  }, [dragState, activities]);

  return { dragState, handleDragStart, handleDragMove, handleDragEnd };
}
