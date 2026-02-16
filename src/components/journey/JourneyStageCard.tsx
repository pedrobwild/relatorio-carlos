import { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit2, Check, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { journeyCopy } from '@/constants/journeyCopy';
import {
  JourneyStage,
  JourneyStageStatus,
  useUpdateStage,
} from '@/hooks/useProjectJourney';
import { StageSummary } from './StageSummary';
import { StageDetailsSections } from './StageDetailsSections';
import { StageChecklist } from './StageChecklist';
import { StageDatesPanel } from './StageDatesPanel';
import { MeetingCTA } from './MeetingCTA';
import { StageRegistry } from './StageRegistry';

interface JourneyStageCardProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const contentVariants = {
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

export const JourneyStageCard = forwardRef<HTMLDivElement, JourneyStageCardProps>(
  function JourneyStageCard(
    { stage, projectId, isAdmin, isExpanded, onToggleExpand },
    ref,
  ) {
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

    const showMobileSticky =
      stage.status === 'waiting_action' &&
      stage.cta_visible &&
      stage.cta_text;

    return (
      <Card
        ref={ref}
        data-stage-id={stage.id}
        className={cn(
          "transition-shadow duration-200",
          stage.status === 'waiting_action' && "ring-2 ring-[hsl(var(--warning)/0.4)]",
          stage.status === 'completed' && "opacity-75"
        )}
      >
        {/* Header — always visible */}
        <CardHeader
          className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
          onClick={onToggleExpand}
          role="button"
          aria-expanded={isExpanded}
          aria-label={journeyCopy.a11y.open_stage.replace('{stageName}', stage.name)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleExpand();
            }
          }}
        >
          <div className="flex items-center gap-1 md:gap-2">
            <div className="flex-1 min-w-0">
              <StageSummary stage={stage} isExpanded={isExpanded} />
            </div>
            {isAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                aria-label={journeyCopy.a11y.editStage}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Animated content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="content"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="exit"
            >
              <CardContent className="space-y-5 md:space-y-6 pt-0 px-4 pb-4 md:px-6 md:pb-6">
                {/* Admin Edit Form */}
                {isEditing && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border" role="form" aria-label={journeyCopy.admin.editStage}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{journeyCopy.admin.editStage}</span>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} className="h-11 w-11" aria-label={journeyCopy.a11y.cancelEdit}>
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
                        <Input
                          id={`stage-name-${stage.id}`}
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground" htmlFor={`stage-status-${stage.id}`}>{journeyCopy.admin.fields.status}</label>
                        <Select
                          value={editData.status}
                          onValueChange={(v) => setEditData({ ...editData, status: v as JourneyStageStatus })}
                        >
                          <SelectTrigger className="h-11" id={`stage-status-${stage.id}`}>
                            <SelectValue />
                          </SelectTrigger>
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
                      <Textarea
                        id={`stage-desc-${stage.id}`}
                        value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        rows={4}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm text-muted-foreground" htmlFor={`stage-cta-${stage.id}`}>{journeyCopy.admin.fields.ctaText}</label>
                        <Input
                          id={`stage-cta-${stage.id}`}
                          value={editData.cta_text}
                          onChange={(e) => setEditData({ ...editData, cta_text: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground" htmlFor={`stage-resp-${stage.id}`}>{journeyCopy.admin.fields.responsible}</label>
                        <Input
                          id={`stage-resp-${stage.id}`}
                          value={editData.responsible}
                          onChange={(e) => setEditData({ ...editData, responsible: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground" htmlFor={`stage-micro-${stage.id}`}>{journeyCopy.admin.fields.microcopy}</label>
                      <Input
                        id={`stage-micro-${stage.id}`}
                        value={editData.microcopy}
                        onChange={(e) => setEditData({ ...editData, microcopy: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground" htmlFor={`stage-warn-${stage.id}`}>{journeyCopy.admin.fields.warning}</label>
                      <Input
                        id={`stage-warn-${stage.id}`}
                        value={editData.warning_text}
                        onChange={(e) => setEditData({ ...editData, warning_text: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground" htmlFor={`stage-deps-${stage.id}`}>{journeyCopy.admin.fields.dependencies}</label>
                      <Textarea
                        id={`stage-deps-${stage.id}`}
                        value={editData.dependencies_text}
                        onChange={(e) => setEditData({ ...editData, dependencies_text: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground" htmlFor={`stage-rev-${stage.id}`}>{journeyCopy.admin.fields.revisions}</label>
                      <Input
                        id={`stage-rev-${stage.id}`}
                        value={editData.revision_text}
                        onChange={(e) => setEditData({ ...editData, revision_text: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Details */}
                {!isEditing && <StageDetailsSections stage={stage} />}

                {/* Dates Panel */}
                <StageDatesPanel
                  stageId={stage.id}
                  projectId={projectId}
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

                {/* Stage Registry (Decisions, Conversations, History) */}
                <StageRegistry
                  stageId={stage.id}
                  projectId={projectId}
                  isAdmin={isAdmin}
                />

                {/* CTA */}
                {stage.cta_visible && stage.cta_text && stage.cta_text.toLowerCase().includes('reunião') ? (
                  <div className="pt-2 space-y-2">
                    <MeetingCTA
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile sticky CTA for waiting_action */}
        {!isExpanded && showMobileSticky && (
          <div className="md:hidden border-t border-border/40 px-4 py-3 bg-[hsl(var(--warning-light))]">
            <Button
              className="w-full min-h-[44px] gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              ⚡ {stage.cta_text}
            </Button>
          </div>
        )}
      </Card>
    );
  },
);
