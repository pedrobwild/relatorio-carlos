import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, FileSignature, FileText, Clock } from 'lucide-react';
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
  const overdueCount = summary?.overdue_count ?? 0;
  const unsignedFormalizations = summary?.unsigned_formalizations ?? 0;
  const pendingDocs = summary?.pending_documents ?? 0;
  const progress = summary?.progress_percentage ?? 0;

  const today = getTodayLocal();
  const plannedEnd = project.planned_end_date ? parseLocalDate(project.planned_end_date) : null;
  const daysRemaining = plannedEnd ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  const hasCriticalAlerts = overdueCount > 0 || unsignedFormalizations > 0 || pendingDocs > 0;

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
      {/* Row 1: Health + Status (highest visual priority) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {summary && <HealthScoreBadge project={summary} size="md" showLabel />}
          {plannedEnd && (
            <span className={cn(
              'flex items-center gap-1 text-[11px] font-medium',
              isOverdue ? 'text-destructive' : daysRemaining !== null && daysRemaining <= 7 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground',
            )}>
              <Clock className="h-3 w-3" />
              {isOverdue ? `${Math.abs(daysRemaining!)}d atraso` : `${daysRemaining}d`}
            </span>
          )}
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', statusColors[project.status])}>
          {statusLabels[project.status] ?? project.status}
        </Badge>
      </div>

      {/* Row 2: Critical alerts (positioned before project info for urgency) */}
      {hasCriticalAlerts && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {overdueCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/10 text-destructive border-destructive/20">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} atraso{overdueCount > 1 ? 's' : ''}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{overdueCount} item(ns) em atraso</TooltipContent>
            </Tooltip>
          )}
          {unsignedFormalizations > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20">
                  <FileSignature className="h-3 w-3" />
                  {unsignedFormalizations} assinatura{unsignedFormalizations > 1 ? 's' : ''}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{unsignedFormalizations} assinatura(s) pendente(s)</TooltipContent>
            </Tooltip>
          )}
          {pendingDocs > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
                  <FileText className="h-3 w-3" />
                  {pendingDocs} doc{pendingDocs > 1 ? 's' : ''}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{pendingDocs} documento(s) pendente(s)</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Row 3: Project name + unit */}
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{project.name}</p>
        {project.unit_name && (
          <p className="text-[11px] text-primary/70 font-medium truncate mt-0.5">{project.unit_name}</p>
        )}
      </div>

      {/* Row 4: Progress bar */}
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

      {/* Row 5: Secondary metadata (subtle, grouped) */}
      {(project.customer_name || project.tamanho_imovel_m2 || project.tipo_de_locacao || project.engineer_name) && (
        <div className="text-[10px] text-muted-foreground/60 truncate border-t border-border/30 pt-2 -mb-1 flex items-center gap-1.5 flex-wrap">
          {project.customer_name && <span>{project.customer_name}</span>}
          {project.customer_name && (project.tamanho_imovel_m2 || project.tipo_de_locacao || project.engineer_name) && <span>·</span>}
          {project.tamanho_imovel_m2 && <span>{project.tamanho_imovel_m2}m²</span>}
          {project.tipo_de_locacao && <span>{project.tipo_de_locacao}</span>}
          {project.engineer_name && <span>{project.engineer_name}</span>}
        </div>
      )}
    </button>
  );
}
