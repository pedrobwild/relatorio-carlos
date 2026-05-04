import { useState } from "react";
import {
  Edit2,
  ChevronDown,
  CheckCircle2,
  ImageIcon,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { JourneyStage, useCompleteStage } from "@/hooks/useProjectJourney";
import {
  useJourneyTeamMembers,
  JourneyTeamMember,
} from "@/hooks/useJourneyTeamMembers";
import { TeamMemberEditModal } from "./TeamMemberEditModal";
import { StageSummary } from "./StageSummary";
import { MobilizacaoCompletionModal } from "./MobilizacaoCompletionModal";
import { StageDetailsSections } from "./StageDetailsSections";
import { StageChecklist } from "./StageChecklist";
import { StageDatesPanel } from "./StageDatesPanel";
import { MeetingCTA } from "./MeetingCTA";
import { StageRegistry } from "./StageRegistry";
import { BriefingStageLayout } from "./briefing/BriefingStageLayout";
import { VersionsListModal } from "@/components/projeto3d/VersionsListModal";
import { ExecutivoVersionsModal } from "@/components/executivo/ExecutivoVersionsModal";
import { usePageInstructions } from "@/hooks/usePageInstructions";
import { useUserRole } from "@/hooks/useUserRole";
import { RichTextEditorModal } from "@/components/report/RichTextEditorModal";
import { STAGE_INSTRUCTIONS_DEFAULTS } from "@/constants/stageInstructionsTemplates";
import { AdminEditForm } from "./stage-detail/AdminEditForm";
import { MobilizacaoTeamCard } from "./stage-detail/MobilizacaoTeamCard";
import { InstructionsCollapsible } from "./stage-detail/InstructionsCollapsible";
import {
  CompleteStageButton,
  CompletedBadge,
} from "./stage-detail/StageFooterActions";

interface StageDetailInlineProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
  nextStageName?: string | null;
  onStageCompleted?: (nextStageId?: string) => void;
  allStages?: JourneyStage[];
}

