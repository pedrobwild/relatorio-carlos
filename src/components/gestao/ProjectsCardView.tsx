import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, AlertTriangle, FileSignature, FileText, Clock } from 'lucide-react';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { differenceInDays } from 'date-fns';
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
  const pendingCount = summary?.pending_count ?? 0;
  const overdueCount = summary?.overdue_count ?? 0;
  const unsignedFormalizations = summary?.unsigned_formalizations ?? 0;
  const pendingDocs = summary?.pending_documents ?? 0;
  const progress = summary?.progress_percentage ?? 0;
  const contractValue = project.contract_value ?? 0;

  const today = getTodayLocal();
  const plannedEnd = project.planned_end_date ? parseLocalDate(project.planned_end_date) : null;
  const daysRemaining = plannedEnd ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col text-left rounded-xl border border-border/50 bg-card p-4 gap-3',
        'hover:border-primary/30 hover:shadow-md transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate text-foreground">{project.name}</p>
          {project.customer_name && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{project.customer_name}</p>
          )}
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', statusColors[project.status])}>
          {statusLabels[project.status] ?? project.status}
        </Badge>
      </div>

      {/* Health + Progress */}
      <div className="flex items-center gap-3">
        {summary && <HealthScoreBadge project={summary} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Progresso</span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deadline */}
      {plannedEnd && (
        <div className={cn(
          'flex items-center gap-1.5 text-xs',
          isOverdue ? 'text-destructive' : daysRemaining !== null && daysRemaining <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        )}>
          <Clock className="h-3 w-3" />
          {isOverdue
            ? `${Math.abs(daysRemaining!)}d em atraso`
            : `${daysRemaining}d restantes`}
        </div>
      )}

      {/* Indicators */}
      <div className="flex items-center gap-2 flex-wrap">
        {overdueCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{overdueCount} item(ns) em atraso</TooltipContent>
          </Tooltip>
        )}
        {unsignedFormalizations > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                <FileSignature className="h-3 w-3" />
                {unsignedFormalizations}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{unsignedFormalizations} assinatura(s) pendente(s)</TooltipContent>
          </Tooltip>
        )}
        {pendingDocs > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                <FileText className="h-3 w-3" />
                {pendingDocs}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{pendingDocs} documento(s) pendente(s)</TooltipContent>
          </Tooltip>
        )}
        {contractValue > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            R$ {(contractValue / 1000).toFixed(0)}k
          </span>
        )}
      </div>

      {/* Engineer */}
      {project.engineer_name && (
        <p className="text-[11px] text-muted-foreground/70 truncate border-t border-border/30 pt-2 -mb-1">
          {project.engineer_name}
        </p>
      )}
    </button>
  );
}
