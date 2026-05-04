import { useState } from "react";
import { Edit2, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { JourneyStage, useCompleteStage } from "@/hooks/useProjectJourney";
import { StageSummary } from "./StageSummary";
import { StageDetailsSections } from "./StageDetailsSections";
import { StageChecklist } from "./StageChecklist";
import { StageDatesPanel } from "./StageDatesPanel";
import { MeetingCTA } from "./MeetingCTA";
import { StageRegistry } from "./StageRegistry";
import { StageChat } from "./StageChat";
import { StagePhotoGallery } from "./StagePhotoGallery";
import { AdminEditForm } from "./stage-detail/AdminEditForm";

interface StageDetailSheetProps {
  stage: JourneyStage | null;
  projectId: string;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextStageName?: string | null;
}

export function StageDetailSheet({
  stage,
  projectId,
  isAdmin,
  open,
  onOpenChange,
  nextStageName,
}: StageDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const completeStage = useCompleteStage();

  if (!stage) return null;

  const canComplete =
    isAdmin && stage.status !== "completed" && stage.status !== "pending";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col h-full"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base font-bold text-foreground">
            {stage.name}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detalhes da etapa {stage.name}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 py-5 space-y-6">
            {/* Summary header */}
            <StageSummary stage={stage} isExpanded={true} hideChevron />

            {/* Admin Edit */}
            {isEditing && (
              <AdminEditForm
                stage={stage}
                projectId={projectId}
                onClose={() => setIsEditing(false)}
              />
            )}

            {/* ① CTA — first, above the fold */}
            {!isEditing && stage.cta_visible && stage.cta_text && (
              <div className="space-y-2">
                {stage.cta_text.toLowerCase().includes("reunião") ? (
                  <MeetingCTA
                    stageId={stage.id}
                    stageName={stage.name}
                    projectId={projectId}
                    isAdmin={isAdmin}
                    ctaText={stage.cta_text}
                  />
                ) : (
                  <Button className="w-full min-h-[44px]">
                    {stage.cta_text}
                  </Button>
                )}
                {stage.microcopy && (
                  <p className="text-xs text-muted-foreground">
                    {stage.microcopy}
                  </p>
                )}
              </div>
            )}

            {/* ② Dates Panel */}
            <StageDatesPanel
              stageId={stage.id}
              projectId={projectId}
              isAdmin={isAdmin}
              stageName={stage.name}
            />

            <Separator />

            {/* ③ Checklists */}
            <div className="grid gap-5 md:gap-6 md:grid-cols-2">
              <StageChecklist
                todos={stage.todos}
                owner="client"
                label="✔️ To-dos do Cliente"
                projectId={projectId}
                stageId={stage.id}
                isAdmin={isAdmin}
              />
              <StageChecklist
                todos={stage.todos}
                owner="bwild"
                label="🧰 To-dos Bwild"
                projectId={projectId}
                stageId={stage.id}
                isAdmin={isAdmin}
              />
            </div>

            <Separator />

            {/* ④ Stage Registry */}
            <StageRegistry
              stageId={stage.id}
              projectId={projectId}
              isAdmin={isAdmin}
            />

            <Separator />

            {/* ④.5 Photo Gallery */}
            <StagePhotoGallery
              stageId={stage.id}
              projectId={projectId}
              isAdmin={isAdmin}
            />

            <Separator />

            {/* ⑤ Chat contextual */}
            <StageChat
              stageId={stage.id}
              projectId={projectId}
              isAdmin={isAdmin}
            />

            <Separator />
            {!isEditing && stage.description && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="group w-full justify-between h-10 text-xs text-muted-foreground hover:text-foreground gap-2 px-3"
                  >
                    <span className="font-medium">Sobre esta etapa</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <StageDetailsSections stage={stage} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border px-5 py-4 flex items-center gap-3">
          {isAdmin && !isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="h-10 gap-1.5 text-xs min-h-[44px]"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar etapa
            </Button>
          )}

          {canComplete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-10 gap-1.5 text-xs min-h-[44px] ml-auto"
                  disabled={completeStage.isPending}
                >
                  {completeStage.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Concluir etapa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Concluir "{stage.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A data de conclusão será registrada e a próxima etapa
                    {nextStageName ? ` ("${nextStageName}")` : ""} será liberada
                    automaticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="min-h-[44px]"
                    onClick={() => {
                      completeStage.mutate({ stageId: stage.id, projectId });
                    }}
                  >
                    Sim, concluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {stage.status === "completed" && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(var(--success))] font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Etapa concluída
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
