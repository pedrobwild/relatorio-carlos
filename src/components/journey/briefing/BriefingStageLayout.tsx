import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StageSummary } from "../StageSummary";
import { StageIntroCard } from "./StageIntroCard";
import { MeetingAvailabilityCard } from "./MeetingAvailabilityCard";
import { AdminMeetingPanel } from "./AdminMeetingPanel";
import { StageLogSection } from "./StageLogSection";
import { useStageRecords } from "@/hooks/useStageRecords";
import { useCompleteStage, type JourneyStage } from "@/hooks/useProjectJourney";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BriefingStageLayoutProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
  onStageCompleted?: () => void;
}

export function BriefingStageLayout({
  stage,
  projectId,
  isAdmin,
  onStageCompleted,
}: BriefingStageLayoutProps) {
  const { data: records } = useStageRecords(stage.id, projectId);
  const completeStage = useCompleteStage();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasMinutes = (records ?? []).some((r) => r.category === "conversation");
  // Show advance button for admin when minutes exist and stage not yet completed
  const showNextButton = isAdmin && hasMinutes && stage.status !== "completed";

  const handleAdvance = () => {
    completeStage.mutate(
      { stageId: stage.id, projectId },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast.success("Etapa de Briefing concluída! Projeto 3D liberado.");
          onStageCompleted?.();
        },
        onError: (err) => {
          toast.error("Erro ao concluir etapa. Tente novamente.");
          console.error("BriefingStageLayout advance error:", err);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <StageSummary stage={stage} isExpanded={true} hideChevron />

      {/* ① StageIntroCard */}
      <StageIntroCard />

      {/* ② Meeting section — admin sees AdminMeetingPanel, client sees MeetingAvailabilityCard */}
      {isAdmin ? (
        <AdminMeetingPanel stageId={stage.id} projectId={projectId} />
      ) : (
        <MeetingAvailabilityCard
          stageId={stage.id}
          projectId={projectId}
          isAdmin={isAdmin}
        />
      )}

      <Separator />

      {/* ③ StageLogSection */}
      <StageLogSection
        stageId={stage.id}
        projectId={projectId}
        isAdmin={isAdmin}
        minutesOnly
        stageName={stage.name}
      />

      {/* ④ Next stage button for client after minutes are published */}
      {showNextButton && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ata de reunião registrada
                </p>
                <p className="text-xs text-muted-foreground">
                  A ata do briefing foi publicada. Ao avançar, a etapa do
                  Projeto 3D será liberada.
                </p>
              </div>
            </div>
            <Button className="w-full" onClick={() => setConfirmOpen(true)}>
              Próxima etapa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avançar para Projeto 3D?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, a etapa de Briefing será concluída e a etapa do
              Projeto 3D será desbloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdvance}
              disabled={completeStage.isPending}
            >
              {completeStage.isPending ? "Avançando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
