import { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Circle, Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JourneyStage } from '@/hooks/useProjectJourney';
import { journeyCopy } from '@/constants/journeyCopy';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

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
}> = {
  completed: {
    Icon: Check,
    dotBg: 'bg-[hsl(var(--success))]',
    iconColor: 'text-success-foreground',
    labelColor: 'text-[hsl(var(--success))]',
  },
  current: {
    Icon: ChevronRight,
    dotBg: 'bg-primary',
    iconColor: 'text-primary-foreground',
    labelColor: 'text-primary',
  },
  validating: {
    Icon: Eye,
    dotBg: 'bg-[hsl(var(--warning))]',
    iconColor: 'text-[hsl(var(--warning-foreground))]',
    labelColor: 'text-[hsl(var(--warning))]',
  },
  next: {
    Icon: Circle,
    dotBg: 'bg-accent',
    iconColor: 'text-primary',
    labelColor: 'text-accent-foreground',
  },
  blocked: {
    Icon: Lock,
    dotBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    labelColor: 'text-muted-foreground',
  },
  future: {
    Icon: Circle,
    dotBg: 'bg-muted',
    iconColor: 'text-muted-foreground/50',
    labelColor: 'text-muted-foreground',
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

  // Derive current & next stages for the compact trigger
  const { currentStage, nextStage, activeIndex } = useMemo(() => {
    let curr: JourneyStage | null = null;
    let nxt: JourneyStage | null = null;
    let aIdx = -1;

    for (let i = 0; i < stages.length; i++) {
      if (stages[i].id === activeStageId) aIdx = i;
      if (!curr && (stages[i].status === 'waiting_action' || stages[i].status === 'in_progress')) {
        curr = stages[i];
        nxt = stages[i + 1] || null;
      }
    }
    if (!curr && stages.length > 0) {
      // fallback: first non-completed
      const idx = stages.findIndex(s => s.status !== 'completed');
      if (idx >= 0) {
        curr = stages[idx];
        nxt = stages[idx + 1] || null;
      } else {
        curr = stages[stages.length - 1];
      }
    }
    return { currentStage: curr, nextStage: nxt, activeIndex: aIdx };
  }, [stages, activeStageId]);

  const completedCount = stages.filter(s => s.status === 'completed').length;

  return (
    <div className="lg:hidden">
      {/* Compact trigger */}
      <Button
        variant="outline"
        className="w-full justify-between min-h-[48px] px-3 gap-2"
        onClick={() => setOpen(true)}
        aria-label={journeyCopy.a11y.stagesNav}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {currentStage && (() => {
            const idx = stages.indexOf(currentStage);
            const vs = deriveVisualState(currentStage, idx, stages);
            const cfg = vsConfig[vs];
            const Icon = cfg.Icon;
            return (
              <>
                <div className={cn('flex items-center justify-center w-7 h-7 rounded-full shrink-0', cfg.dotBg)}>
                  <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} strokeWidth={vs === 'completed' ? 3 : 2} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{currentStage.name}</p>
                  {nextStage && (
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      Próxima: {nextStage.name}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {completedCount}/{stages.length}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </Button>

      {/* Full stages sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="px-4 pt-4 pb-[env(safe-area-inset-bottom)] max-h-[75vh]">
          <SheetHeader className="text-left pb-3">
            <SheetTitle className="text-base">{journeyCopy.page.sidebarTitle}</SheetTitle>
            <SheetDescription className="text-xs">
              {completedCount} de {stages.length} etapas concluídas
            </SheetDescription>
          </SheetHeader>
          <nav className="space-y-1 overflow-y-auto" role="tablist" aria-label={journeyCopy.a11y.stagesNav}>
            {stages.map((stage, index) => {
              const vs = deriveVisualState(stage, index, stages);
              const cfg = vsConfig[vs];
              const Icon = cfg.Icon;
              const isActive = stage.id === activeStageId;

              return (
                <button
                  key={stage.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    onStageClick(stage.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left transition-colors min-h-[48px]',
                    'focus-visible:outline-2 focus-visible:outline-primary',
                    'active:bg-muted/60',
                    isActive ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/40',
                  )}
                >
                  <div className={cn('flex items-center justify-center w-7 h-7 rounded-full shrink-0', cfg.dotBg)}>
                    <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} strokeWidth={vs === 'completed' ? 3 : 2} />
                  </div>
                  <span className={cn(
                    'text-sm flex-1 truncate',
                    isActive ? 'font-semibold text-foreground' : cfg.labelColor,
                  )}>
                    {stage.name}
                  </span>
                  {isActive && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
