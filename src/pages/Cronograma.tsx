import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Save, Loader2, AlertCircle, Upload, Bookmark, ShoppingCart, Wand2, GripVertical, ChevronDown, FileText } from 'lucide-react';
import { isHoliday } from '@/lib/businessDays';
import { AIScheduleGenerator } from '@/components/schedule/AIScheduleGenerator';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DatePickerField } from '@/components/DatePickerField';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectActivities, ActivityInput } from '@/hooks/useProjectActivities';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { ImportScheduleModal } from '@/components/ImportScheduleModal';
import { CronogramaMobileView } from '@/components/cronograma/CronogramaMobileView';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';

interface ActivityFormData {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
  predecessorIds: string[];
  etapa: string;
  detailed_description: string;
}

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Find Friday of the same week as the given date. If it's a holiday, go back until a business day. */
const getFridayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun..6=Sat
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : -1; // if Sat, Friday was yesterday
  const friday = new Date(d);
  friday.setDate(friday.getDate() + daysUntilFriday);
  // If Friday is a holiday, go back day by day until we find a non-holiday weekday
  while (isHoliday(friday)) {
    friday.setDate(friday.getDate() - 1);
  }
  // Ensure we don't go before the start date
  if (friday < date) return new Date(date);
  return friday;
};

/** Find the next Monday after a given date */
const getNextMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Sun->1, Mon->7, Tue->6...
  const monday = new Date(d);
  monday.setDate(monday.getDate() + daysUntilMonday);
  return monday;
};

const createEmptyActivity = (): ActivityFormData => ({
  id: crypto.randomUUID(),
  description: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  weight: '0',
  predecessorIds: [],
  etapa: '',
  detailed_description: '',
});

