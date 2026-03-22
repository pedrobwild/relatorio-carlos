import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, Loader2, AlertCircle, Link2, Upload, Bookmark, ShoppingCart, Wand2 } from 'lucide-react';
import { AIScheduleGenerator } from '@/components/schedule/AIScheduleGenerator';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/DatePickerField';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectActivities, ActivityInput } from '@/hooks/useProjectActivities';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
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

const Cronograma = () => {
  const navigate = useNavigate();
  const { project, loading: projectLoading } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { activities: existingActivities, loading: activitiesLoading, saveActivities, saveBaseline, clearBaseline, hasBaseline } = useProjectActivities(projectId);
  
  const [activities, setActivities] = useState<ActivityFormData[]>([createEmptyActivity()]);
  const [saving, setSaving] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);

  const handleSaveBaseline = async () => {
    setSavingBaseline(true);
    await saveBaseline();
    setSavingBaseline(false);
  };

  const handleImportActivities = (importedActivities: ActivityFormData[]) => {
    if (activities.length === 1 && !activities[0].description.trim()) {
      // Replace empty default activity
      setActivities(importedActivities);
    } else {
      // Append to existing activities
      setActivities([...activities, ...importedActivities]);
    }
  };

  // Load existing activities into form
  useEffect(() => {
    if (existingActivities.length > 0) {
      const formActivities = existingActivities.map(act => ({
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
    }
  }, [existingActivities]);

  // Calculate total weight
  useEffect(() => {
    const total = activities.reduce((sum, act) => sum + (parseFloat(act.weight) || 0), 0);
    setTotalWeight(total);
  }, [activities]);

  const handleAddActivity = () => {
    setActivities([...activities, createEmptyActivity()]);
  };

  const handleRemoveActivity = (id: string) => {
    if (activities.length === 1) return;
    setActivities(activities.filter(act => act.id !== id));
  };

  const handleActivityChange = (id: string, field: keyof ActivityFormData, value: string | string[]) => {
    setActivities(activities.map(act => 
      act.id === id ? { ...act, [field]: value } : act
    ));
  };

  // Detect circular dependencies using DFS
  const wouldCreateCircularDependency = (activityId: string, newPredecessorId: string): boolean => {
    const visited = new Set<string>();
    
    const hasCycle = (currentId: string): boolean => {
      if (currentId === activityId) return true;
      if (visited.has(currentId)) return false;
      
      visited.add(currentId);
      const activity = activities.find(a => a.id === currentId);
      if (!activity) return false;
      
      for (const predId of activity.predecessorIds) {
        if (hasCycle(predId)) return true;
      }
      return false;
    };
    
    return hasCycle(newPredecessorId);
  };

  const togglePredecessor = (activityId: string, predecessorId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    // If adding a new predecessor, check for circular dependency
    if (!activity.predecessorIds.includes(predecessorId)) {
      if (wouldCreateCircularDependency(activityId, predecessorId)) {
        toast.error('Dependência circular detectada! Esta atividade já depende direta ou indiretamente da atividade selecionada.');
        return;
      }
    }

    setActivities(activities.map(act => {
      if (act.id === activityId) {
        const newPredecessors = act.predecessorIds.includes(predecessorId)
          ? act.predecessorIds.filter(id => id !== predecessorId)
          : [...act.predecessorIds, predecessorId];
        return { ...act, predecessorIds: newPredecessors };
      }
      return act;
    }));
  };

  const getActivityLabel = (id: string) => {
    const index = activities.findIndex(a => a.id === id);
    return index >= 0 ? `${index + 1}. ${activities[index].description || 'Sem descrição'}` : '';
  };

  // Validate dates for each activity
  const dateValidationErrors = useMemo(() => {
    const errors: Record<string, { plannedDates?: string; actualDates?: string }> = {};
    
    activities.forEach(act => {
      const actErrors: { plannedDates?: string; actualDates?: string } = {};
      
      // Validate planned dates
      if (act.plannedStart && act.plannedEnd && act.plannedEnd < act.plannedStart) {
        actErrors.plannedDates = 'Término previsto deve ser igual ou posterior ao início';
      }
      
      // Validate actual dates
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
    // Validation
    const hasEmptyFields = activities.some(act => 
      !act.description.trim() || !act.plannedStart || !act.plannedEnd
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

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newActivities = [...activities];
    [newActivities[index - 1], newActivities[index]] = [newActivities[index], newActivities[index - 1]];
    setActivities(newActivities);
  };

  const handleMoveDown = (index: number) => {
    if (index === activities.length - 1) return;
    const newActivities = [...activities];
    [newActivities[index], newActivities[index + 1]] = [newActivities[index + 1], newActivities[index]];
    setActivities(newActivities);
  };

  if (projectLoading || activitiesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Cronograma"
          showLogo={false}
          maxWidth="md"
          onBack={() => navigate(-1)}
          breadcrumbs={[
            { label: "Gestão", href: "/gestao" },
            { label: "Cronograma" },
          ]}
        />
        <div className="max-w-4xl mx-auto p-4">
          <ContentSkeleton variant="table" rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <PageHeader
        title="Cronograma"
        showLogo={false}
        maxWidth="md"
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/gestao', { replace: true });
          }
        }}
        breadcrumbs={[
          { label: "Gestão", href: "/gestao" },
          { label: project?.name || "Obra", href: `/obra/${projectId}` },
          { label: "Cronograma" },
        ]}
      >
        <div className="flex items-center gap-2 flex-wrap">
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
            title={hasBaseline ? "Atualizar baseline" : "Salvar baseline"}
          >
            {savingBaseline ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Bookmark className={cn("w-4 h-4 mr-1.5", hasBaseline && "fill-current")} />
            )}
            <span className="hidden sm:inline">{hasBaseline ? 'Atualizar Baseline' : 'Baseline'}</span>
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setImportModalOpen(true)}>
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
        {/* Weight summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Peso total das atividades:</span>
              <span className={`font-semibold ${totalWeight === 100 ? 'text-[hsl(var(--success))]' : totalWeight > 100 ? 'text-destructive' : 'text-[hsl(var(--warning))]'}`}>
                {totalWeight.toFixed(1)}%
              </span>
            </div>
            {totalWeight !== 100 && (
              <p className="text-xs text-muted-foreground mt-1">
                O peso total deve ser igual a 100% para cálculo correto de progresso.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Table layout */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground w-12">#</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground min-w-[160px]">Descrição</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Início Prev.</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Término Prev.</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Início Real</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Término Real</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground w-20">Peso</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity, index) => (
                  <tr
                    key={activity.id}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors hover:bg-muted/50",
                      (dateValidationErrors[activity.id]?.plannedDates || dateValidationErrors[activity.id]?.actualDates) && "bg-destructive/5"
                    )}
                  >
                    <td className="px-3 py-3 text-muted-foreground tabular-nums">{index}</td>
                    <td className="px-3 py-3">
                      <Textarea
                        value={activity.description}
                        onChange={(e) => handleActivityChange(activity.id, 'description', e.target.value)}
                        placeholder="Ex: Mobilização"
                        rows={1}
                        className="resize-none min-h-[36px] border-border bg-transparent text-sm"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <DatePickerField
                        value={activity.plannedStart}
                        onChange={(val) => handleActivityChange(activity.id, 'plannedStart', val)}
                        placeholder="dd/mm/aaaa"
                        hasError={!!dateValidationErrors[activity.id]?.plannedDates}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <DatePickerField
                        value={activity.plannedEnd}
                        onChange={(val) => handleActivityChange(activity.id, 'plannedEnd', val)}
                        placeholder="dd/mm/aaaa"
                        hasError={!!dateValidationErrors[activity.id]?.plannedDates}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <DatePickerField
                        value={activity.actualStart}
                        onChange={(val) => handleActivityChange(activity.id, 'actualStart', val)}
                        placeholder="dd/mm/aaaa"
                        hasError={!!dateValidationErrors[activity.id]?.actualDates}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <DatePickerField
                        value={activity.actualEnd}
                        onChange={(val) => handleActivityChange(activity.id, 'actualEnd', val)}
                        placeholder="dd/mm/aaaa"
                        hasError={!!dateValidationErrors[activity.id]?.actualDates}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={activity.weight}
                        onChange={(e) => handleActivityChange(activity.id, 'weight', e.target.value)}
                        className="w-20 text-sm"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveActivity(activity.id)}
                        disabled={activities.length === 1}
                        aria-label="Remover atividade"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add activity button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAddActivity}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Atividade
        </Button>
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
