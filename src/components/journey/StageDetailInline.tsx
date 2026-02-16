import { useState } from 'react';
import {
  Edit2, Check, X, CheckCircle2, ChevronDown, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
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
import { StageSummary } from './StageSummary';
import { StageDetailsSections } from './StageDetailsSections';
import { StageChecklist } from './StageChecklist';
import { StageDatesPanel } from './StageDatesPanel';
import { MeetingCTA } from './MeetingCTA';
import { StageRegistry } from './StageRegistry';
import { BriefingStageLayout } from './briefing/BriefingStageLayout';

interface StageDetailInlineProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
  nextStageName?: string | null;
}

export function StageDetailInline({
  stage,
  projectId,
  isAdmin,
  nextStageName,
}: StageDetailInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const completeStage = useCompleteStage();

  const canComplete = isAdmin && stage.status !== 'completed' && stage.status !== 'pending';

  // Detect briefing stage by name pattern
  const isBriefingStage = stage.name.toLowerCase().includes('briefing');

  if (isBriefingStage && !isEditing) {
    return (
      <div className="space-y-6">
        <BriefingStageLayout stage={stage} projectId={projectId} isAdmin={isAdmin} />

        {/* Admin footer actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAdmin && (
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
                    completeStage.mutate({ stageId: stage.id, projectId });
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
