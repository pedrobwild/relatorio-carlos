import { useState, useEffect } from "react";
import { Copy, Loader2, Building2, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { projectsRepo, type ProjectWithCustomer } from "@/infra/repositories";

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
  const [projectName, setProjectName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [address, setAddress] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [isProjectPhase, setIsProjectPhase] = useState(false);
  const [startDateUndefined, setStartDateUndefined] = useState(false);
  const [endDateUndefined, setEndDateUndefined] = useState(false);

  // Customer fields
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

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
      setUnitName(project.unit_name || "");
      setAddress(project.address || "");
      setPlannedStartDate(project.planned_start_date || "");
      setPlannedEndDate(project.planned_end_date || "");
      setIsProjectPhase(project.is_project_phase || false);
      setStartDateUndefined(!project.planned_start_date);
      setEndDateUndefined(!project.planned_end_date);
      setCustomerName(project.customer_name || "");
      setCustomerEmail(project.customer_email || "");
      setCustomerPhone("");
    }
  }, [project, open]);

  const handleDuplicate = async () => {
    if (!project || !user) return;

    if (!projectName.trim()) {
      toast({ title: "Nome do projeto é obrigatório", variant: "destructive" });
      return;
    }

    if (!customerName.trim() || !customerEmail.trim()) {
      toast({
        title: "Dados do cliente são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await projectsRepo.duplicateProject({
        source: project,
        newName: projectName.trim(),
        unitName: unitName.trim() || null,
        address: address.trim() || null,
        plannedStartDate: startDateUndefined ? null : plannedStartDate || null,
        plannedEndDate: endDateUndefined ? null : plannedEndDate || null,
        contractValue: project.contract_value,
        isProjectPhase,
        orgId: project.org_id,
        createdBy: user.id,
        customer: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim() || null,
        },
        options,
      });

      if (error) throw error;

      toast({
        title: "Obra duplicada com sucesso!",
        description: `A obra "${projectName}" foi criada.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error duplicating project:", err);
      toast({
        title: "Erro ao duplicar obra",
        description: err.message,
        variant: "destructive",
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
            Crie uma nova obra baseada em "{project?.name}" com toda a
            configuração existente.
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
                  <Label
                    htmlFor="dup-is-project-phase"
                    className="text-sm font-medium"
                  >
                    🏗️ Obra em fase de projeto
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Marque se a obra ainda está na fase de aprovação (Projeto 3D
                    → Executivo)
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
                        if (checked) setPlannedStartDate("");
                      }}
                    />
                    <Label
                      htmlFor="start-undefined"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
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
                        if (checked) setPlannedEndDate("");
                      }}
                    />
                    <Label
                      htmlFor="end-undefined"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
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
                <Label
                  htmlFor="opt-activities"
                  className="text-sm cursor-pointer"
                >
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
                  <Label
                    htmlFor="opt-progress"
                    className="text-sm cursor-pointer text-muted-foreground"
                  >
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
                <Label
                  htmlFor="opt-payments"
                  className="text-sm cursor-pointer"
                >
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
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
