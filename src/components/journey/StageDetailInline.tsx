import { useState } from 'react';
import {
  Edit2, Check, X, CheckCircle2, ChevronDown, Loader2, Info, Pencil, ImageIcon, Eye, FileText,
  Users, ArrowRight, Mail, Phone, Plus, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from '@/components/ui/alert-dialog';
import { journeyCopy } from '@/constants/journeyCopy';
import {
  JourneyStage,
  JourneyStageStatus,
  useUpdateStage,
  useCompleteStage,
} from '@/hooks/useProjectJourney';
import { useJourneyTeamMembers, JourneyTeamMember } from '@/hooks/useJourneyTeamMembers';
import { TeamMemberEditModal } from './TeamMemberEditModal';
import { StageSummary } from './StageSummary';
import { StageDetailsSections } from './StageDetailsSections';
import { StageChecklist } from './StageChecklist';
import { StageDatesPanel } from './StageDatesPanel';
import { MeetingCTA } from './MeetingCTA';
import { StageRegistry } from './StageRegistry';
import { BriefingStageLayout } from './briefing/BriefingStageLayout';
import { VersionsListModal } from '@/components/projeto3d/VersionsListModal';
import { ExecutivoVersionsModal } from '@/components/executivo/ExecutivoVersionsModal';
import { usePageInstructions } from '@/hooks/usePageInstructions';
import { useUserRole } from '@/hooks/useUserRole';
import { RichTextEditorModal } from '@/components/report/RichTextEditorModal';
import { STAGE_INSTRUCTIONS_DEFAULTS } from '@/constants/stageInstructionsTemplates';

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
  allStages = [],
}: StageDetailInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [instrEditorOpen, setInstrEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [executivoVersionsOpen, setExecutivoVersionsOpen] = useState(false);
  const [teamExpanded, setTeamExpanded] = useState(false);
  const [teamEditModalOpen, setTeamEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<JourneyTeamMember | null>(null);
  const completeStage = useCompleteStage();
  const { isStaff } = useUserRole();
  const { members, addMember, updateMember, removeMember, uploadPhoto, isAdding, isUpdating, isUploading } = useJourneyTeamMembers(projectId, 'mobilizacao');

  const handleSaveTeamMember = async (data: {
    display_name: string; role_title: string; description: string;
    email: string | null; phone: string | null; photo_url: string | null;
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
  const pageKey = stage.name.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const { instruction, save: saveInstruction } = usePageInstructions(projectId, pageKey);

  const defaultTemplate = STAGE_INSTRUCTIONS_DEFAULTS[pageKey] || '';

  const displayHtml = instruction?.content_html || defaultTemplate;
  const hasInstructions = !!displayHtml && displayHtml !== '<p><br></p>';

  const canComplete = isAdmin && stage.status !== 'completed' && stage.status !== 'pending';

  // Detect stage types by name pattern
  const isBriefingStage = stage.name.toLowerCase().includes('briefing');
  const isProjeto3DStage = stage.name.toLowerCase().includes('projeto 3d');
  const isProjetoExecutivoStage = stage.name.toLowerCase().includes('projeto executivo');
  const isMobilizacaoStage = stage.name.toLowerCase().includes('mobilização') || stage.name.toLowerCase().includes('mobilizacao');

  if (isBriefingStage) {
    return (
      <div className="space-y-6">
        {/* Admin Edit Form - shown above briefing layout */}
        {isEditing && (
          <AdminEditForm
            stage={stage}
            projectId={projectId}
            onClose={() => setIsEditing(false)}
          />
        )}

        {!isEditing && (
          <BriefingStageLayout stage={stage} projectId={projectId} isAdmin={isAdmin} onStageCompleted={onStageCompleted} />
        )}

        {/* Admin footer actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAdmin && !isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto"
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
                  className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto sm:ml-auto"
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
                    {nextStageName ? ` ("${nextStageName}")` : ''} será liberada automaticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="min-h-[44px]"
                    onClick={() => completeStage.mutate({ stageId: stage.id, projectId })}
                  >
                    Sim, concluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {stage.status === 'completed' && (
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-[hsl(var(--success))] font-medium sm:ml-auto py-2">
              <CheckCircle2 className="h-4 w-4" />
              Etapa concluída
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <StageSummary stage={stage} isExpanded={true} hideChevron />

      {/* Instructions Card */}
      {(hasInstructions || isStaff) && !isBriefingStage && (
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="pt-6 px-6 pb-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Instruções</h3>
                  {isStaff && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setInstrEditorOpen(true)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {hasInstructions ? (
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1 [&_li]:leading-relaxed [&_*]:!text-sm [&_strong]:text-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayHtml) }}
                  />
                ) : (
                  <button
                    onClick={() => setInstrEditorOpen(true)}
                    className="w-full py-6 text-sm text-muted-foreground hover:text-foreground border-2 border-dashed border-border rounded-lg transition-colors hover:border-primary/30"
                  >
                    Clique para adicionar instruções
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team section for Mobilização */}
      {isMobilizacaoStage && (
        <MobilizacaoTeamCard
          members={members}
          isAdmin={isAdmin}
          teamExpanded={teamExpanded}
          setTeamExpanded={setTeamExpanded}
          onAdd={() => { setEditingMember(null); setTeamEditModalOpen(true); }}
          onEdit={(m) => { setEditingMember(m); setTeamEditModalOpen(true); }}
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

      {/* ① CTA — first, above the fold */}
      {!isEditing && stage.cta_visible && stage.cta_text && (
        <div className="space-y-2">
          {stage.cta_text.toLowerCase().includes('reunião') ? (
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
            <p className="text-xs text-muted-foreground">{stage.microcopy}</p>
          )}
        </div>
      )}

      {/* ② Dates Panel — hidden for Projeto Executivo */}
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

      {/* ③ Checklists — hidden for Projeto Executivo */}
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

      {/* 3D Versions — only for Projeto 3D stage */}
      {isProjeto3DStage && (
        <>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Versões do Projeto 3D</h3>
                  <p className="text-xs text-muted-foreground">Imagens com comentários posicionáveis</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)} className="gap-1.5">
                <Eye className="h-4 w-4" />
                {isStaff ? 'Gerenciar' : 'Visualizar'}
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Executivo Versions — only for Projeto Executivo stage */}
      {isProjetoExecutivoStage && (
        <>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Versões do Projeto Executivo</h3>
                  <p className="text-xs text-muted-foreground">PDFs com comentários por página</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setExecutivoVersionsOpen(true)} className="gap-1.5">
                <Eye className="h-4 w-4" />
                {isStaff ? 'Gerenciar' : 'Visualizar'}
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* ④ Stage Registry — hidden for Projeto Executivo */}
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

      {/* ⑤ "Sobre esta etapa" — collapsible */}
      {!isEditing && stage.description && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between h-10 text-xs text-muted-foreground hover:text-foreground gap-2 px-3"
            >
              <span className="font-medium">Sobre esta etapa</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
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
            <Edit2 className="h-3.5 w-3.5" />
            Editar etapa
          </Button>
        )}

        {canComplete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto sm:ml-auto"
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
                  {nextStageName ? ` ("${nextStageName}")` : ''} será liberada automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-[44px]">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="min-h-[44px]"
                  onClick={() => {
                    completeStage.mutate(
                      { stageId: stage.id, projectId },
                      { onSuccess: () => onStageCompleted?.() },
                    );
                  }}
                >
                  Sim, concluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {stage.status === 'completed' && (
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-[hsl(var(--success))] font-medium sm:ml-auto py-2">
            <CheckCircle2 className="h-4 w-4" />
            Etapa concluída
          </div>
        )}
      </div>

      {/* Rich Text Editor Modal for Instructions */}
      {isStaff && (
        <RichTextEditorModal
          open={instrEditorOpen}
          onOpenChange={setInstrEditorOpen}
          value={displayHtml}
          onSave={saveInstruction}
          title={`Editar Instruções — ${stage.name}`}
        />
      )}

      {/* 3D Versions Modal */}
      {isProjeto3DStage && (
        <VersionsListModal
          projectId={projectId}
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
        />
      )}

      {/* Executivo Versions Modal */}
      {isProjetoExecutivoStage && (
        <ExecutivoVersionsModal
          projectId={projectId}
          open={executivoVersionsOpen}
          onOpenChange={setExecutivoVersionsOpen}
        />
      )}

      {/* Team Member Edit Modal for Mobilização */}
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

/* ─── Admin Edit Form ─── */


function AdminEditForm({
  stage,
  projectId,
  onClose,
}: {
  stage: JourneyStage;
  projectId: string;
  onClose: () => void;
}) {
  const [editData, setEditData] = useState({
    name: stage.name,
    description: stage.description || '',
    status: stage.status,
    cta_text: stage.cta_text || '',
    cta_visible: stage.cta_visible,
    microcopy: stage.microcopy || '',
    warning_text: stage.warning_text || '',
    dependencies_text: stage.dependencies_text || '',
    revision_text: stage.revision_text || '',
    responsible: stage.responsible || '',
  });

  const updateStage = useUpdateStage();

  const handleSave = () => {
    updateStage.mutate({
      stageId: stage.id,
      updates: {
        ...editData,
        description: editData.description || null,
        cta_text: editData.cta_text || null,
        microcopy: editData.microcopy || null,
        warning_text: editData.warning_text || null,
        dependencies_text: editData.dependencies_text || null,
        revision_text: editData.revision_text || null,
        responsible: editData.responsible || null,
      },
      projectId,
    });
    onClose();
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border" role="form" aria-label={journeyCopy.admin.editStage}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{journeyCopy.admin.editStage}</span>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={onClose} className="h-11 w-11" aria-label={journeyCopy.a11y.cancelEdit}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={handleSave} disabled={updateStage.isPending} className="h-11 w-11" aria-label={journeyCopy.a11y.saveEdit}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-muted-foreground" htmlFor={`stage-name-${stage.id}`}>{journeyCopy.admin.fields.name}</label>
          <Input id={`stage-name-${stage.id}`} value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground" htmlFor={`stage-status-${stage.id}`}>{journeyCopy.admin.fields.status}</label>
          <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v as JourneyStageStatus })}>
            <SelectTrigger className="h-11" id={`stage-status-${stage.id}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{journeyCopy.admin.statusOptions.pending}</SelectItem>
              <SelectItem value="waiting_action">{journeyCopy.admin.statusOptions.waiting_action}</SelectItem>
              <SelectItem value="in_progress">{journeyCopy.admin.statusOptions.in_progress}</SelectItem>
              <SelectItem value="completed">{journeyCopy.admin.statusOptions.completed}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground" htmlFor={`stage-desc-${stage.id}`}>{journeyCopy.admin.fields.description}</label>
        <Textarea id={`stage-desc-${stage.id}`} value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={4} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-muted-foreground" htmlFor={`stage-cta-${stage.id}`}>{journeyCopy.admin.fields.ctaText}</label>
          <Input id={`stage-cta-${stage.id}`} value={editData.cta_text} onChange={(e) => setEditData({ ...editData, cta_text: e.target.value })} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground" htmlFor={`stage-resp-${stage.id}`}>{journeyCopy.admin.fields.responsible}</label>
          <Input id={`stage-resp-${stage.id}`} value={editData.responsible} onChange={(e) => setEditData({ ...editData, responsible: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground" htmlFor={`stage-micro-${stage.id}`}>{journeyCopy.admin.fields.microcopy}</label>
        <Input id={`stage-micro-${stage.id}`} value={editData.microcopy} onChange={(e) => setEditData({ ...editData, microcopy: e.target.value })} />
      </div>
      <div>
        <label className="text-sm text-muted-foreground" htmlFor={`stage-warn-${stage.id}`}>{journeyCopy.admin.fields.warning}</label>
        <Input id={`stage-warn-${stage.id}`} value={editData.warning_text} onChange={(e) => setEditData({ ...editData, warning_text: e.target.value })} />
      </div>
      <div>
        <label className="text-sm text-muted-foreground" htmlFor={`stage-deps-${stage.id}`}>{journeyCopy.admin.fields.dependencies}</label>
        <Textarea id={`stage-deps-${stage.id}`} value={editData.dependencies_text} onChange={(e) => setEditData({ ...editData, dependencies_text: e.target.value })} rows={2} />
      </div>
      <div>
        <label className="text-sm text-muted-foreground" htmlFor={`stage-rev-${stage.id}`}>{journeyCopy.admin.fields.revisions}</label>
        <Input id={`stage-rev-${stage.id}`} value={editData.revision_text} onChange={(e) => setEditData({ ...editData, revision_text: e.target.value })} />
      </div>
    </div>
  );
}

/* ─── Mobilização Team Card ─── */

const teamContentVariants = {
  collapsed: { height: 0, opacity: 0, overflow: 'hidden' as const },
  expanded: {
    height: 'auto',
    opacity: 1,
    overflow: 'visible' as const,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: 'hidden' as const,
    transition: {
      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.15 },
    },
  },
};

function MobilizacaoTeamCard({
  members, isAdmin, teamExpanded, setTeamExpanded, onAdd, onEdit, onRemove,
}: {
  members: JourneyTeamMember[];
  isAdmin: boolean;
  teamExpanded: boolean;
  setTeamExpanded: (v: boolean) => void;
  onAdd: () => void;
  onEdit: (m: JourneyTeamMember) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
        onClick={() => setTeamExpanded(!teamExpanded)}
        role="button"
        aria-expanded={teamExpanded}
        aria-label="Equipe Bwild"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamExpanded(!teamExpanded); } }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shrink-0">
            <Users className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">Equipe Bwild</h3>
            <p className="text-xs text-primary font-medium">Conheça quem cuida do seu projeto</p>
          </div>
          <motion.div animate={{ rotate: teamExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {teamExpanded && (
          <motion.div key="team-content" variants={teamContentVariants} initial="collapsed" animate="expanded" exit="exit">
            <CardContent className="space-y-4 pt-0 px-4 pb-5 md:px-6 md:pb-6">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum membro cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <MobilizacaoTeamMemberCard
                      key={member.id}
                      member={member}
                      isAdmin={isAdmin}
                      onEdit={() => onEdit(member)}
                      onRemove={() => onRemove(member.id)}
                    />
                  ))}
                </div>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] gap-2"
                  onClick={(e) => { e.stopPropagation(); onAdd(); }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar membro do time
                </Button>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function MobilizacaoTeamMemberCard({
  member, isAdmin, onEdit, onRemove,
}: {
  member: JourneyTeamMember;
  isAdmin: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 relative">
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Editar">
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" aria-label="Remover">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
          <AvatarImage src={member.photo_url || undefined} alt={member.display_name} className="object-cover" />
          <AvatarFallback className="text-sm bg-primary/10">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <p className="font-semibold text-sm">{member.display_name}</p>
            <p className="text-xs text-primary font-medium">{member.role_title}</p>
          </div>
          {member.description && (
            <div
              className="text-xs text-muted-foreground leading-relaxed max-w-none [&_p]:m-0 [&_strong]:font-semibold [&_*]:!text-xs [&_*]:!font-[inherit] [&_span]:!text-inherit"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(member.description) }}
            />
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[32px]"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{member.email}</span>
              </a>
            )}
            {member.phone && (
              <a
                href={`tel:${member.phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[32px]"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {member.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
