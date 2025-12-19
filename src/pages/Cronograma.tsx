import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectActivities, ActivityInput } from '@/hooks/useProjectActivities';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { toast } from 'sonner';
interface ActivityFormData {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
}

const createEmptyActivity = (): ActivityFormData => ({
  id: crypto.randomUUID(),
  description: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  weight: '0',
});

const Cronograma = () => {
  const navigate = useNavigate();
  const { project, loading: projectLoading } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { activities: existingActivities, loading: activitiesLoading, saveActivities } = useProjectActivities(projectId);
  
  const [activities, setActivities] = useState<ActivityFormData[]>([createEmptyActivity()]);
  const [saving, setSaving] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);

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

  const handleActivityChange = (id: string, field: keyof ActivityFormData, value: string) => {
    setActivities(activities.map(act => 
      act.id === id ? { ...act, [field]: value } : act
    ));
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-lg">Cronograma</h1>
              <p className="text-sm text-muted-foreground">{project?.name}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Weight summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Peso total das atividades:</span>
              <span className={`font-semibold ${totalWeight === 100 ? 'text-green-600' : totalWeight > 100 ? 'text-destructive' : 'text-amber-600'}`}>
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

        {/* Activities list */}
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <Card key={activity.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    Atividade
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <GripVertical className="h-4 w-4 rotate-90" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveActivity(activity.id)}
                      disabled={activities.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor={`desc-${activity.id}`}>Descrição *</Label>
                  <Input
                    id={`desc-${activity.id}`}
                    placeholder="Ex: Preparação e Mobilização"
                    value={activity.description}
                    onChange={(e) => handleActivityChange(activity.id, 'description', e.target.value)}
                  />
                </div>

                {/* Planned dates */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`ps-${activity.id}`}>Início Previsto *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`ps-${activity.id}`}
                          type="date"
                          className={`pl-10 ${dateValidationErrors[activity.id]?.plannedDates ? 'border-destructive' : ''}`}
                          value={activity.plannedStart}
                          onChange={(e) => handleActivityChange(activity.id, 'plannedStart', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`pe-${activity.id}`}>Término Previsto *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`pe-${activity.id}`}
                          type="date"
                          className={`pl-10 ${dateValidationErrors[activity.id]?.plannedDates ? 'border-destructive' : ''}`}
                          value={activity.plannedEnd}
                          onChange={(e) => handleActivityChange(activity.id, 'plannedEnd', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  {dateValidationErrors[activity.id]?.plannedDates && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {dateValidationErrors[activity.id].plannedDates}
                    </p>
                  )}
                </div>

                {/* Actual dates */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`as-${activity.id}`}>Início Real</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`as-${activity.id}`}
                          type="date"
                          className={`pl-10 ${dateValidationErrors[activity.id]?.actualDates ? 'border-destructive' : ''}`}
                          value={activity.actualStart}
                          onChange={(e) => handleActivityChange(activity.id, 'actualStart', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ae-${activity.id}`}>Término Real</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`ae-${activity.id}`}
                          type="date"
                          className={`pl-10 ${dateValidationErrors[activity.id]?.actualDates ? 'border-destructive' : ''}`}
                          value={activity.actualEnd}
                          onChange={(e) => handleActivityChange(activity.id, 'actualEnd', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  {dateValidationErrors[activity.id]?.actualDates && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {dateValidationErrors[activity.id].actualDates}
                    </p>
                  )}
                </div>

                {/* Weight */}
                <div className="space-y-2">
                  <Label htmlFor={`weight-${activity.id}`}>Peso (%)</Label>
                  <Input
                    id={`weight-${activity.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Ex: 10"
                    value={activity.weight}
                    onChange={(e) => handleActivityChange(activity.id, 'weight', e.target.value)}
                    className="w-32"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
    </div>
  );
};

export default Cronograma;
