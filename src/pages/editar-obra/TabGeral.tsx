import { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, DollarSign, Map, User, Info, RefreshCw, CalendarRange } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { countBusinessDaysInclusive } from '@/lib/businessDays';
import type { Project, Customer, Activity } from './types';
import { ScheduleSyncAlert } from './ScheduleSyncAlert';
import { WeeklyRecalcPreviewDialog } from './WeeklyRecalcPreviewDialog';

const STATUS_DESCRIPTIONS: Record<string, string> = {
  active: 'A obra está em execução. O cliente pode acompanhar atualizações pelo portal.',
  paused: 'A obra está temporariamente pausada. O cliente será notificado.',
  completed: 'A obra foi concluída. O cliente terá acesso de leitura ao histórico.',
  cancelled: 'A obra foi cancelada. Os dados serão preservados para consulta.',
};

interface TabGeralProps {
  project: Project;
  customer: Customer | null;
  activities?: Activity[];
  onProjectChange: (field: keyof Project, value: string | number | boolean | null) => void;
  onCustomerChange: (field: keyof Customer, value: string | null) => void;
  onRecalculateSchedule?: () => void;
  onRecalculateWeekly?: () => void;
  onApplyBusinessDaysDuration?: (days: number) => string | null;
  isSaving?: boolean;
}

