import { useEffect, useRef } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addBusinessDays, isHoliday, isNonBusinessDay } from '@/lib/businessDays';
import { cn } from '@/lib/utils';
import type { FormData } from './types';

export interface ScheduleActivity {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  weight: string;
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
  const dayOfWeek = d.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : -1;
  const friday = new Date(d);
  friday.setDate(friday.getDate() + daysUntilFriday);
  while (isHoliday(friday)) {
    friday.setDate(friday.getDate() - 1);
  }
  if (friday < date) return new Date(date);
  return friday;
};

/** Find the next Monday after a given date */
const getNextMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + daysUntilMonday);
  return monday;
};

export const createEmptyActivity = (): ScheduleActivity => ({
  id: crypto.randomUUID(),
  description: '',
  plannedStart: '',
  plannedEnd: '',
  weight: '0',
});

interface ScheduleCardProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
  activities: ScheduleActivity[];
  onActivitiesChange: (activities: ScheduleActivity[]) => void;
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
      className="min-h-[36px] resize-none overflow-hidden py-2 px-2.5 text-sm leading-snug"
    />
  );
}

export function ScheduleCard({ formData, onChange, activities, onActivitiesChange }: ScheduleCardProps) {
  // Auto-calculate end date when start date + business days are set
  useEffect(() => {
    const days = parseInt(formData.business_days_duration, 10);
    if (formData.planned_start_date && days > 0) {
      const start = new Date(formData.planned_start_date + 'T00:00:00');
      const end = addBusinessDays(start, days);
      const y = end.getFullYear();
      const m = (end.getMonth() + 1).toString().padStart(2, '0');
      const d = end.getDate().toString().padStart(2, '0');
      const computed = `${y}-${m}-${d}`;
      if (formData.planned_end_date !== computed) {
        onChange('planned_end_date', computed);
      }
    }
  }, [formData.planned_start_date, formData.business_days_duration]);

  // Auto-fill first activity start date when project start date changes
  useEffect(() => {
    if (formData.planned_start_date && activities.length > 0 && !activities[0].plannedStart) {
      const start = new Date(formData.planned_start_date + 'T00:00:00');
      const friday = getFridayOfWeek(start);
      const updated = [...activities];
      updated[0] = {
        ...updated[0],
        plannedStart: formData.planned_start_date,
        plannedEnd: toISO(friday),
      };
      onActivitiesChange(updated);
    }
  }, [formData.planned_start_date]);

  const isEndDateAutoCalculated = !!(formData.planned_start_date && parseInt(formData.business_days_duration, 10) > 0);

  const totalWeight = activities.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0);

  const updateActivity = (id: string, field: keyof ScheduleActivity, value: string) => {
    const updated = activities.map((a) => {
      if (a.id !== id) return a;
      const newA = { ...a, [field]: value };
      // Auto-fill end date when start date is set
      if (field === 'plannedStart' && value) {
        const startDate = new Date(value + 'T00:00:00');
        if (!isNaN(startDate.getTime())) {
          newA.plannedEnd = toISO(getFridayOfWeek(startDate));
        }
      }
      return newA;
    });
    onActivitiesChange(updated);
  };

  const addActivity = () => {
    const newAct = createEmptyActivity();

    // Auto-fill dates based on last activity or project start
    const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;

    if (lastActivity?.plannedEnd) {
      const prevEnd = new Date(lastActivity.plannedEnd + 'T00:00:00');
      const nextMon = getNextMonday(prevEnd);
      const nextFri = getFridayOfWeek(nextMon);
      newAct.plannedStart = toISO(nextMon);
      newAct.plannedEnd = toISO(nextFri);
    } else if (activities.length === 0 && formData.planned_start_date) {
      const start = new Date(formData.planned_start_date + 'T00:00:00');
      newAct.plannedStart = formData.planned_start_date;
      newAct.plannedEnd = toISO(getFridayOfWeek(start));
    }

    onActivitiesChange([...activities, newAct]);
  };

  const removeActivity = (id: string) => {
    onActivitiesChange(activities.filter((a) => a.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <Calendar className="h-5 w-5" />
          Cronograma
        </CardTitle>
        <CardDescription>
          {formData.is_project_phase
            ? 'Datas macro do projeto e assinatura do contrato'
            : 'Datas previstas de início e término'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {formData.is_project_phase && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p>Obra em fase de projeto. As datas podem ser definidas agora ou marcadas como "Em definição".</p>
          </div>
        )}

        {formData.is_project_phase && (
          <div className="space-y-2">
            <Label htmlFor="contract_signing_date">Data de Assinatura do Contrato</Label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="contract_date_undefined"
                checked={formData.contract_signing_date === ''}
                onChange={(e) => onChange('contract_signing_date', e.target.checked ? '' : '')}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="contract_date_undefined" className="text-caption cursor-pointer text-muted-foreground">
                Em definição
              </Label>
            </div>
            {formData.contract_signing_date !== '' ? (
              <Input id="contract_signing_date" type="date" value={formData.contract_signing_date} onChange={(e) => onChange('contract_signing_date', e.target.value)} />
            ) : (
              <Input id="contract_signing_date" disabled placeholder="Em definição" value="" />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="planned_start_date">
              Data de Início {!formData.is_project_phase && '*'}
            </Label>
            {formData.is_project_phase && (
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="start_date_undefined" checked={formData.planned_start_date === ''} onChange={(e) => onChange('planned_start_date', e.target.checked ? '' : '')} className="h-4 w-4 rounded border-border" />
                <Label htmlFor="start_date_undefined" className="text-caption cursor-pointer text-muted-foreground">Em definição</Label>
              </div>
            )}
            {(!formData.is_project_phase || formData.planned_start_date !== '') && (
              <Input id="planned_start_date" type="date" value={formData.planned_start_date} onChange={(e) => onChange('planned_start_date', e.target.value)} required={!formData.is_project_phase} />
            )}
            {formData.is_project_phase && formData.planned_start_date === '' && (
              <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">Em definição</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_days_duration">Dias Úteis de Execução</Label>
            <Input
              id="business_days_duration"
              type="number"
              min="1"
              placeholder="Ex: 60"
              value={formData.business_days_duration}
              onChange={(e) => onChange('business_days_duration', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Exclui fins de semana e feriados de SP</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planned_end_date">
              Data de Término {!formData.is_project_phase && '*'}
              {isEndDateAutoCalculated && (
                <span className="text-xs font-normal text-muted-foreground ml-1">(calculada)</span>
              )}
            </Label>
            {formData.is_project_phase && !isEndDateAutoCalculated && (
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="end_date_undefined" checked={formData.planned_end_date === ''} onChange={(e) => onChange('planned_end_date', e.target.checked ? '' : '')} className="h-4 w-4 rounded border-border" />
                <Label htmlFor="end_date_undefined" className="text-caption cursor-pointer text-muted-foreground">Em definição</Label>
              </div>
            )}
            {(!formData.is_project_phase || formData.planned_end_date !== '') && (
              <Input
                id="planned_end_date"
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => onChange('planned_end_date', e.target.value)}
                required={!formData.is_project_phase}
                disabled={isEndDateAutoCalculated}
                className={isEndDateAutoCalculated ? 'bg-muted/50 cursor-not-allowed' : ''}
              />
            )}
            {formData.is_project_phase && formData.planned_end_date === '' && !isEndDateAutoCalculated && (
              <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">Em definição</div>
            )}
          </div>
        </div>

        {/* Activities / Etapas */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Etapas da Obra</h4>
              <p className="text-xs text-muted-foreground">Adicione as etapas do cronograma (opcional)</p>
            </div>
            {activities.length > 0 && (
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                Math.abs(totalWeight - 100) < 0.05
                  ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                  : "bg-muted text-muted-foreground"
              )}>
                Peso: {totalWeight.toFixed(1)}%
              </span>
            )}
          </div>

          {activities.length > 0 && (
            <div className="space-y-3">
              {/* Header - desktop only */}
              <div className="hidden sm:grid grid-cols-[1fr_130px_130px_70px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Descrição</span>
                <span>Início Prev.</span>
                <span>Término Prev.</span>
                <span>Peso %</span>
                <span />
              </div>

              {activities.map((act, idx) => (
                <div
                  key={act.id}
                  className="rounded-lg border bg-card p-3 sm:p-0 sm:border-0 sm:bg-transparent space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_130px_130px_70px_40px] sm:gap-2 sm:items-start"
                >
                  {/* Mobile label */}
                  <span className="text-xs font-medium text-muted-foreground sm:hidden">
                    Etapa {idx + 1}
                  </span>

                  <AutoTextarea
                    value={act.description}
                    onChange={(v) => updateActivity(act.id, 'description', v)}
                    placeholder={`Descrição da etapa ${idx + 1}`}
                  />

                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <div>
                      <Label className="text-xs sm:hidden">Início</Label>
                      <Input
                        type="date"
                        value={act.plannedStart}
                        onChange={(e) => updateActivity(act.id, 'plannedStart', e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:hidden">Término</Label>
                      <Input
                        type="date"
                        value={act.plannedEnd}
                        onChange={(e) => updateActivity(act.id, 'plannedEnd', e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:contents">
                    <div className="flex-1 sm:flex-none">
                      <Label className="text-xs sm:hidden">Peso %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={act.weight}
                        onChange={(e) => updateActivity(act.id, 'weight', e.target.value)}
                        className="text-sm h-9 text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeActivity(act.id)}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={addActivity} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Etapa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
