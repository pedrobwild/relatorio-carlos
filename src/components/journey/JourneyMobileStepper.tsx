import { useRef, useEffect, useCallback } from 'react';
import { Check, ChevronRight, Circle, Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JourneyStage, JourneyStageStatus } from '@/hooks/useProjectJourney';
import { journeyCopy } from '@/constants/journeyCopy';

/* ─── Visual state (shared logic with JourneyTimeline) ─── */

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
  activeDotBg: string;
}> = {
  completed: {
    Icon: Check,
    dotBg: 'bg-[hsl(var(--success))]',
    iconColor: 'text-success-foreground',
    labelColor: 'text-[hsl(var(--success))]',
    activeDotBg: 'bg-[hsl(var(--success))]',
  },
  current: {
    Icon: ChevronRight,
    dotBg: 'bg-primary',
    iconColor: 'text-primary-foreground',
    labelColor: 'text-primary',
    activeDotBg: 'bg-primary',
  },
  validating: {
    Icon: Eye,
    dotBg: 'bg-[hsl(var(--warning))]',
    iconColor: 'text-[hsl(var(--warning-foreground))]',
    labelColor: 'text-[hsl(var(--warning))]',
    activeDotBg: 'bg-[hsl(var(--warning))]',
  },
  next: {
    Icon: Circle,
    dotBg: 'bg-accent',
    iconColor: 'text-primary',
    labelColor: 'text-accent-foreground',
    activeDotBg: 'bg-primary',
  },
  blocked: {
    Icon: Lock,
    dotBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    labelColor: 'text-muted-foreground',
    activeDotBg: 'bg-muted-foreground',
  },
  future: {
    Icon: Circle,
    dotBg: 'bg-muted',
    iconColor: 'text-muted-foreground/50',
    labelColor: 'text-muted-foreground',
    activeDotBg: 'bg-muted-foreground',
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active stage into view
  const scrollToActive = useCallback(() => {
    if (!scrollRef.current || !activeStageId) return;
    const activeEl = scrollRef.current.querySelector(
      `[data-stage-id="${activeStageId}"]`,
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeStageId]);

  useEffect(() => {
    scrollToActive();
  }, [scrollToActive]);

  return (
    <div className="lg:hidden">
      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex items-start gap-0 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 -mx-4 pb-2"
        role="tablist"
        aria-label={journeyCopy.a11y.stagesNav}
      >
        {stages.map((stage, index) => {
          const vs = deriveVisualState(stage, index, stages);
          const cfg = vsConfig[vs];
          const Icon = cfg.Icon;
          const isActive = stage.id === activeStageId;
          const isLast = index === stages.length - 1;

          return (
            <div
              key={stage.id}
              data-stage-id={stage.id}
              className="flex items-start snap-center shrink-0"
            >
              {/* Step item */}
              <button
                role="tab"
                aria-selected={isActive}
                onClick={() => onStageClick(stage.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 px-2 py-1 min-w-[72px] max-w-[80px] rounded-lg transition-all',
                  'focus-visible:outline-2 focus-visible:outline-primary',
                  'active:scale-95',
                  isActive && 'bg-primary/5',
                )}
              >
                {/* Dot with icon */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0',
                    cfg.dotBg,
                    isActive && 'ring-2 ring-offset-2 ring-offset-background ring-primary/30 scale-110',
                  )}
                >
                  <Icon
                    className={cn('h-3.5 w-3.5', cfg.iconColor)}
                    strokeWidth={vs === 'completed' ? 3 : 2}
                  />
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] leading-tight text-center font-medium line-clamp-2',
                    isActive ? 'text-foreground font-semibold' : cfg.labelColor,
                  )}
                >
                  {stage.name}
                </span>
              </button>

              {/* Connector line between steps */}
              {!isLast && (
                <div className="flex items-center pt-4 -mx-0.5">
                  <div
                    className={cn(
                      'h-0.5 w-4 shrink-0',
                      vs === 'completed' ? 'bg-[hsl(var(--success)/0.5)]' : 'bg-border',
                    )}
                    aria-hidden
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
