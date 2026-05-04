import { useState, useEffect } from "react";
import { Loader2, Calendar, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { projectsRepo } from "@/infra/repositories";
import { useAuth } from "@/hooks/useAuth";
import { useCompleteStage } from "@/hooks/useProjectJourney";
import { addBusinessDays } from "@/lib/businessDays";
import { useQueryClient } from "@tanstack/react-query";

interface MobilizacaoCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  projectId: string;
  onSuccess?: () => void;
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function MobilizacaoCompletionModal({
  open,
  onOpenChange,
  stageId,
  projectId,
  onSuccess,
}: MobilizacaoCompletionModalProps) {
  const { user } = useAuth();
  const completeStage = useCompleteStage();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [projectData, setProjectData] = useState<{
    name: string;
    unit_name: string | null;
    address: string | null;
    bairro: string | null;
    cep: string | null;
    contract_value: number | null;
    org_id: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    milestoneDates: {
      contract_signing_date: string | null;
      date_briefing_arch: string | null;
      date_approval_3d: string | null;
      date_approval_exec: string | null;
      date_approval_obra: string | null;
      date_mobilization_start: string | null;
    };
  } | null>(null);

  // Load project data when modal opens
  useEffect(() => {
    if (!open || !projectId) return;

    let cancelled = false;
    const defaultDate = addBusinessDays(new Date(), 5);
    setPlannedStartDate(formatDateForInput(defaultDate));

    (async () => {
      try {
        const { project, customer, stages } =
          await projectsRepo.getProjectWithCustomerAndStages(projectId);
        if (cancelled) return;

        if (project) {
          const stageMap = new Map(
            stages.map((s: { name: string; confirmed_end: string | null }) => [
              s.name.toLowerCase(),
              s.confirmed_end,
            ]),
          );

          const milestoneDates = {
            contract_signing_date:
              project.contract_signing_date ??
              stageMap.get("boas-vindas") ??
              null,
            date_briefing_arch:
              (stageMap.get("briefing arquitetônico") as string | null) ?? null,
            date_approval_3d:
              (stageMap.get("projeto 3d") as string | null) ?? null,
            date_approval_exec:
              (stageMap.get("projeto executivo") as string | null) ?? null,
            date_approval_obra:
              (stageMap.get("liberação da obra") as string | null) ?? null,
            date_mobilization_start:
              (stageMap.get("mobilização") as string | null) ?? null,
          };

          setProjectData({
            name: project.name,
            unit_name: project.unit_name,
            address: project.address,
            bairro: project.bairro,
            cep: project.cep,
            contract_value: project.contract_value,
            org_id: project.org_id,
            customer_name: customer?.customer_name || "",
            customer_email: customer?.customer_email || "",
            customer_phone: customer?.customer_phone || null,
            milestoneDates,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load project data for mobilization:", err);
          toast.error("Erro ao carregar dados do projeto");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleConfirm = async () => {
    if (!user || !projectData || !plannedStartDate) return;

    setLoading(true);

    try {
      // 1. Complete the Mobilização stage
      await completeStage.mutateAsync({ stageId, projectId });

      // 2. Clone the project using the repository
      const { error } = await projectsRepo.cloneProjectForConstruction(
        projectId,
        {
          name: projectData.name,
          unit_name: projectData.unit_name,
          address: projectData.address,
          bairro: projectData.bairro,
          cep: projectData.cep,
          contract_value: projectData.contract_value,
          org_id: projectData.org_id,
          planned_start_date: plannedStartDate,
          status: "active",
          created_by: user.id,
          is_project_phase: false,
          contract_signing_date:
            projectData.milestoneDates.contract_signing_date,
          date_briefing_arch: projectData.milestoneDates.date_briefing_arch,
          date_approval_3d: projectData.milestoneDates.date_approval_3d,
          date_approval_exec: projectData.milestoneDates.date_approval_exec,
          date_approval_obra: projectData.milestoneDates.date_approval_obra,
          date_mobilization_start:
            projectData.milestoneDates.date_mobilization_start,
        },
        user.id,
      );

      if (error) throw error;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["staff-projects"] });

      toast.success("Obra de acompanhamento criada com sucesso!", {
        description: `A obra "${projectData.name}" está pronta para acompanhamento.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error creating construction project:", err);
      toast.error("Erro ao criar obra de acompanhamento", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Concluir Mobilização
          </DialogTitle>
          <DialogDescription>
            Ao concluir esta etapa, uma nova obra de acompanhamento será criada
            com os dados do cliente e empreendimento. Documentos, financeiro,
            formalizações e pendências serão mantidos.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4 py-2">
          {/* Project info summary */}
          {projectData && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium">{projectData.name}</p>
              {projectData.unit_name && (
                <p className="text-xs text-muted-foreground">
                  {projectData.unit_name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Cliente: {projectData.customer_name}
              </p>
            </div>
          )}

          {/* Start date picker */}
          <div className="space-y-2">
            <Label
              htmlFor="mob-start-date"
              className="flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Data de início da obra *
            </Label>
            <Input
              id="mob-start-date"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sugestão: 5 dias úteis após a conclusão da liberação da obra.
            </p>
          </div>

          {/* What will be copied */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              O que será mantido na nova obra:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "Dados do cliente",
                "Dados do empreendimento",
                "Cronograma (atividades)",
                "Financeiro (parcelas)",
                "Documentos",
                "Formalizações",
                "Pendências",
                "Compras",
                "Equipe do projeto",
                "Projeto 3D",
                "Marcos do projeto",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-1.5 text-xs text-foreground"
                >
                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !plannedStartDate}
            className="min-h-[44px] gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando obra...
              </>
            ) : (
              <>Concluir e criar obra</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
