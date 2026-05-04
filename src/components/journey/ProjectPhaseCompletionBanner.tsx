import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import type { JourneyStage } from "@/hooks/useProjectJourney";

interface Props {
  projectId: string;
  projectName: string;
  isProjectPhase: boolean;
  stages: JourneyStage[];
  isStaff: boolean;
}

const dismissKey = (id: string) => `phase_banner_dismissed_${id}`;

/**
 * Banner shown to staff when ALL journey stages are completed but the project
 * is still flagged as `is_project_phase = true`. Suggests flipping the switch
 * so the Schedule (Cronograma) becomes available.
 */
export function ProjectPhaseCompletionBanner({
  projectId,
  projectName,
  isProjectPhase,
  stages,
  isStaff,
}: Props) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(dismissKey(projectId)) === "1";
  });

  // Only staff sees this; only when project is still in project phase
  if (!isStaff || !isProjectPhase || dismissed) return null;
  if (!stages.length) return null;

  const allCompleted = stages.every((s) => s.status === "completed");
  if (!allCompleted) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ is_project_phase: false })
        .eq("id", projectId);
      if (error) throw error;
      toast.success("Fase de projeto concluída. Cronograma liberado.");
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (err: any) {
      console.error("Failed to flip is_project_phase", err);
      toast.error(
        err?.message || "Não foi possível concluir a fase de projeto.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(dismissKey(projectId), "1");
  };

  return (
    <Alert className="mb-4 border-primary/40 bg-primary/5">
      <Sparkles className="h-4 w-4 text-primary" />
      <AlertTitle className="flex items-center gap-2">
        Todas as etapas da Jornada estão concluídas
      </AlertTitle>
      <AlertDescription className="mt-1 space-y-3">
        <p className="text-sm text-muted-foreground">
          A obra{" "}
          <span className="font-medium text-foreground">{projectName}</span>{" "}
          ainda está marcada como <em>fase de projeto</em>. Encerrar essa fase
          libera o Cronograma para gestão da execução.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Encerrar fase de projeto
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Lembrar depois
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
