import { useMemo } from 'react';
import { Check, ChevronRight, Circle, Lock, Eye, ArrowRight, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JourneyStage } from '@/hooks/useProjectJourney';
import { journeyCopy } from '@/constants/journeyCopy';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

/* ─── Visual state (shared with timeline) ─── */

type VisualState = 'completed' | 'current' | 'next' | 'blocked' | 'validating' | 'future';

function deriveVisualState(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): VisualState {
  if (stage.status === 'completed') return 'completed';
  if (stage.status === 'in_progress') return 'current';
  if (stage.status === 'waiting_action') return 'validating';
  if (stage.status === 'pending') {
    if (stage.dependencies_text) return 'blocked';
    const lastNonPendingIdx = stages.reduce(
      (acc, s, i) => (s.status !== 'pending' ? i : acc),
      -1,
    );
    if (index === lastNonPendingIdx + 1) return 'next';
    if (index > 0 && stages[index - 1].status === 'pending') return 'blocked';
    return 'future';
  }
  return 'future';
}

const vsIconMap: Record<VisualState, React.ElementType> = {
  completed: Check,
  current: ChevronRight,
  validating: Eye,
  next: Circle,
  blocked: Lock,
  future: Circle,
};

const vsDotBg: Record<VisualState, string> = {
  completed: 'bg-[hsl(var(--success))]',
  current: 'bg-primary',
  validating: 'bg-[hsl(var(--warning))]',
  next: 'bg-accent',
  blocked: 'bg-muted',
  future: 'bg-muted',
};

const vsIconColor: Record<VisualState, string> = {
  completed: 'text-success-foreground',
  current: 'text-primary-foreground',
  validating: 'text-[hsl(var(--warning-foreground))]',
  next: 'text-primary',
  blocked: 'text-muted-foreground',
  future: 'text-muted-foreground/50',
};

/* ─── Component ─── */

interface JourneyStepperCompactProps {
  stages: JourneyStage[];
  activeStageId: string | null;
  onOpenTimeline: () => void;
  onStageClick: (stageId: string) => void;
}

export function JourneyStepperCompact({
  stages,
  activeStageId,
  onOpenTimeline,
  onStageClick,
}: JourneyStepperCompactProps) {
  const { currentStage, currentIndex, nextStage } = useMemo(() => {
    let curr: JourneyStage | null = null;
    let currIdx = 0;
    let nxt: JourneyStage | null = null;

    for (let i = 0; i < stages.length; i++) {
      if (!curr && (stages[i].status === 'waiting_action' || stages[i].status === 'in_progress')) {
        curr = stages[i];
        currIdx = i;
        nxt = stages[i + 1] || null;
      }
    }
    if (!curr && stages.length > 0) {
      const idx = stages.findIndex(s => s.status !== 'completed');
      if (idx >= 0) {
        curr = stages[idx];
        currIdx = idx;
        nxt = stages[idx + 1] || null;
      } else {
        curr = stages[stages.length - 1];
        currIdx = stages.length - 1;
      }
    }
    return { currentStage: curr, currentIndex: currIdx, nextStage: nxt };
  }, [stages]);

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const progressPct = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  if (!currentStage) return null;

  const vs = deriveVisualState(currentStage, currentIndex, stages);
  const Icon = vsIconMap[vs];

  return (
    <div className="lg:hidden space-y-3">
      {/* Progress block */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Current stage label */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
              vsDotBg[vs],
              (vs === 'current' || vs === 'validating') && 'ring-2 ring-primary/20 ring-offset-2 ring-offset-background',
            )}>
              <Icon className={cn('h-4 w-4', vsIconColor[vs])} strokeWidth={vs === 'completed' ? 3 : 2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Etapa atual</p>
              <p className="text-base font-semibold truncate">{currentStage.name}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progresso</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {completedCount}/{stages.length}
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          {/* CTA: Ver linha do tempo */}
          <Button
            variant="outline"
            className="w-full min-h-[44px] gap-2 text-sm font-medium"
            onClick={onOpenTimeline}
            aria-label={journeyCopy.a11y.stagesNav}
          >
            <List className="h-4 w-4" />
            Ver linha do tempo
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
