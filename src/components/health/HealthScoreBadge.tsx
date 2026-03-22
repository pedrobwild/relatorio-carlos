import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { computeHealthScore, type HealthScore, type HealthLevel } from '@/lib/healthScore';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

const levelColors: Record<HealthLevel, { ring: string; text: string; bg: string; fill: string }> = {
  excellent: {
    ring: 'stroke-[hsl(var(--success))]',
    text: 'text-[hsl(var(--success))]',
    bg: 'bg-[hsl(var(--success-light))]',
    fill: 'hsl(var(--success))',
  },
  good: {
    ring: 'stroke-primary',
    text: 'text-primary',
    bg: 'bg-primary/10',
    fill: 'hsl(var(--primary))',
  },
  attention: {
    ring: 'stroke-[hsl(var(--warning))]',
    text: 'text-[hsl(var(--warning))]',
    bg: 'bg-[hsl(var(--warning-light))]',
    fill: 'hsl(var(--warning))',
  },
  critical: {
    ring: 'stroke-destructive',
    text: 'text-destructive',
    bg: 'bg-destructive/10',
    fill: 'hsl(var(--destructive))',
  },
};

function ScoreRing({ score, level, size = 40 }: { score: number; level: HealthLevel; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = levelColors[level];

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-muted"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={colors.ring}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
    </svg>
  );
}

function getScoreLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

interface HealthScoreBadgeProps {
  project: ProjectSummary;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function HealthScoreBadge({ project, size = 'sm', showLabel = false }: HealthScoreBadgeProps) {
  const health = useMemo(() => computeHealthScore(project), [project]);
  const colors = levelColors[health.level];
  const ringSize = size === 'sm' ? 36 : 48;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2 cursor-default', showLabel && 'gap-2.5')}>
            <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
              <ScoreRing score={health.score} level={health.level} size={ringSize} />
              <span className={cn(
                'absolute font-bold',
                colors.text,
                size === 'sm' ? 'text-[10px]' : 'text-xs'
              )}>
                {health.score}
              </span>
            </div>
            {showLabel && (
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold', colors.text)}>{health.label}</p>
                <p className="text-[10px] text-muted-foreground">Health Score</p>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64 p-0">
          <HealthBreakdownTooltip health={health} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HealthBreakdownTooltip({ health }: { health: HealthScore }) {
  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Health Score</span>
        <span className={cn('text-sm font-bold', levelColors[health.level].text)}>
          {health.score}/100
        </span>
      </div>
      <div className="space-y-1.5">
        {health.breakdowns.map((b) => (
          <div key={b.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {b.label} <span className="text-[10px]">({Math.round(b.weight * 100)}%)</span>
              </span>
              <span className="font-medium text-foreground">{b.score}</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${b.score}%`,
                  backgroundColor: levelColors[getScoreLevel(b.score)].fill,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/70">{b.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
