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
import { useProjectOptional } from "@/contexts/ProjectContext";
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

/**
 * Conclusão da etapa de Mobilização — o ponto em que a obra deixa a fase de
 * projeto e entra em execução (é o que libera o Cronograma).
 *
 * A obra é promovida NO LUGAR. O fluxo antigo clonava a obra num card novo e
 * marcava o original como concluído; como o clone não copiava a jornada, ela
 * era recriada do zero no Briefing e a obra parecia ter "voltado para as
 * etapas anteriores", com o cronograma dividido entre dois cards.
 */
export function MobilizacaoCompletionModal({
  open,
  onOpenChange,
  stageId,
  projectId,
  onSuccess,
}: MobilizacaoCompletionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectContext = useProjectOptional();
  const [loading, setLoading] = useState(false);
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [projectData, setProjectData] = useState<{
    name: string;
    unit_name: string | null;
    customer_name: string;
  } | null>(null);

  // Load project data when modal opens
  useEffect(() => {
    if (!open || !projectId) return;

    let cancelled = false;
    const defaultDate = addBusinessDays(new Date(), 5);
    setPlannedStartDate(formatDateForInput(defaultDate));

    (async () => {
      try {
        const { project, customer } =
          await projectsRepo.getProjectWithCustomerAndStages(projectId);
        if (cancelled) return;

        if (project) {
          setProjectData({
            name: project.name,
            unit_name: project.unit_name,
            customer_name: customer?.customer_name || "",
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
      // Conclui a etapa e tira a obra da fase de projeto na MESMA obra, numa
      // única transação no banco (RPC). Os marcos da jornada são gravados lá.
      const { error } = await projectsRepo.promoteProjectToExecution(projectId, {
        stageId,
        plannedStartDate,
      });

      if (error) throw error;

      // A jornada e a obra mudaram — e é a fase que controla o Cronograma.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-journey", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      ]);
      // ProjectContext guarda a obra fora do TanStack: sem este refetch o
      // Cronograma segue desabilitado na navegação até recarregar a página.
      await projectContext?.refetch();

      toast.success("Fase de projeto encerrada!", {
        description: `A obra "${projectData.name}" entrou em execução e o cronograma está liberado.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error promoting project to execution:", err);
      toast.error("Erro ao encerrar a fase de projeto", {
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
            Ao concluir esta etapa, esta obra sai da fase de projeto e entra em
            execução — o Cronograma é liberado. Nada é movido de lugar: a
            jornada, o cronograma, os documentos, o financeiro, as formalizações
            e as pendências seguem nesta mesma obra.
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

          {/* What stays with the obra */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              O que continua nesta obra:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "Jornada e etapas concluídas",
                "Cronograma (atividades)",
                "Dados do cliente",
                "Dados do empreendimento",
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
                Concluindo...
              </>
            ) : (
              <>Concluir e liberar cronograma</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
