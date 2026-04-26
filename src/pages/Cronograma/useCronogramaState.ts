/**
 * Hook que concentra o estado de edição do cronograma.
 *
 * Centraliza tudo que era state/handler do componente monolítico anterior:
 *  - lista editável de atividades (com drag-and-drop reorder)
 *  - cascata de datas quando um `plannedStart` muda
 *  - geração automática de slots semanais quando o projeto é novo
 *  - validação de pares de datas (planned/actual)
 *  - persistência (saveActivities + saveBaseline)
 *
 * Mantemos a interface deliberadamente plana para o `index.tsx` ficar curto.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useProjectActivities,
  type ActivityInput,
  type ProjectActivity,
} from '@/hooks/useProjectActivities';
import type { Project } from '@/contexts/ProjectContext';
import type { ActivityFormData as ImportedActivityFormData } from '@/components/import-schedule/types';
import {
  type ActivityFormData,
  type RowDateError,
  toISO,
  getFridayOfWeek,
  getNextMonday,
  createEmptyActivity,
} from './types';

interface UseCronogramaStateArgs {
  project: Project | null;
  projectId: string | undefined;
  redirectPathOnSave: string;
}

function activityFromExisting(act: ProjectActivity): ActivityFormData {
  return {
    id: act.id,
    description: act.description,
    plannedStart: act.planned_start,
    plannedEnd: act.planned_end,
    actualStart: act.actual_start || '',
    actualEnd: act.actual_end || '',
    weight: act.weight.toString(),
    predecessorIds: act.predecessor_ids || [],
    etapa: act.etapa || '',
    detailed_description: act.detailed_description || '',
  };
}

export function useCronogramaState({
  project,
  projectId,
  redirectPathOnSave,
}: UseCronogramaStateArgs) {
  const navigate = useNavigate();
  const {
    activities: existingActivities,
    loading: activitiesLoading,
    saveActivities,
    saveBaseline,
    hasBaseline,
  } = useProjectActivities(projectId);

  const [activities, setActivities] = useState<ActivityFormData[]>([createEmptyActivity()]);
  const [saving, setSaving] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [mobileEditMode, setMobileEditMode] = useState(false);

  const createFirstActivity = useCallback((): ActivityFormData => {
    const first = createEmptyActivity();
    if (project?.planned_start_date) {
      const start = new Date(project.planned_start_date + 'T00:00:00');
      first.plannedStart = project.planned_start_date;
      first.plannedEnd = toISO(getFridayOfWeek(start));
    }
    return first;
  }, [project]);

  // Carrega atividades existentes ou gera slots semanais a partir das datas do projeto.
  useEffect(() => {
    if (existingActivities.length > 0) {
      setActivities(existingActivities.map(activityFromExisting));
      return;
    }
    if (activitiesLoading) return;

    if (project?.planned_start_date && project?.planned_end_date) {
      const start = new Date(project.planned_start_date + 'T00:00:00');
      const end = new Date(project.planned_end_date + 'T00:00:00');
      if (start >= end) return;

      const weeks: ActivityFormData[] = [];
      let weekStart = new Date(start);
      while (weekStart < end) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const cappedEnd = weekEnd > end ? end : weekEnd;
        weeks.push({
          ...createEmptyActivity(),
          plannedStart: toISO(weekStart),
          plannedEnd: toISO(cappedEnd),
        });
        weekStart = new Date(cappedEnd);
        weekStart.setDate(weekStart.getDate() + 1);
      }
      if (weeks.length > 0) {
        const weightPerWeek = parseFloat((100 / weeks.length).toFixed(1));
        const remainder = parseFloat((100 - weightPerWeek * weeks.length).toFixed(1));
        weeks.forEach((w, i) => {
          w.weight =
            i === weeks.length - 1
              ? (weightPerWeek + remainder).toFixed(1)
              : weightPerWeek.toFixed(1);
        });
        setActivities(weeks);
        return;
      }
    }

    setActivities([createFirstActivity()]);
  }, [existingActivities, activitiesLoading, project, createFirstActivity]);

  const totalWeight = useMemo(
    () => activities.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0),
    [activities],
  );

  const dateValidationErrors = useMemo<Record<string, RowDateError>>(() => {
    const errors: Record<string, RowDateError> = {};
    activities.forEach((act) => {
      const e: RowDateError = {};
      if (act.plannedStart && act.plannedEnd && act.plannedEnd < act.plannedStart) {
        e.plannedDates = 'Término previsto deve ser igual ou posterior ao início';
      }
      if (act.actualStart && act.actualEnd && act.actualEnd < act.actualStart) {
        e.actualDates = 'Término real deve ser igual ou posterior ao início';
      }
      if (Object.keys(e).length > 0) errors[act.id] = e;
    });
    return errors;
  }, [activities]);

  const hasDateErrors = Object.keys(dateValidationErrors).length > 0;

  const handleAddActivity = useCallback(() => {
    setActivities((prev) => {
      const last = prev[prev.length - 1];
      const next = createEmptyActivity();
      if (last?.plannedEnd) {
        const prevEnd = new Date(last.plannedEnd + 'T00:00:00');
        const nextMon = getNextMonday(prevEnd);
        const nextFri = getFridayOfWeek(nextMon);
        next.plannedStart = toISO(nextMon);
        next.plannedEnd = toISO(nextFri);
      }
      return [...prev, next];
    });
  }, []);

  const handleRemoveActivity = useCallback((id: string) => {
    setActivities((prev) => (prev.length === 1 ? prev : prev.filter((a) => a.id !== id)));
    setOpenDetails((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleActivityChange = useCallback(
    (id: string, field: keyof ActivityFormData, value: string | string[]) => {
      setActivities((prev) => {
        const updated = prev.map((act) => {
          if (act.id !== id) return act;
          const next = { ...act, [field]: value } as ActivityFormData;
          if (field === 'plannedStart' && typeof value === 'string' && value) {
            const startDate = new Date(value + 'T00:00:00');
            if (!Number.isNaN(startDate.getTime())) {
              if (act.plannedStart && act.plannedEnd) {
                const oldStart = new Date(act.plannedStart + 'T00:00:00');
                const oldEnd = new Date(act.plannedEnd + 'T00:00:00');
                const durationDays = Math.round(
                  (oldEnd.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24),
                );
                const newEnd = new Date(startDate);
                newEnd.setDate(newEnd.getDate() + durationDays);
                next.plannedEnd = toISO(newEnd);
              } else {
                next.plannedEnd = toISO(getFridayOfWeek(startDate));
              }
            }
          }
          return next;
        });

        // Cascata: ao mudar plannedStart de uma linha, empurra as seguintes preservando duração.
        if (field === 'plannedStart' && typeof value === 'string' && value) {
          const idx = updated.findIndex((a) => a.id === id);
          if (idx >= 0 && idx < updated.length - 1) {
            for (let i = idx + 1; i < updated.length; i++) {
              const prevAct = updated[i - 1];
              const currAct = updated[i];
              if (!prevAct.plannedEnd) break;
              let durationDays = 4;
              if (currAct.plannedStart && currAct.plannedEnd) {
                const cs = new Date(currAct.plannedStart + 'T00:00:00');
                const ce = new Date(currAct.plannedEnd + 'T00:00:00');
                durationDays = Math.round((ce.getTime() - cs.getTime()) / (1000 * 60 * 60 * 24));
                if (durationDays < 0) durationDays = 4;
              }
              const prevEnd = new Date(prevAct.plannedEnd + 'T00:00:00');
              const nextStart = getNextMonday(prevEnd);
              const nextEnd = new Date(nextStart);
              nextEnd.setDate(nextEnd.getDate() + durationDays);
              updated[i] = {
                ...currAct,
                plannedStart: toISO(nextStart),
                plannedEnd: toISO(nextEnd),
              };
            }
          }
        }
        return updated;
      });
    },
    [],
  );

  const clearDragState = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, index: number) => {
      setDraggedIndex(index);
      setDragOverIndex(index);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleRowDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverIndex((prev) => (prev === index ? prev : index));
    },
    [],
  );

  const handleRowDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, toIndex: number) => {
      event.preventDefault();
      const fromIndex = draggedIndex ?? Number(event.dataTransfer.getData('text/plain'));
      if (Number.isNaN(fromIndex) || fromIndex === toIndex) {
        clearDragState();
        return;
      }
      setActivities((prev) => {
        const r = [...prev];
        const [moved] = r.splice(fromIndex, 1);
        r.splice(toIndex, 0, moved);
        return r;
      });
      clearDragState();
    },
    [clearDragState, draggedIndex],
  );

  const handleImportActivities = useCallback(
    (imported: ImportedActivityFormData[]) => {
      const mapped: ActivityFormData[] = imported.map((a) => ({
        ...a,
        etapa: '',
        detailed_description: '',
      }));
      setActivities((prev) =>
        prev.length === 1 && !prev[0].description.trim() ? mapped : [...prev, ...mapped],
      );
    },
    [],
  );

  const handleSaveBaseline = useCallback(async () => {
    setSavingBaseline(true);
    try {
      await saveBaseline();
    } catch {
      toast.error('Erro ao salvar baseline');
    } finally {
      setSavingBaseline(false);
    }
  }, [saveBaseline]);

  const handleSave = useCallback(async () => {
    const hasEmpty = activities.some(
      (a) => !a.description.trim() || !a.plannedStart || !a.plannedEnd,
    );
    if (hasEmpty) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (hasDateErrors) {
      toast.error('Corrija os erros de data antes de salvar');
      return;
    }

    setSaving(true);
    const inputs: ActivityInput[] = activities.map((act, index) => ({
      description: act.description.trim(),
      planned_start: act.plannedStart,
      planned_end: act.plannedEnd,
      actual_start: act.actualStart || null,
      actual_end: act.actualEnd || null,
      weight: parseFloat(act.weight) || 0,
      sort_order: index,
      predecessor_ids: act.predecessorIds,
      etapa: act.etapa?.trim() || null,
      detailed_description: act.detailed_description?.trim() || null,
    }));
    const ok = await saveActivities(inputs);
    setSaving(false);
    if (ok) {
      toast.success('Cronograma salvo com sucesso');
      navigate(redirectPathOnSave);
    }
  }, [activities, hasDateErrors, navigate, redirectPathOnSave, saveActivities]);

  return {
    // Data
    activities,
    existingActivities,
    activitiesLoading,
    totalWeight,
    dateValidationErrors,
    hasDateErrors,
    hasBaseline,
    // UI state
    saving,
    savingBaseline,
    importModalOpen,
    setImportModalOpen,
    openDetails,
    setOpenDetails,
    draggedIndex,
    dragOverIndex,
    mobileEditMode,
    setMobileEditMode,
    // Handlers
    handleAddActivity,
    handleRemoveActivity,
    handleActivityChange,
    handleDragStart,
    handleRowDragOver,
    handleRowDrop,
    clearDragState,
    handleImportActivities,
    handleSaveBaseline,
    handleSave,
  };
}

export type CronogramaState = ReturnType<typeof useCronogramaState>;
