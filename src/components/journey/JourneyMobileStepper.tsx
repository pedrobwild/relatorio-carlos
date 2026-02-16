import { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Circle, Lock, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { JourneyStage } from '@/hooks/useProjectJourney';
import { journeyCopy } from '@/constants/journeyCopy';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

/* ─── Visual state ─── */

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

const vsConfig: Record<VisualState, {
  Icon: React.ElementType;
  dotBg: string;
  iconColor: string;
  labelColor: string;
  label: string;
  lineColor: string;
}> = {
  completed: {
    Icon: Check,
    dotBg: 'bg-[hsl(var(--success))]',
    iconColor: 'text-success-foreground',
    labelColor: 'text-[hsl(var(--success))]',
    label: journeyCopy.status.completed.label,
    lineColor: 'bg-[hsl(var(--success))]',
  },
  current: {
    Icon: ChevronRight,
    dotBg: 'bg-primary',
    iconColor: 'text-primary-foreground',
    labelColor: 'text-primary',
    label: journeyCopy.status.current.label,
    lineColor: 'bg-primary/40',
  },
  validating: {
    Icon: Eye,
    dotBg: 'bg-[hsl(var(--warning))]',
    iconColor: 'text-[hsl(var(--warning-foreground))]',
    labelColor: 'text-[hsl(var(--warning))]',
    label: journeyCopy.status.in_review.label,
    lineColor: 'bg-[hsl(var(--warning)/0.4)]',
  },
  next: {
    Icon: Circle,
    dotBg: 'bg-accent',
    iconColor: 'text-primary',
    labelColor: 'text-accent-foreground',
    label: journeyCopy.status.next.label,
    lineColor: 'bg-border',
  },
  blocked: {
    Icon: Lock,
    dotBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    labelColor: 'text-muted-foreground',
    label: journeyCopy.status.blocked.label,
    lineColor: 'bg-border',
  },
  future: {
    Icon: Circle,
    dotBg: 'bg-muted',
    iconColor: 'text-muted-foreground/50',
    labelColor: 'text-muted-foreground',
    label: journeyCopy.status.future.label,
    lineColor: 'bg-border',
  },
};

/* ─── Component ─── */

interface JourneyMobileStepperProps {
  stages: JourneyStage[];
  activeStageId: string | null;
  onStageClick: (stageId: string) => void;
}

export function JourneyMobileStepper({
  stages,
  activeStageId,
  onStageClick,
}: JourneyMobileStepperProps) {
  const [open, setOpen] = useState(false);

  const { currentStage, nextStage } = useMemo(() => {
    let curr: JourneyStage | null = null;
    let nxt: JourneyStage | null = null;

    for (let i = 0; i < stages.length; i++) {
      if (!curr && (stages[i].status === 'waiting_action' || stages[i].status === 'in_progress')) {
        curr = stages[i];
        nxt = stages[i + 1] || null;
      }
    }
    if (!curr && stages.length > 0) {
      const idx = stages.findIndex(s => s.status !== 'completed');
      if (idx >= 0) {
        curr = stages[idx];
        nxt = stages[idx + 1] || null;
      } else {
        curr = stages[stages.length - 1];
      }
    }
    return { currentStage: curr, nextStage: nxt };
  }, [stages]);

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const progressPct = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  return (
    <div className="lg:hidden">
      {/* Compact trigger with progress */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-between min-h-[52px] px-4 gap-2 border-border/60"
          onClick={() => setOpen(true)}
          aria-label={journeyCopy.a11y.stagesNav}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentStage && (() => {
              const idx = stages.indexOf(currentStage);
              const vs = deriveVisualState(currentStage, idx, stages);
              const cfg = vsConfig[vs];
              const Icon = cfg.Icon;
              return (
                <>
                  <div className={cn('flex items-center justify-center w-8 h-8 rounded-full shrink-0', cfg.dotBg)}>
                    <Icon className={cn('h-4 w-4', cfg.iconColor)} strokeWidth={vs === 'completed' ? 3 : 2} />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{currentStage.name}</p>
                    {nextStage && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        Próxima: {nextStage.name}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
              {completedCount}/{stages.length}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>

        {/* Mini progress bar below trigger */}
        <Progress value={progressPct} className="h-1" />
      </div>

      {/* Full stages sheet — mirrors desktop timeline */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="px-0 pt-4 pb-[env(safe-area-inset-bottom)] max-h-[80vh]">
          <SheetHeader className="text-left px-5 pb-3">
            <SheetTitle className="text-base">{journeyCopy.page.sidebarTitle}</SheetTitle>
            <SheetDescription className="text-xs">
              {completedCount} de {stages.length} etapas concluídas
            </SheetDescription>
          </SheetHeader>

          <nav className="overflow-y-auto px-2" role="tablist" aria-label={journeyCopy.a11y.stagesNav}>
            <ol className="space-y-0 list-none p-0 m-0 relative">
              {stages.map((stage, index) => {
                const vs = deriveVisualState(stage, index, stages);
                const cfg = vsConfig[vs];
                const Icon = cfg.Icon;
                const isActive = stage.id === activeStageId;
                const isLast = index === stages.length - 1;
                const isCompleted = vs === 'completed';

                const completionDate = isCompleted && stage.confirmed_end
                  ? format(parseISO(stage.confirmed_end), "dd MMM", { locale: ptBR })
                  : null;

                return (
                  <li key={stage.id} className="relative">
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className={cn(
                          'absolute left-[31px] w-0.5 top-[calc(50%+16px)] h-[calc(100%-4px)]',
                          cfg.lineColor,
                        )}
                        aria-hidden
                      />
                    )}

                    <button
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        onStageClick(stage.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'relative flex items-center gap-3 w-full px-3 py-3.5 rounded-lg text-left transition-all min-h-[52px]',
                        'focus-visible:outline-2 focus-visible:outline-primary',
                        'active:bg-muted/60',
                        isActive ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/40',
                      )}
                    >
                      <div className={cn(
                        'relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-all',
                        cfg.dotBg,
                        (vs === 'current' || vs === 'validating') && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                      )}>
                        <Icon className={cn('h-4 w-4', cfg.iconColor)} strokeWidth={vs === 'completed' ? 3 : 2} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          'block text-sm truncate',
                          isActive ? 'font-semibold text-foreground' : 'font-medium',
                          isCompleted && 'text-muted-foreground line-through decoration-1',
                          (vs === 'blocked' || vs === 'future') && 'text-muted-foreground',
                        )}>
                          {stage.name}
                        </span>
                        <span className={cn(
                          'text-xs flex items-center gap-1',
                          cfg.labelColor,
                        )}>
                          {cfg.label}
                          {isCompleted && completionDate && (
                            <span className="text-muted-foreground font-normal">· {completionDate}</span>
                          )}
                        </span>
                      </div>

                      {isActive && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