/* ── Auto-resize textarea ── */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = '0px';
      ref.current.style.height = `${Math.max(36, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        'min-h-[36px] resize-none overflow-hidden py-2 px-2.5 text-sm leading-snug border-transparent bg-transparent hover:border-border focus:border-border transition-colors',
        hasError && 'border-destructive',
      )}
    />
  );
}

/* ── Weight progress bar ── */
function WeightSummary({ total }: { total: number }) {
  const isValid = Math.abs(total - 100) < 0.05;
  const isOver = total > 100;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/60">
      <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
        Peso total das atividades:
      </span>
      <Progress
        value={Math.min(total, 100)}
        className={cn(
          'h-2 flex-1 rounded-full max-w-xs',
          isValid
            ? '[&>div]:bg-[hsl(var(--success))]'
            : isOver
              ? '[&>div]:bg-destructive'
              : '[&>div]:bg-[hsl(var(--warning))]',
        )}
      />
      <span
        className={cn(
          'text-sm font-bold tabular-nums whitespace-nowrap min-w-[52px] text-right',
          isValid
            ? 'text-[hsl(var(--success))]'
            : isOver
              ? 'text-destructive'
              : 'text-[hsl(var(--warning))]',
        )}
      >
        {total.toFixed(1)}%
      </span>
    </div>
  );
}

/* ── Main component ── */
const Cronograma = () => {
  const navigate = useNavigate();
  const { project, loading: projectLoading } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const isMobile = useIsMobile();
  const {
    activities: existingActivities,
    loading: activitiesLoading,
    saveActivities,
    saveBaseline,
    clearBaseline,
    hasBaseline,
  } = useProjectActivities(projectId);
  const [mobileEditMode, setMobileEditMode] = useState(false);

  const createFirstActivity = (): ActivityFormData => {
    const first = createEmptyActivity();
    if (project?.planned_start_date) {
      const start = new Date(project.planned_start_date + 'T00:00:00');
      first.plannedStart = project.planned_start_date;
      first.plannedEnd = toISO(getFridayOfWeek(start));
    }
    return first;
  };

  const [activities, setActivities] = useState<ActivityFormData[]>([createEmptyActivity()]);
  const [saving, setSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  const clearDragState = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>, index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleRowDragOver = useCallback((event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragOverIndex]);

  const handleRowDrop = useCallback((event: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    event.preventDefault();
    const fromIndex = draggedIndex ?? Number(event.dataTransfer.getData('text/plain'));
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) {
      clearDragState();
      return;
    }
    setActivities(prev => {
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
    clearDragState();
  }, [clearDragState, draggedIndex]);

  const totalWeight = useMemo(
    () => activities.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0),
    [activities],
  );

  const handleSaveBaseline = async () => {
    setSavingBaseline(true);
    try {
      await saveBaseline();
    } catch (err) {
      toast.error('Erro ao salvar baseline');
    } finally {
      setSavingBaseline(false);
    }
  };

  const handleImportActivities = (importedActivities: import('@/components/import-schedule/types').ActivityFormData[]) => {
    const mapped: ActivityFormData[] = importedActivities.map(a => ({ ...a, etapa: '', detailed_description: '' }));
    if (activities.length === 1 && !activities[0].description.trim()) {
      setActivities(mapped);
    } else {
      setActivities([...activities, ...mapped]);
    }
  };

  // Load existing activities or auto-generate weekly slots
  useEffect(() => {
    if (existingActivities.length > 0) {
      const formActivities: ActivityFormData[] = existingActivities.map((act) => ({
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
      }));
      setActivities(formActivities);
    } else if (!activitiesLoading && project?.planned_start_date && project?.planned_end_date) {
      const start = new Date(project.planned_start_date + 'T00:00:00');
      const end = new Date(project.planned_end_date + 'T00:00:00');
      if (start >= end) return;

      const weeks: ActivityFormData[] = [];
      let weekStart = new Date(start);
      while (weekStart < end) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const cappedEnd = weekEnd > end ? end : weekEnd;
        const fmt = (d: Date) => toISO(d);
        weeks.push({
          id: crypto.randomUUID(),
          description: '',
          plannedStart: fmt(weekStart),
          plannedEnd: fmt(cappedEnd),
          actualStart: '',
          actualEnd: '',
          weight: '0',
          predecessorIds: [],
          etapa: '',
          detailed_description: '',
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
      } else {
        // No weeks generated but project has dates — use first activity with project start
        setActivities([createFirstActivity()]);
      }
    } else if (!activitiesLoading && existingActivities.length === 0) {
      // No existing activities and no planned dates — still pre-fill if start date exists
      setActivities([createFirstActivity()]);
    }
  }, [existingActivities, activitiesLoading, project]);

  const handleAddActivity = () => {
    const lastActivity = activities[activities.length - 1];
    const newActivity = createEmptyActivity();

    // Auto-fill dates based on previous activity's end date
    if (lastActivity?.plannedEnd) {
      const prevEnd = new Date(lastActivity.plannedEnd + 'T00:00:00');
      const nextMon = getNextMonday(prevEnd);
      const nextFri = getFridayOfWeek(nextMon);
      newActivity.plannedStart = toISO(nextMon);
      newActivity.plannedEnd = toISO(nextFri);
    }

    setActivities([...activities, newActivity]);
  };

  const handleRemoveActivity = (id: string) => {
    if (activities.length === 1) return;
    setActivities(activities.filter((act) => act.id !== id));
    setOpenDetails(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleActivityChange = (
    id: string,
    field: keyof ActivityFormData,
    value: string | string[],
  ) => {
    setActivities(prev => {
      const newActivities = prev.map((act) => {
        if (act.id !== id) return act;
        const updated = { ...act, [field]: value };
        // Auto-fill end date when start date is set
        if (field === 'plannedStart' && typeof value === 'string' && value) {
          const startDate = new Date(value + 'T00:00:00');
          if (!isNaN(startDate.getTime())) {
            // Keep the same duration (in calendar days) if there was an existing range
            if (act.plannedStart && act.plannedEnd) {
              const oldStart = new Date(act.plannedStart + 'T00:00:00');
              const oldEnd = new Date(act.plannedEnd + 'T00:00:00');
              const durationDays = Math.round((oldEnd.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24));
              const newEnd = new Date(startDate);
              newEnd.setDate(newEnd.getDate() + durationDays);
              updated.plannedEnd = toISO(newEnd);
            } else {
              updated.plannedEnd = toISO(getFridayOfWeek(startDate));
            }
          }
        }
        return updated;
      });

      // If plannedStart changed, cascade dates to all subsequent activities
      if (field === 'plannedStart' && typeof value === 'string' && value) {
        const changedIndex = newActivities.findIndex(a => a.id === id);
        if (changedIndex >= 0 && changedIndex < newActivities.length - 1) {
          for (let i = changedIndex + 1; i < newActivities.length; i++) {
            const prevAct = newActivities[i - 1];
            const currAct = newActivities[i];
            if (!prevAct.plannedEnd) break;

            // Preserve original duration of this activity
            let durationDays = 4; // default Mon-Fri
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

            newActivities[i] = {
              ...currAct,
              plannedStart: toISO(nextStart),
              plannedEnd: toISO(nextEnd),
            };
          }
        }
      }

      return newActivities;
    });
  };

  // Date validation
  const dateValidationErrors = useMemo(() => {
    const errors: Record<string, { plannedDates?: string; actualDates?: string }> = {};
    activities.forEach((act) => {
      const actErrors: { plannedDates?: string; actualDates?: string } = {};
      if (act.plannedStart && act.plannedEnd && act.plannedEnd < act.plannedStart) {
        actErrors.plannedDates = 'Término previsto deve ser igual ou posterior ao início';
      }
      if (act.actualStart && act.actualEnd && act.actualEnd < act.actualStart) {
        actErrors.actualDates = 'Término real deve ser igual ou posterior ao início';
      }
      if (Object.keys(actErrors).length > 0) {
        errors[act.id] = actErrors;
      }
    });
    return errors;
  }, [activities]);

  const hasDateErrors = Object.keys(dateValidationErrors).length > 0;

  const handleSave = async () => {
    const hasEmptyFields = activities.some(
      (act) => !act.description.trim() || !act.plannedStart || !act.plannedEnd,
    );
    if (hasEmptyFields) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (hasDateErrors) {
      toast.error('Corrija os erros de data antes de salvar');
      return;
    }

    setSaving(true);
    const activityInputs: ActivityInput[] = activities.map((act, index) => ({
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
    const success = await saveActivities(activityInputs);
    setSaving(false);
    if (success) {
      toast.success('Cronograma salvo com sucesso');
      navigate(paths.relatorio);
    }
  };

  if (projectLoading || activitiesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Cronograma"
          showLogo={false}
          maxWidth="md"
          onBack={() => navigate(-1)}
          breadcrumbs={[{ label: 'Gestão', href: '/gestao' }, { label: 'Cronograma' }]}
        />
        <div className="max-w-7xl mx-auto p-4">
          <ContentSkeleton variant="table" rows={6} />
        </div>
      </div>
    );
  }

  // Mobile: monitoring view (unless user requested edit mode)
  if (isMobile && !mobileEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Cronograma"
          showLogo={false}
          maxWidth="md"
          onBack={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/gestao', { replace: true });
          }}
          breadcrumbs={[
            { label: 'Gestão', href: '/gestao' },
            { label: project?.name || 'Obra', href: `/obra/${projectId}` },
            { label: 'Cronograma' },
          ]}
        />
        <div className="max-w-lg mx-auto p-4">
          <CronogramaMobileView
            activities={existingActivities}
            loading={activitiesLoading}
            hasBaseline={hasBaseline}
            onEditMode={() => setMobileEditMode(true)}
            onImport={() => setImportModalOpen(true)}
            onSaveBaseline={async () => { await saveBaseline(); }}
            projectName={project?.name}
          />
        </div>
        <ImportScheduleModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          onImport={handleImportActivities}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Cronograma"
        showLogo={false}
        maxWidth="md"
        onBack={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate('/gestao', { replace: true });
        }}
        breadcrumbs={[
          { label: 'Gestão', href: '/gestao' },
          { label: project?.name || 'Obra', href: `/obra/${projectId}` },
          { label: 'Cronograma' },
        ]}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <AIScheduleGenerator
            projectId={projectId || ''}
            projectName={project?.name || 'Obra'}
            plannedStartDate={project?.planned_start_date}
            plannedEndDate={project?.planned_end_date}
          />
          <Link to={paths.compras}>
            <Button variant="outline" size="sm" className="text-xs">
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Compras</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleSaveBaseline}
            disabled={savingBaseline || activities.length === 0}
          >
            {savingBaseline ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Bookmark className={cn('w-4 h-4 mr-1.5', hasBaseline && 'fill-current')} />
            )}
            <span className="hidden sm:inline">
              {hasBaseline ? 'Atualizar Baseline' : 'Baseline'}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setImportModalOpen(true)}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Salvar
          </Button>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <WeightSummary total={totalWeight} />

        {/* ── Spreadsheet table ── */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Desktop grid */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[44px_56px_minmax(320px,1fr)_170px_170px_88px_52px] bg-muted/60 border-b border-border/60">
                <div className="py-3 pl-2" />
                <div className="py-3 pr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</div>
                <div className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</div>
                <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Início Prev.</div>
                <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Término Prev.</div>
                <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peso</div>
                <div className="py-3 pr-3" />
              </div>

              <div>
                {activities.map((activity, index) => {
                  const rowError = dateValidationErrors[activity.id];
                  const hasDetail = !!activity.detailed_description?.trim();
                  // Sempre aberto quando há conteúdo (visível para todos os roles);
                  // quando vazio, respeita o toggle do usuário.
                  const isDetailOpen = hasDetail || (openDetails[activity.id] || false);
                  return (
                    <div key={activity.id}>
                      <div
                        className={cn(
                          'grid grid-cols-[44px_56px_minmax(320px,1fr)_170px_170px_88px_52px] items-start border-b border-border/30 transition-colors hover:bg-accent/30 group/row',
                          index % 2 === 1 && 'bg-muted/15',
                          rowError && 'bg-destructive/5 hover:bg-destructive/10',
                          draggedIndex === index && 'opacity-55',
                          dragOverIndex === index && draggedIndex !== index && 'bg-primary/10 ring-1 ring-inset ring-primary/30',
                        )}
                        onDragOver={(e) => handleRowDragOver(e, index)}
                        onDrop={(e) => handleRowDrop(e, index)}
                      >
                        <div className="pl-2 py-2.5 flex items-center justify-center">
                          <button
                            type="button"
                            draggable
                            aria-label={`Reordenar atividade ${index + 1}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all cursor-grab active:cursor-grabbing group-hover/row:opacity-100 hover:bg-accent hover:text-foreground"
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={clearDragState}
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
                            onChange={(v) => handleActivityChange(activity.id, 'description', v)}
                            placeholder="Ex: Mobilização e alinhamentos iniciais..."
                          />
                          <div className="flex items-center gap-1 mt-1 px-1">
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
                                onClick={() => setOpenDetails(prev => ({ ...prev, [activity.id]: true }))}
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
                                  hasDetail ? 'text-primary hover:text-primary/80' : 'text-muted-foreground/60 hover:text-primary',
                                )}
                                onClick={() => setOpenDetails(prev => ({ ...prev, [activity.id]: !prev[activity.id] }))}
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
                            onChange={(val) => handleActivityChange(activity.id, 'plannedStart', val)}
                            placeholder="dd/mm/aaaa"
                            hasError={!!rowError?.plannedDates}
                          />
                        </div>

                        <div className="px-2 py-2" data-testid="cronograma-activity-end" data-planned-end={activity.plannedEnd}>
                          <DatePickerField
                            value={activity.plannedEnd}
                            onChange={(val) => handleActivityChange(activity.id, 'plannedEnd', val)}
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
                            onChange={(e) => handleActivityChange(activity.id, 'weight', e.target.value)}
                            className="h-10 w-full text-sm text-center font-semibold tabular-nums"
                          />
                        </div>

                        <div className="pr-3 py-2 flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveActivity(activity.id)}
                            disabled={activities.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {isDetailOpen && (
                        <div className="border-b border-border/30 bg-muted/10 px-4 py-3 space-y-1.5" style={{ paddingLeft: 'calc(44px + 56px + 8px)' }}>
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Descrição da etapa
                          </label>
                          <Textarea
                            value={activity.detailed_description}
                            onChange={(e) => handleActivityChange(activity.id, 'detailed_description', e.target.value)}
                            placeholder="Descreva o escopo, objetivos e entregas desta etapa do cronograma..."
                            rows={3}
                            className="text-sm resize-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/40">
            {activities.map((activity, index) => {
              const rowError = dateValidationErrors[activity.id];
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
                        onChange={(v) => handleActivityChange(activity.id, 'description', v)}
                        placeholder="Descrição da atividade..."
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-destructive"
                      onClick={() => handleRemoveActivity(activity.id)}
                      disabled={activities.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
                        onChange={(v) => handleActivityChange(activity.id, 'plannedStart', v)}
                        placeholder="dd/mm/aaaa"
                        hasError={!!rowError?.plannedDates}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Término Prev.</span>
                      <DatePickerField
                        value={activity.plannedEnd}
                        onChange={(v) => handleActivityChange(activity.id, 'plannedEnd', v)}
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
                      onChange={(e) => handleActivityChange(activity.id, 'weight', e.target.value)}
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
                      onChange={(e) => handleActivityChange(activity.id, 'detailed_description', e.target.value)}
                      placeholder="Escopo, objetivos e entregas desta etapa..."
                      rows={2}
                      className="text-xs resize-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add row */}
          <div className="border-t border-dashed border-primary/20">
            <Button
              variant="ghost"
              className="w-full h-12 gap-2 text-sm text-muted-foreground hover:text-primary rounded-none"
              onClick={handleAddActivity}
            >
              <Plus className="h-4 w-4" />
              Adicionar atividade
            </Button>
          </div>
        </div>
      </div>

      <ImportScheduleModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImportActivities}
      />
    </div>
  );
};

export default Cronograma;
