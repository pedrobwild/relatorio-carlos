/**
 * Inline Health Score breakdown — mini-bars for each dimension.
 * Used in project cards and list rows to give quick visual context.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { computeHealthScore, type HealthLevel } from '@/lib/healthScore';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

const levelFills: Record<HealthLevel, string> = {
  excellent: 'bg-[hsl(var(--success))]',
  good: 'bg-primary',
  attention: 'bg-[hsl(var(--warning))]',
  critical: 'bg-destructive',
};

function getBarLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

interface HealthScoreBreakdownProps {
  project: ProjectSummary;
  className?: string;
}

export function HealthScoreBreakdown({ project, className }: HealthScoreBreakdownProps) {
  const health = useMemo(() => computeHealthScore(project), [project]);

  return (
    <div className={cn('space-y-1', className)}>
      {health.breakdowns.map((b) => {
        const barLevel = getBarLevel(b.score);
        return (
          <div key={b.label} className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground w-[52px] truncate shrink-0">
              {b.label}
            </span>
            <div className="flex-1 h-1 bg-muted/50 rounded-full overflow-hidden min-w-[32px]">
              <div
                className={cn('h-full rounded-full transition-all', levelFills[barLevel])}
                style={{ width: `${Math.min(b.score, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
