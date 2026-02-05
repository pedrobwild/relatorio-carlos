import { useState, useEffect } from 'react';
import { Copy, Loader2, Building2, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ProjectWithCustomer } from '@/infra/repositories';

interface DuplicateProjectModalProps {
  project: ProjectWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DuplicationOptions {
  includeActivities: boolean;
  includeProgress: boolean;
  includePayments: boolean;
  includeJourney: boolean;
}

export function DuplicateProjectModal({
  project,
  open,
  onOpenChange,
  onSuccess,
}: DuplicateProjectModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form fields
  const [projectName, setProjectName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [address, setAddress] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [isProjectPhase, setIsProjectPhase] = useState(false);
  const [startDateUndefined, setStartDateUndefined] = useState(false);
  const [endDateUndefined, setEndDateUndefined] = useState(false);

  // Customer fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Options
  const [options, setOptions] = useState<DuplicationOptions>({
    includeActivities: true,
    includeProgress: false,
    includePayments: false,
    includeJourney: true,
  });

  // Reset form when project changes
  useEffect(() => {
    if (project && open) {
      setProjectName(`${project.name} (Cópia)`);
      setUnitName(project.unit_name || '');
      setAddress(project.address || '');
      setPlannedStartDate(project.planned_start_date || '');
      setPlannedEndDate(project.planned_end_date || '');
      setIsProjectPhase((project as any).is_project_phase || false);
      setStartDateUndefined(!project.planned_start_date);
      setEndDateUndefined(!project.planned_end_date);
      setCustomerName(project.customer_name || '');
      setCustomerEmail(project.customer_email || '');
      setCustomerPhone('');
    }
  }, [project, open]);

  const handleDuplicate = async () => {
    if (!project || !user) return;

    if (!projectName.trim()) {
      toast({ title: 'Nome do projeto é obrigatório', variant: 'destructive' });
      return;
    }

    if (!customerName.trim() || !customerEmail.trim()) {
      toast({ title: 'Dados do cliente são obrigatórios', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // 1. Create the new project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          unit_name: unitName.trim() || null,
          address: address.trim() || null,
          planned_start_date: startDateUndefined ? null : (plannedStartDate || null),
          planned_end_date: endDateUndefined ? null : (plannedEndDate || null),
          contract_value: project.contract_value,
          status: 'active',
          created_by: user.id,
          org_id: project.org_id,
          is_project_phase: isProjectPhase,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Add current user as engineer
      await supabase.from('project_engineers').insert({
        project_id: newProject.id,
        engineer_user_id: user.id,
        is_primary: true,
      });

      // 3. Add customer
      await supabase.from('project_customers').insert({
        project_id: newProject.id,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim() || null,
      });

      // 4. Copy activities if selected
      if (options.includeActivities) {
        const { data: activities } = await supabase
          .from('project_activities')
          .select('*')
          .eq('project_id', project.id)
          .order('sort_order');

        if (activities && activities.length > 0) {
          const activitiesToInsert = activities.map((a, index) => ({
            project_id: newProject.id,
            description: a.description,
            planned_start: a.planned_start,
            planned_end: a.planned_end,
            // Conditionally include progress data
            actual_start: options.includeProgress ? a.actual_start : null,
            actual_end: options.includeProgress ? a.actual_end : null,
            baseline_start: options.includeProgress ? a.baseline_start : null,
            baseline_end: options.includeProgress ? a.baseline_end : null,
            baseline_saved_at: options.includeProgress ? a.baseline_saved_at : null,
            weight: a.weight,
            sort_order: index + 1,
            created_by: user.id,
            predecessor_ids: null, // Reset predecessors for new project
          }));

          await supabase.from('project_activities').insert(activitiesToInsert);
        }
      }

      // 5. Copy payments if selected
      if (options.includePayments) {
        const { data: payments } = await supabase
          .from('project_payments')
          .select('*')
          .eq('project_id', project.id)
          .order('installment_number');

        if (payments && payments.length > 0) {
          const paymentsToInsert = payments.map((p) => ({
            project_id: newProject.id,
            installment_number: p.installment_number,
            description: p.description,
            amount: p.amount,
            due_date: p.due_date, // Keep same dates or reset?
          }));

          await supabase.from('project_payments').insert(paymentsToInsert);
        }
      }

      // 6. Initialize journey if selected
      if (options.includeJourney) {
        await supabase.rpc('initialize_project_journey', { p_project_id: newProject.id });
      }

      toast({
        title: 'Obra duplicada com sucesso!',
        description: `A obra "${projectName}" foi criada.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Error duplicating project:', err);
      toast({
        title: 'Erro ao duplicar obra',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Obra
          </DialogTitle>
          <DialogDescription>
            Crie uma nova obra baseada em "{project?.name}" com toda a configuração existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              Dados da Nova Obra
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="dup-name">Nome do Projeto *</Label>
                <Input
                  id="dup-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Nome do projeto"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dup-unit">Unidade</Label>
                  <Input
                    id="dup-unit"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="Ex: Apartamento 502"
                  />
                </div>
                <div>
                  <Label htmlFor="dup-address">Endereço</Label>
                  <Input
                    id="dup-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Endereço"
                  />
                </div>
              </div>

              {/* Project Phase Toggle */}
              <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 p-4 bg-primary/5">
                <div className="space-y-0.5">
                  <Label htmlFor="dup-is-project-phase" className="text-sm font-medium">
                    🏗️ Obra em fase de projeto
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Marque se a obra ainda está na fase de aprovação (Projeto 3D → Executivo)
                  </p>
                </div>
                <Switch
                  id="dup-is-project-phase"
                  checked={isProjectPhase}
                  onCheckedChange={setIsProjectPhase}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Cronograma
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dup-start">Início Previsto</Label>
                {isProjectPhase && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="start-undefined"
                      checked={startDateUndefined}
                      onCheckedChange={(checked) => {
                        setStartDateUndefined(!!checked);
                        if (checked) setPlannedStartDate('');
                      }}
                    />
                    <Label htmlFor="start-undefined" className="text-xs text-muted-foreground cursor-pointer">
                      Em definição
                    </Label>
                  </div>
                )}
                {!startDateUndefined && (
                  <Input
                    id="dup-start"
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                  />
                )}
                {startDateUndefined && (
                  <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                    Em definição
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dup-end">Término Previsto</Label>
                {isProjectPhase && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="end-undefined"
                      checked={endDateUndefined}
                      onCheckedChange={(checked) => {
                        setEndDateUndefined(!!checked);
                        if (checked) setPlannedEndDate('');
                      }}
                    />
                    <Label htmlFor="end-undefined" className="text-xs text-muted-foreground cursor-pointer">
                      Em definição
                    </Label>
                  </div>
                )}
                {!endDateUndefined && (
                  <Input
                    id="dup-end"
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                  />
                )}
                {endDateUndefined && (
                  <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                    Em definição
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Dados do Cliente
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="dup-customer-name">Nome Completo *</Label>
                <Input
                  id="dup-customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dup-customer-email">E-mail *</Label>
                  <Input
                    id="dup-customer-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="dup-customer-phone">Telefone</Label>
                  <Input
                    id="dup-customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-3">
            <div className="text-sm font-medium">O que duplicar?</div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-activities"
                  checked={options.includeActivities}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, includeActivities: !!checked }))
                  }
                />
                <Label htmlFor="opt-activities" className="text-sm cursor-pointer">
                  Cronograma de atividades (datas planejadas)
                </Label>
              </div>

              {options.includeActivities && (
                <div className="flex items-center gap-2 ml-6">
                  <Checkbox
                    id="opt-progress"
                    checked={options.includeProgress}
                    onCheckedChange={(checked) =>
                      setOptions((o) => ({ ...o, includeProgress: !!checked }))
                    }
                  />
                  <Label htmlFor="opt-progress" className="text-sm cursor-pointer text-muted-foreground">
                    Incluir progresso real (datas de início/término reais)
                  </Label>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-payments"
                  checked={options.includePayments}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, includePayments: !!checked }))
                  }
                />
                <Label htmlFor="opt-payments" className="text-sm cursor-pointer">
                  Plano de pagamentos (parcelas sem marcação de pago)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-journey"
                  checked={options.includeJourney}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, includeJourney: !!checked }))
                  }
                />
                <Label htmlFor="opt-journey" className="text-sm cursor-pointer">
                  Jornada do Projeto (etapas padrão)
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar Obra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