export function TabGeral({
  project,
  customer,
  activities = [],
  onProjectChange,
  onCustomerChange,
  onRecalculateSchedule,
  onRecalculateWeekly,
  onApplyBusinessDaysDuration,
  isSaving,
}: TabGeralProps) {
  // Dias úteis derivados do intervalo atual planned_start..planned_end
  const derivedDuration = useMemo(() => {
    if (!project.planned_start_date || !project.planned_end_date) return '';
    const s = new Date(project.planned_start_date + 'T00:00:00');
    const e = new Date(project.planned_end_date + 'T00:00:00');
    if (e < s) return '';
    return String(countBusinessDaysInclusive(s, e));
  }, [project.planned_start_date, project.planned_end_date]);

  const [durationInput, setDurationInput] = useState<string>(derivedDuration);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    setDurationInput(derivedDuration);
  }, [derivedDuration]);

  const handleApplyDuration = () => {
    const n = parseInt(durationInput, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    onApplyBusinessDaysDuration?.(n);
  };

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Building2 className="h-5 w-5" />
            Informações do Projeto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Condomínio *</Label>
              <Input value={project.name} onChange={(e) => onProjectChange('name', e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={project.unit_name || ''} onChange={(e) => onProjectChange('unit_name', e.target.value || null)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={project.status} onValueChange={(v) => onProjectChange('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Em andamento</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              {STATUS_DESCRIPTIONS[project.status] && (
                <p className="flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {STATUS_DESCRIPTIONS[project.status]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Info - Card layout for mobile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Map className="h-5 w-5" />
            Localização
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile: stacked detail cards */}
          <div className="sm:hidden space-y-3">
            <DetailItem label="Endereço" value={project.address} onChange={(v) => onProjectChange('address', v)} />
            <DetailItem label="Bairro" value={project.bairro} onChange={(v) => onProjectChange('bairro', v)} />
            <DetailItem label="CEP" value={project.cep} onChange={(v) => onProjectChange('cep', v)} placeholder="00000-000" />
          </div>
          {/* Desktop: grid */}
          <div className="hidden sm:grid grid-cols-2 gap-4">
            <div>
              <Label>Endereço</Label>
              <Input value={project.address || ''} onChange={(e) => onProjectChange('address', e.target.value || null)} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={project.bairro || ''} onChange={(e) => onProjectChange('bairro', e.target.value || null)} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={project.cep || ''} onChange={(e) => onProjectChange('cep', e.target.value || null)} placeholder="00000-000" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Phase Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
            <div className="space-y-0.5">
              <Label htmlFor="is_project_phase" className="text-sm font-medium">Obra em fase de projeto</Label>
              <p className="text-xs text-muted-foreground">Ative se a obra ainda está em fase de aprovação (Projeto 3D → Executivo → Liberação)</p>
            </div>
            <Switch id="is_project_phase" checked={project.is_project_phase} onCheckedChange={(checked) => onProjectChange('is_project_phase', checked)} />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Calendar className="h-5 w-5" />
            Cronograma
          </CardTitle>
          {project.is_project_phase && (
            <CardDescription>Obra em fase de projeto. As datas podem ser definidas ou marcadas como "Em definição".</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <ScheduleSyncAlert
            plannedStart={project.planned_start_date}
            plannedEnd={project.planned_end_date}
            activities={activities}
            onRecalculate={onRecalculateSchedule}
            isBusy={isSaving}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateFieldWithPending label="Início Previsto" required={!project.is_project_phase} showPending={project.is_project_phase} value={project.planned_start_date} onChange={(v) => onProjectChange('planned_start_date', v)} id="start" />
            <DateFieldWithPending label="Término Previsto" required={!project.is_project_phase} showPending={project.is_project_phase} value={project.planned_end_date} onChange={(v) => onProjectChange('planned_end_date', v)} id="end" />
            <div>
              <Label>Início Real</Label>
              <Input type="date" value={project.actual_start_date || ''} onChange={(e) => onProjectChange('actual_start_date', e.target.value || null)} />
            </div>
            <div>
              <Label>Término Real</Label>
              <Input type="date" value={project.actual_end_date || ''} onChange={(e) => onProjectChange('actual_end_date', e.target.value || null)} />
            </div>
          </div>

          {/* Duração em dias úteis + recálculo semana a semana */}
          {onApplyBusinessDaysDuration && (
            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CalendarRange className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="business_days_duration" className="text-sm font-medium">
                    Dias úteis de execução
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A partir do Início Previsto, calcula o Término automaticamente, pulando finais de semana e feriados de SP.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="business_days_duration"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Ex: 60"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className="sm:w-40"
                  disabled={!project.planned_start_date || isSaving}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleApplyDuration}
                  disabled={!project.planned_start_date || !durationInput || isSaving}
                  className="sm:w-auto"
                >
                  Aplicar duração
                </Button>
              </div>
              {!project.planned_start_date && (
                <p className="text-xs text-muted-foreground">Defina o Início Previsto para usar a duração em dias úteis.</p>
              )}
            </div>
          )}

          {/* Recálculo semana a semana das etapas */}
          {onRecalculateWeekly && activities.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <RefreshCw className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recalcular etapas semana a semana</p>
                  <p className="text-xs text-muted-foreground">
                    Reorganiza cada etapa do cronograma em uma semana útil (Seg→Sex), preservando a ordem, a partir do Início Previsto.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!project.planned_start_date || isSaving}
                className="sm:w-auto whitespace-nowrap"
              >
                Pré-visualizar recálculo
              </Button>
            </div>
          )}

          {onRecalculateWeekly && (
            <WeeklyRecalcPreviewDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              activities={activities}
              startDate={project.planned_start_date}
              currentEndDate={project.planned_end_date}
              isBusy={isSaving}
              onConfirm={onRecalculateWeekly}
            />
          )}
        </CardContent>
      </Card>

      {/* Milestone Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Calendar className="h-5 w-5" />
            Datas-Chave do Projeto
          </CardTitle>
          <CardDescription>Marcos importantes da jornada do cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile: stacked */}
          <div className="sm:hidden space-y-3">
            {([
              ['date_briefing_arch', 'Briefing com Arquiteta'],
              ['date_approval_3d', 'Aprovação 3D'],
              ['date_approval_exec', 'Aprovação Executivo'],
              ['date_approval_obra', 'Aprovação Obra'],
              ['date_official_start', 'Início Oficial'],
              ['date_mobilization_start', 'Início Mobilização'],
              ['date_official_delivery', 'Entrega Oficial'],
              ['contract_signing_date', 'Assinatura do Contrato'],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">{label}</Label>
                <Input type="date" value={project[field] || ''} onChange={(e) => onProjectChange(field, e.target.value || null)} className="w-auto max-w-[160px]" />
              </div>
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden sm:grid grid-cols-2 gap-4">
            {([
              ['date_briefing_arch', 'Briefing com Arquiteta'],
              ['date_approval_3d', 'Aprovação 3D'],
              ['date_approval_exec', 'Aprovação Executivo'],
              ['date_approval_obra', 'Aprovação Obra'],
              ['date_official_start', 'Início Oficial'],
              ['date_mobilization_start', 'Início Mobilização'],
              ['date_official_delivery', 'Entrega Oficial'],
              ['contract_signing_date', 'Assinatura do Contrato'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <Label>{label}</Label>
                <Input type="date" value={project[field] || ''} onChange={(e) => onProjectChange(field, e.target.value || null)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Financial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <DollarSign className="h-5 w-5" />
            Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Valor do Contrato (R$)</Label>
            <Input type="number" step="0.01" value={project.contract_value || ''} onChange={(e) => onProjectChange('contract_value', e.target.value ? parseFloat(e.target.value) : null)} />
          </div>
        </CardContent>
      </Card>

      {/* Customer Data */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-body">
              <User className="h-5 w-5" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome Completo</Label>
                <Input value={customer.customer_name} onChange={(e) => onCustomerChange('customer_name', e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={customer.customer_email} onChange={(e) => onCustomerChange('customer_email', e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={customer.customer_phone || ''} onChange={(e) => onCustomerChange('customer_phone', e.target.value || null)} />
              </div>
            </div>
            {customer.customer_user_id || customer.invitation_accepted_at ? (
              <Badge className="bg-green-500/10 text-green-600">Cadastrado no portal</Badge>
            ) : customer.invitation_sent_at ? (
              <Badge variant="outline">Convite enviado em {format(new Date(customer.invitation_sent_at), 'dd/MM/yyyy')}</Badge>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Date field with optional "Em definição" checkbox */
function DateFieldWithPending({
  label, required, showPending, value, onChange, id,
}: {
  label: string; required: boolean; showPending: boolean; value: string | null; onChange: (v: string | null) => void; id: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label} {required && '*'}</Label>
      {showPending && (
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}_undefined`} checked={!value} onCheckedChange={(checked) => { if (checked) onChange(null); }} />
          <Label htmlFor={`${id}_undefined`} className="text-xs text-muted-foreground cursor-pointer">Em definição</Label>
        </div>
      )}
      {(!showPending || value) ? (
        <Input type="date" value={value || ''} onChange={(e) => onChange(e.target.value || null)} />
      ) : (
        <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">Em definição</div>
      )}
    </div>
  );
}

/** Mobile-friendly detail item */
function DetailItem({ label, value, onChange, placeholder }: {
  label: string; value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value || ''} onChange={(e) => onChange(e.target.value || null)} placeholder={placeholder} className="border-0 p-0 h-auto shadow-none focus-visible:ring-0" />
    </div>
  );
}