export function StageDetailInline({
  stage,
  projectId,
  isAdmin,
  nextStageName,
  onStageCompleted,
  allStages: _allStages = [],
}: StageDetailInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [instrEditorOpen, setInstrEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [executivoVersionsOpen, setExecutivoVersionsOpen] = useState(false);
  const [teamExpanded, setTeamExpanded] = useState(false);
  const [teamEditModalOpen, setTeamEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<JourneyTeamMember | null>(
    null,
  );
  const [mobilizacaoModalOpen, setMobilizacaoModalOpen] = useState(false);
  const completeStage = useCompleteStage();
  const { isStaff } = useUserRole();
  const {
    members,
    addMember,
    updateMember,
    removeMember,
    uploadPhoto,
    isAdding,
    isUpdating,
    isUploading,
  } = useJourneyTeamMembers(projectId);

  const handleSaveTeamMember = async (data: {
    display_name: string;
    role_title: string;
    description: string;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
  }) => {
    if (editingMember) {
      await updateMember({ id: editingMember.id, ...data });
    } else {
      await addMember({ project_id: projectId, ...data });
    }
  };

  const handleUploadTeamPhoto = async (file: File) => {
    return await uploadPhoto({ file });
  };

  // Derive page_key from stage name for instructions
  const pageKey = stage.name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const { instruction, save: saveInstruction } = usePageInstructions(
    projectId,
    pageKey,
  );
  const defaultTemplate = STAGE_INSTRUCTIONS_DEFAULTS[pageKey] || "";
  const displayHtml = instruction?.content_html || defaultTemplate;
  const hasInstructions = !!displayHtml && displayHtml !== "<p><br></p>";

  const canComplete =
    isAdmin && stage.status !== "completed" && stage.status !== "pending";

  // Detect stage types
  const isBriefingStage = stage.name.toLowerCase().includes("briefing");
  const isProjeto3DStage = stage.name.toLowerCase().includes("projeto 3d");
  const isProjetoExecutivoStage = stage.name
    .toLowerCase()
    .includes("projeto executivo");
  const isMobilizacaoStage =
    stage.name.toLowerCase().includes("mobilização") ||
    stage.name.toLowerCase().includes("mobilizacao");
  const isMedicaoTecnicaStage =
    stage.name.toLowerCase().includes("medição técnica") ||
    stage.name.toLowerCase().includes("medicao tecnica");

  const handleCompleteStage = (
    params: { stageId: string; projectId: string },
    callbacks?: { onSuccess?: () => void },
  ) => {
    completeStage.mutate(params, { onSuccess: callbacks?.onSuccess });
  };

  // ─── Briefing layout ───
  if (isBriefingStage) {
    return (
      <div className="space-y-6">
        {isEditing && (
          <AdminEditForm
            stage={stage}
            projectId={projectId}
            onClose={() => setIsEditing(false)}
          />
        )}
        {!isEditing && (
          <BriefingStageLayout
            stage={stage}
            projectId={projectId}
            isAdmin={isAdmin}
            onStageCompleted={onStageCompleted}
          />
        )}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAdmin && !isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3.5 w-3.5" /> Editar etapa
            </Button>
          )}
          {canComplete && (
            <CompleteStageButton
              stageName={stage.name}
              stageId={stage.id}
              projectId={projectId}
              nextStageName={nextStageName}
              isPending={completeStage.isPending}
              onComplete={handleCompleteStage}
            />
          )}
          {stage.status === "completed" && <CompletedBadge />}
        </div>
      </div>
    );
  }

  // ─── Default layout ───
  return (
    <div className="space-y-6">
      <StageSummary stage={stage} isExpanded={true} hideChevron />

      {/* Instructions */}
      {(hasInstructions || isStaff) && (
        <InstructionsCollapsible
          hasInstructions={hasInstructions}
          displayHtml={displayHtml}
          isStaff={isStaff}
          onEditClick={() => setInstrEditorOpen(true)}
        />
      )}

      {/* Team for Mobilização */}
      {isMobilizacaoStage && (
        <MobilizacaoTeamCard
          members={members}
          isAdmin={isAdmin}
          teamExpanded={teamExpanded}
          setTeamExpanded={setTeamExpanded}
          onAdd={() => {
            setEditingMember(null);
            setTeamEditModalOpen(true);
          }}
          onEdit={(m) => {
            setEditingMember(m);
            setTeamEditModalOpen(true);
          }}
          onRemove={(id) => removeMember(id)}
        />
      )}

      {isEditing && (
        <AdminEditForm
          stage={stage}
          projectId={projectId}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* CTA */}
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
            <Button className="w-full min-h-[44px]">{stage.cta_text}</Button>
          )}
          {stage.microcopy && (
            <p className="text-xs text-muted-foreground">{stage.microcopy}</p>
          )}
        </div>
      )}

      {/* Dates Panel */}
      {!isProjetoExecutivoStage && !isMobilizacaoStage && (
        <>
          <StageDatesPanel
            stageId={stage.id}
            projectId={projectId}
            isAdmin={isAdmin}
            stageName={stage.name}
          />
          <Separator />
        </>
      )}

      {/* Checklists */}
      {!isProjetoExecutivoStage && !isMobilizacaoStage && (
        <>
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
        </>
      )}

      {/* 3D Versions */}
      {isProjeto3DStage && (
        <>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Versões do Projeto 3D
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Imagens com comentários posicionáveis
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVersionsOpen(true)}
                className="gap-1.5"
              >
                <Eye className="h-4 w-4" />{" "}
                {isStaff ? "Gerenciar" : "Visualizar"}
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Executivo Versions */}
      {isProjetoExecutivoStage && (
        <>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Versões do Projeto Executivo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    PDFs com comentários por página
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExecutivoVersionsOpen(true)}
                className="gap-1.5"
              >
                <Eye className="h-4 w-4" />{" "}
                {isStaff ? "Gerenciar" : "Visualizar"}
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Stage Registry */}
      {!isProjetoExecutivoStage && !isMobilizacaoStage && (
        <>
          <StageRegistry
            stageId={stage.id}
            projectId={projectId}
            isAdmin={isAdmin}
          />
          <Separator />
        </>
      )}

      {/* About this stage */}
      {!isEditing && stage.description && !isMedicaoTecnicaStage && (
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

      <Separator />

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {isAdmin && !isEditing && (
          <Button
            size="sm"
            variant="outline"
            className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3.5 w-3.5" /> Editar etapa
          </Button>
        )}

        {canComplete && isMobilizacaoStage && (
          <>
            <Button
              size="sm"
              className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto sm:ml-auto"
              onClick={() => setMobilizacaoModalOpen(true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Concluir etapa
            </Button>
            <MobilizacaoCompletionModal
              open={mobilizacaoModalOpen}
              onOpenChange={setMobilizacaoModalOpen}
              stageId={stage.id}
              projectId={projectId}
              onSuccess={() => onStageCompleted?.()}
            />
          </>
        )}

        {canComplete && !isMobilizacaoStage && (
          <CompleteStageButton
            stageName={stage.name}
            stageId={stage.id}
            projectId={projectId}
            nextStageName={nextStageName}
            isPending={completeStage.isPending}
            onComplete={handleCompleteStage}
            onSuccess={() => onStageCompleted?.()}
          />
        )}

        {stage.status === "completed" && <CompletedBadge />}
      </div>

      {/* Modals */}
      {isStaff && (
        <RichTextEditorModal
          open={instrEditorOpen}
          onOpenChange={setInstrEditorOpen}
          value={displayHtml}
          onSave={saveInstruction}
          title={`Editar Instruções — ${stage.name}`}
        />
      )}
      {isProjeto3DStage && (
        <VersionsListModal
          projectId={projectId}
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
        />
      )}
      {isProjetoExecutivoStage && (
        <ExecutivoVersionsModal
          projectId={projectId}
          open={executivoVersionsOpen}
          onOpenChange={setExecutivoVersionsOpen}
        />
      )}
      {isMobilizacaoStage && (
        <TeamMemberEditModal
          open={teamEditModalOpen}
          onOpenChange={setTeamEditModalOpen}
          member={editingMember}
          onSave={handleSaveTeamMember}
          onUploadPhoto={handleUploadTeamPhoto}
          isSaving={isAdding || isUpdating}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}
