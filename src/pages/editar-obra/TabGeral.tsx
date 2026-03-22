import { Building2, Calendar, DollarSign, Map, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { Project, Customer } from './types';

interface TabGeralProps {
  project: Project;
  customer: Customer | null;
  onProjectChange: (field: keyof Project, value: string | number | boolean | null) => void;
  onCustomerChange: (field: keyof Customer, value: string | null) => void;
}

export function TabGeral({ project, customer, onProjectChange, onCustomerChange }: TabGeralProps) {
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
            </div>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Map className="h-5 w-5" />
            Fase do Projeto
          </CardTitle>
        </CardHeader>
        <CardContent>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
