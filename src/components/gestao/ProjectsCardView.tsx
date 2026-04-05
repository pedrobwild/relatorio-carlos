import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock, CalendarX, CheckCircle } from 'lucide-react';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { HealthScoreBreakdown } from '@/components/health/HealthScoreBreakdown';
import { useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

const statusColors: Record<string, string> = {
  active: 'bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  completed: 'bg-primary/10 text-primary border-primary/20',
  paused: 'bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

interface ProjectsCardViewProps {
  projects: ProjectWithCustomer[];
  onProjectClick?: (project: ProjectWithCustomer) => void;
}

export function ProjectsCardView({ projects, onProjectClick }: ProjectsCardViewProps) {
  const navigate = useNavigate();
  const { data: summaries = [], isLoading } = useProjectSummaryQuery();

  const summaryMap = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    for (const s of summaries) map.set(s.id, s);
    return map;
  }, [summaries]);

  if (isLoading) {
    return <ContentSkeleton variant="table" rows={5} />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {projects.map((project) => {
          const summary = summaryMap.get(project.id);
          return (
            <ProjectCard
              key={project.id}
              project={project}
              summary={summary}
              onClick={() => onProjectClick ? onProjectClick(project) : navigate(`/obra/${project.id}`)}
            />
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function ProjectCard({
  project,
  summary,
  onClick,
}: {
  project: ProjectWithCustomer;
  summary?: ProjectSummary;
  onClick: () => void;
}) {
  const overdueCount = summary?.overdue_count ?? 0;
  const progress = summary?.progress_percentage ?? 0;

  const today = getTodayLocal();
  const plannedEnd = project.planned_end_date ? parseLocalDate(project.planned_end_date) : null;
  const actualEnd = project.actual_end_date ? parseLocalDate(project.actual_end_date) : null;
  const isFinished = !!actualEnd;
  const daysRemaining = plannedEnd && !isFinished ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isApproaching = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 14;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col text-left rounded-xl border bg-card p-4 gap-3',
        'hover:shadow-md transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOverdue
          ? 'border-destructive/30 bg-destructive/[0.02] hover:border-destructive/50'
          : isApproaching
          ? 'border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500/50'
          : 'border-border/50 hover:border-primary/30',
      )}
    >
      {/* Row 1: Health + Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {summary && <HealthScoreBadge project={summary} size="md" showLabel />}
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', statusColors[project.status])}>
          {statusLabels[project.status] ?? project.status}
        </Badge>
      </div>

      {/* Health breakdown mini-bars */}
      {summary && (
        <HealthScoreBreakdown project={summary} className="px-1" />
      )}

      {/* Row 2: Delivery date — prominent */}
      {plannedEnd && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 -mx-1',
          isFinished ? 'bg-[hsl(var(--success-light))]' :
          isOverdue ? 'bg-destructive/10' :
          isApproaching ? 'bg-amber-500/10' :
          'bg-muted/40',
        )}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Entrega</p>
            <p className={cn(
              'text-base font-bold tabular-nums',
              isFinished ? 'text-[hsl(var(--success))]' :
              isOverdue ? 'text-destructive' :
              isApproaching ? 'text-amber-600 dark:text-amber-400' :
              'text-foreground',
            )}>
              {format(plannedEnd, "dd/MM/yy", { locale: ptBR })}
            </p>
          </div>
          {isFinished ? (
            <Badge variant="outline" className="text-[10px] gap-0.5 bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success))]/20 shrink-0">
              <CheckCircle className="h-3 w-3" /> Entregue
            </Badge>
          ) : isOverdue ? (
            <Badge variant="outline" className="text-[10px] gap-0.5 bg-destructive/10 text-destructive border-destructive/20 shrink-0 animate-pulse">
              <CalendarX className="h-3 w-3" /> {Math.abs(daysRemaining!)}d atraso
            </Badge>
          ) : isApproaching ? (
            <Badge variant="outline" className="text-[10px] gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shrink-0">
              <Clock className="h-3 w-3" /> {daysRemaining}d
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{daysRemaining}d</span>
          )}
        </div>
      )}

      {/* Row 3: Critical alerts */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} atraso{overdueCount > 1 ? 's' : ''}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{overdueCount} item(ns) em atraso</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Row 4: Project name + unit */}
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{project.name}</p>
        {project.unit_name && (
          <p className="text-[11px] text-primary/70 font-medium truncate mt-0.5">{project.unit_name}</p>
        )}
      </div>

      {/* Row 5: Progress bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>Progresso</span>
          <span className="font-medium tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 md:h-1.5 rounded-full bg-muted overflow-hidden group-hover:h-2 transition-all">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Row 6: Secondary metadata */}
      {(project.customer_name || project.engineer_name) && (
        <div className="text-[10px] text-muted-foreground/60 truncate border-t border-border/30 pt-2 -mb-1 flex items-center gap-1.5 flex-wrap">
          {project.customer_name && <span>{project.customer_name}</span>}
          {project.customer_name && project.engineer_name && <span>·</span>}
          {project.engineer_name && <span>{project.engineer_name}</span>}
        </div>
      )}
    </button>
  );
}
