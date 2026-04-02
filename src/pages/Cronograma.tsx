import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Save, Loader2, AlertCircle, Upload, Bookmark, ShoppingCart, Wand2 } from 'lucide-react';
import { isHoliday } from '@/lib/businessDays';
import { AIScheduleGenerator } from '@/components/schedule/AIScheduleGenerator';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/DatePickerField';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectActivities, ActivityInput } from '@/hooks/useProjectActivities';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { ImportScheduleModal } from '@/components/ImportScheduleModal';
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
  const {
    activities: existingActivities,
    loading: activitiesLoading,
    saveActivities,
    saveBaseline,
    clearBaseline,
    hasBaseline,
  } = useProjectActivities(projectId);

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

  const totalWeight = useMemo(
    () => activities.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0),
    [activities],
  );

  const handleSaveBaseline = async () => {
    setSavingBaseline(true);
    await saveBaseline();
    setSavingBaseline(false);
  };

  const handleImportActivities = (importedActivities: ActivityFormData[]) => {
    if (activities.length === 1 && !activities[0].description.trim()) {
      setActivities(importedActivities);
    } else {
      setActivities([...activities, ...importedActivities]);
    }
  };

  // Load existing activities or auto-generate weekly slots
  useEffect(() => {
    if (existingActivities.length > 0) {
      const formActivities = existingActivities.map((act) => ({
        id: act.id,
        description: act.description,
        plannedStart: act.planned_start,
        plannedEnd: act.planned_end,
        actualStart: act.actual_start || '',
        actualEnd: act.actual_end || '',
        weight: act.weight.toString(),
        predecessorIds: act.predecessor_ids || [],
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
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        weeks.push({
          id: crypto.randomUUID(),
          description: '',
          plannedStart: fmt(weekStart),
          plannedEnd: fmt(cappedEnd),
          actualStart: '',
          actualEnd: '',
          weight: '0',
          predecessorIds: [],
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
  };

  const handleActivityChange = (
    id: string,
    field: keyof ActivityFormData,
    value: string | string[],
  ) => {
    setActivities(activities.map((act) => {
      if (act.id !== id) return act;
      const updated = { ...act, [field]: value };
      // Auto-fill end date when start date is set and end date is empty or was auto-filled
      if (field === 'plannedStart' && typeof value === 'string' && value) {
        const startDate = new Date(value + 'T00:00:00');
        if (!isNaN(startDate.getTime())) {
          const friday = getFridayOfWeek(startDate);
          updated.plannedEnd = toISO(friday);
        }
      }
      return updated;
    }));
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
              <div className="grid grid-cols-[56px_minmax(320px,1fr)_170px_170px_88px_52px] bg-muted/60 border-b border-border/60">
                <div className="py-3 pl-4 pr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</div>
                <div className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</div>
                <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Início Prev.</div>
                <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Término Prev.</div>
                <div className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peso</div>
                <div className="py-3 pr-3" />
              </div>

              <div>
                {activities.map((activity, index) => {
                  const rowError = dateValidationErrors[activity.id];
                  return (
                    <div
                      key={activity.id}
                      className={cn(
                        'grid grid-cols-[56px_minmax(320px,1fr)_170px_170px_88px_52px] items-start border-b border-border/30 last:border-b-0 transition-colors hover:bg-accent/30',
                        index % 2 === 1 && 'bg-muted/15',
                        rowError && 'bg-destructive/5 hover:bg-destructive/10',
                      )}
                    >
                      <div className="pl-4 pr-2 py-2.5 text-sm font-bold text-muted-foreground tabular-nums">
                        {index + 1}
                      </div>

                      <div className="px-2 py-2">
                        <AutoTextarea
                          value={activity.description}
                          onChange={(v) => handleActivityChange(activity.id, 'description', v)}
                          placeholder="Ex: Mobilização e alinhamentos iniciais..."
                        />
                        {rowError?.plannedDates && (
                          <p className="text-[10px] text-destructive mt-1 flex items-center gap-1 px-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {rowError.plannedDates}
                          </p>
                        )}
                      </div>

                      <div className="px-2 py-2">
                        <DatePickerField
                          value={activity.plannedStart}
                          onChange={(val) => handleActivityChange(activity.id, 'plannedStart', val)}
                          placeholder="dd/mm/aaaa"
                          hasError={!!rowError?.plannedDates}
                        />
                      </div>

                      <div className="px-2 py-2">
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
