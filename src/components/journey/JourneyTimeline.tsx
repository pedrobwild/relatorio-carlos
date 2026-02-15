import { Check, Clock, Circle, Lock, Eye, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JourneyStage, JourneyStageStatus } from '@/hooks/useProjectJourney';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface JourneyTimelineProps {
  stages: JourneyStage[];
  activeStageId: string | null;
  onStageClick: (stageId: string) => void;
}

/**
 * Derive a visual display state from the DB status + position in the list.
 * No business logic changes — purely presentational mapping.
 */
type VisualState = 'completed' | 'current' | 'next' | 'blocked' | 'validating' | 'future';

function deriveVisualState(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): VisualState {
  if (stage.status === 'completed') return 'completed';
  if (stage.status === 'in_progress') return 'current';
  if (stage.status === 'waiting_action') return 'validating';

  // "pending" — decide between "next", "blocked", or "future"
  if (stage.status === 'pending') {
    // If it has explicit dependency text, it's blocked
    if (stage.dependencies_text) return 'blocked';

    // First pending after the last non-pending is "next"
    const lastNonPendingIdx = stages.reduce(
      (acc, s, i) => (s.status !== 'pending' ? i : acc),
      -1,
    );
    if (index === lastNonPendingIdx + 1) return 'next';

    // Otherwise it depends on an earlier stage
    if (index > 0 && stages[index - 1].status === 'pending') return 'blocked';

    return 'future';
  }

  return 'future';
}

const visualConfig: Record<
  VisualState,
  {
    icon: React.ElementType;
    label: string;
    iconColor: string;
    bgColor: string;
    ringColor: string;
    lineColor: string;
  }
> = {
  completed: {
    icon: Check,
    label: 'Concluída',
    iconColor: 'text-success-foreground',
    bgColor: 'bg-[hsl(var(--success))]',
    ringColor: '',
    lineColor: 'bg-[hsl(var(--success))]',
  },
  current: {
    icon: ChevronRight,
    label: 'Etapa atual',
    iconColor: 'text-primary-foreground',
    bgColor: 'bg-primary',
    ringColor: 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
    lineColor: 'bg-primary/40',
  },
  validating: {
    icon: Eye,
    label: 'Em validação',
    iconColor: 'text-[hsl(var(--warning-foreground))]',
    bgColor: 'bg-[hsl(var(--warning))]',
    ringColor: 'ring-2 ring-[hsl(var(--warning)/0.3)] ring-offset-2 ring-offset-background',
    lineColor: 'bg-[hsl(var(--warning)/0.4)]',
  },
  next: {
    icon: Circle,
    label: 'Próxima',
    iconColor: 'text-primary',
    bgColor: 'bg-accent',
    ringColor: '',
    lineColor: 'bg-border',
  },
  blocked: {
    icon: Lock,
    label: 'Bloqueada',
    iconColor: 'text-muted-foreground',
    bgColor: 'bg-muted',
    ringColor: '',
    lineColor: 'bg-border',
  },
  future: {
    icon: Circle,
    label: 'Em breve',
    iconColor: 'text-muted-foreground/50',
    bgColor: 'bg-muted',
    ringColor: '',
    lineColor: 'bg-border',
  },
};

function getBlockedByName(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): string | null {
  if (stage.dependencies_text) return stage.dependencies_text;
  // Infer from previous pending stage
  if (index > 0 && stages[index - 1].status !== 'completed') {
    return stages[index - 1].name;
  }
  return null;
}

/* ───────────── Component ───────────── */

export function JourneyTimeline({ stages, activeStageId, onStageClick }: JourneyTimelineProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <nav aria-label="Etapas da jornada" className="relative">
        {/* Vertical connector line (desktop) */}
        <div
          className="absolute left-[19px] lg:left-[15px] top-5 bottom-5 w-0.5 bg-border hidden lg:block"
          aria-hidden
        />

        <ol className="space-y-1 list-none p-0 m-0">
          {stages.map((stage, index) => {
            const vs = deriveVisualState(stage, index, stages);
            const config = visualConfig[vs];
            const Icon = config.icon;
            const isActive = stage.id === activeStageId;
            const isBlocked = vs === 'blocked';
            const blockedBy = isBlocked ? getBlockedByName(stage, index, stages) : null;
            const isCompleted = vs === 'completed';
            const isCurrent = vs === 'current' || vs === 'validating';

            const buttonContent = (
              <button
                onClick={() => onStageClick(stage.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'relative flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all',
                  'hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary',
                  'min-h-[56px]',
                  isActive && 'bg-primary/5 ring-1 ring-primary/20',
                )}
              >
                {/* Status circle */}
                <div
                  className={cn(
                    'relative z-10 flex items-center justify-center w-10 h-10 lg:w-8 lg:h-8 rounded-full shrink-0 transition-all',
                    config.bgColor,
                    config.ringColor,
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 lg:h-3.5 lg:w-3.5',
                      config.iconColor,
                    )}
                    strokeWidth={vs === 'completed' ? 3 : 2}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'block font-medium text-sm truncate',
                      isCompleted && 'text-muted-foreground line-through decoration-1',
                      isCurrent && 'text-foreground font-semibold',
                      isBlocked && 'text-muted-foreground',
                    )}
                  >
                    {stage.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      vs === 'current' && 'text-primary font-medium',
                      vs === 'validating' && 'text-[hsl(var(--warning))] font-medium',
                      vs === 'completed' && 'text-[hsl(var(--success))]',
                      vs === 'next' && 'text-accent-foreground',
                      (vs === 'blocked' || vs === 'future') && 'text-muted-foreground',
                    )}
                  >
                    {config.label}
                    {isBlocked && blockedBy && (
                      <span className="lg:hidden ml-1 text-muted-foreground">
                        · {blockedBy}
                      </span>
                    )}
                  </span>
                </div>
              </button>
            );

            // Wrap blocked items with tooltip on desktop
            if (isBlocked && blockedBy) {
              return (
                <li key={stage.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                      <p className="text-xs">
                        <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />
                        Depende de: <strong>{blockedBy}</strong>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return <li key={stage.id}>{buttonContent}</li>;
          })}
        </ol>
      </nav>
    </TooltipProvider>
  );
}
