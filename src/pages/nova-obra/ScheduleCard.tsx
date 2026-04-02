import { useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addBusinessDays } from '@/lib/businessDays';
import type { FormData } from './types';

interface ScheduleCardProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}

export function ScheduleCard({ formData, onChange }: ScheduleCardProps) {
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

  const isEndDateAutoCalculated = !!(formData.planned_start_date && parseInt(formData.business_days_duration, 10) > 0);

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
      <CardContent className="space-y-4">
        {formData.is_project_phase && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-4">
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
      </CardContent>
    </Card>
  );
}
