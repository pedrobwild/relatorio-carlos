import { useState } from 'react';
import {
  Edit2, Check, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  JourneyStage,
  JourneyStageStatus,
  useUpdateStage,
} from '@/hooks/useProjectJourney';
import { StageSummary } from './StageSummary';
import { StageDetailsSections } from './StageDetailsSections';
import { StageChecklist } from './StageChecklist';
import { StageDatesPanel } from './StageDatesPanel';
import { MeetingScheduler } from './MeetingScheduler';

interface JourneyStageCardProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function JourneyStageCard({
  stage,
  projectId,
  isAdmin,
  isExpanded,
  onToggleExpand,
}: JourneyStageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
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
    setIsEditing(false);
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stage.status === 'waiting_action' && "ring-2 ring-amber-400/50",
        stage.status === 'completed' && "opacity-75"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6">
            <div className="flex items-center gap-1 md:gap-2">
              <div className="flex-1 min-w-0">
                <StageSummary stage={stage} isExpanded={isExpanded} />
              </div>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-5 md:space-y-6 pt-0 px-4 pb-4 md:px-6 md:pb-6">
            {/* Admin Edit Form */}
            {isEditing && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">Editar Etapa</span>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} className="h-10 w-10">
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={handleSave} disabled={updateStage.isPending} className="h-10 w-10">
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Nome</label>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <Select
                      value={editData.status}
                      onValueChange={(v) => setEditData({ ...editData, status: v as JourneyStageStatus })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Em breve</SelectItem>
                        <SelectItem value="waiting_action">Aguardando ação</SelectItem>
                        <SelectItem value="in_progress">Em andamento</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Descrição</label>
                  <Textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Texto do CTA</label>
                    <Input
                      value={editData.cta_text}
                      onChange={(e) => setEditData({ ...editData, cta_text: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Responsável</label>
                    <Input
                      value={editData.responsible}
                      onChange={(e) => setEditData({ ...editData, responsible: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Microcopy</label>
                  <Input
                    value={editData.microcopy}
                    onChange={(e) => setEditData({ ...editData, microcopy: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Aviso (warning)</label>
                  <Input
                    value={editData.warning_text}
                    onChange={(e) => setEditData({ ...editData, warning_text: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Dependências</label>
                  <Textarea
                    value={editData.dependencies_text}
                    onChange={(e) => setEditData({ ...editData, dependencies_text: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Revisões</label>
                  <Input
                    value={editData.revision_text}
                    onChange={(e) => setEditData({ ...editData, revision_text: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Details (description, warning, dependencies, revision) */}
            {!isEditing && <StageDetailsSections stage={stage} />}

            {/* Dates Panel */}
            <StageDatesPanel
              stageId={stage.id}
              projectId={projectId}
              dates={{
                proposed_start: stage.proposed_start,
                proposed_end: stage.proposed_end,
                confirmed_start: stage.confirmed_start,
                confirmed_end: stage.confirmed_end,
              }}
              isAdmin={isAdmin}
              stageName={stage.name}
            />

            {/* Checklists */}
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

            {/* CTA */}
            {stage.cta_visible && stage.cta_text && stage.cta_text.toLowerCase().includes('reunião') ? (
              <div className="pt-2 space-y-2">
                <MeetingScheduler
                  stageId={stage.id}
                  stageName={stage.name}
                  projectId={projectId}
                  isAdmin={isAdmin}
                  ctaText={stage.cta_text}
                />
                {stage.microcopy && (
                  <p className="text-xs text-muted-foreground">{stage.microcopy}</p>
                )}
              </div>
            ) : stage.cta_visible && stage.cta_text ? (
              <div className="pt-2 space-y-2">
                <Button className="w-full md:w-auto min-h-[44px]">
                  {stage.cta_text}
                </Button>
                {stage.microcopy && (
                  <p className="text-xs text-muted-foreground">{stage.microcopy}</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
