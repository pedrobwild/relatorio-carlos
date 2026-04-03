import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { computeHealthScore, type HealthLevel } from '@/lib/healthScore';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';
import { HeartPulse } from 'lucide-react';

const levelColors: Record<HealthLevel, { text: string; fill: string; bg: string }> = {
  excellent: { text: 'text-[hsl(var(--success))]', fill: 'hsl(var(--success))', bg: 'bg-[hsl(var(--success-light))]' },
  good: { text: 'text-primary', fill: 'hsl(var(--primary))', bg: 'bg-primary/10' },
  attention: { text: 'text-[hsl(var(--warning))]', fill: 'hsl(var(--warning))', bg: 'bg-[hsl(var(--warning-light))]' },
  critical: { text: 'text-destructive', fill: 'hsl(var(--destructive))', bg: 'bg-destructive/10' },
};

function getScoreLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

interface HealthScoreBreakdownPanelProps {
  project: ProjectSummary;
}

export function HealthScoreBreakdownPanel({ project }: HealthScoreBreakdownPanelProps) {
  const health = useMemo(() => computeHealthScore(project), [project]);
  const colors = levelColors[health.level];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          Health Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main score */}
        <div className="flex items-center gap-3">
          <div className={cn('rounded-xl px-4 py-2 font-bold text-2xl tabular-nums', colors.bg, colors.text)}>
            {health.score}
          </div>
          <div>
            <p className={cn('text-sm font-semibold', colors.text)}>{health.label}</p>
            <p className="text-xs text-muted-foreground">de 100 pontos</p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3">
          {health.breakdowns.map((b) => {
            const barColors = levelColors[getScoreLevel(b.score)];
            return (
              <div key={b.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {b.label}
                    <span className="text-muted-foreground ml-1">({Math.round(b.weight * 100)}%)</span>
                  </span>
                  <span className={cn('text-xs font-bold tabular-nums', barColors.text)}>
                    {b.score}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${b.score}%`, backgroundColor: barColors.fill }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{b.detail}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
