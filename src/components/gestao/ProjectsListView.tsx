import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalLink, AlertTriangle, CheckCircle, Clock, ChevronDown, MapPin, Ruler, Key, CalendarX, Hourglass, HardHat } from 'lucide-react';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { useCurrentStages, type CurrentStageInfo } from '@/hooks/useCurrentStages';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { ObraExpandedRow } from '@/components/admin/obras/ObraExpandedRow';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/50 dark:text-emerald-400 dark:border-emerald-500/20',
  completed: 'bg-blue-500/10 text-blue-700 border-blue-300/50 dark:text-blue-400 dark:border-blue-500/20',
  paused: 'bg-amber-500/10 text-amber-700 border-amber-300/50 dark:text-amber-400 dark:border-amber-500/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

interface ProjectsListViewProps {
  projects: ProjectWithCustomer[];
  onProjectClick?: (project: ProjectWithCustomer) => void;
}

export function ProjectsListView({ projects, onProjectClick }: ProjectsListViewProps) {
  const navigate = useNavigate();
  const { data: summaries = [], isLoading: summariesLoading } = useProjectSummaryQuery();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const summaryMap = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    for (const s of summaries) map.set(s.id, s);
    return map;
  }, [summaries]);

  if (summariesLoading) {
    return <ContentSkeleton variant="table" rows={5} />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
              <TableHead className="w-7 px-1" />
              <TableHead className="py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Obra
              </TableHead>
              <TableHead className="w-[56px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Status
              </TableHead>
              <TableHead className="w-[44px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Saúde
              </TableHead>
              <TableHead className="w-[96px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Entrega
              </TableHead>
              <TableHead className="w-[68px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Avanço
              </TableHead>
              <TableHead className="w-[40px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Pend.
              </TableHead>
              <TableHead className="w-7" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const summary = summaryMap.get(project.id);
              const isExpanded = expandedIds.has(project.id);
              return (
                <Collapsible key={project.id} asChild open={isExpanded} onOpenChange={() => toggleExpanded(project.id)}>
                  <>
                    <ProjectRow
                      project={project}
                      summary={summary}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpanded(project.id)}
                      onNavigate={() => onProjectClick ? onProjectClick(project) : navigate(`/obra/${project.id}`)}
                    />
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/30">
                        <TableCell colSpan={8} className="p-0">
                          <CollapsibleContent forceMount>
                            <ExpandedContent project={project} contractValue={project.contract_value} />
                          </CollapsibleContent>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                </Collapsible>
              );
            })}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma obra encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

function ExpandedContent({ project, contractValue }: { project: ProjectWithCustomer; contractValue: number | null }) {
  const hasStudioInfo = project.cidade || project.tamanho_imovel_m2 || project.data_recebimento_chaves || project.endereco_completo;

  return (
    <div className="px-4 py-3 space-y-3">
      {hasStudioInfo && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {(project.endereco_completo || project.cidade) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{[project.endereco_completo, project.cidade].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {project.tamanho_imovel_m2 && (
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 shrink-0" />
              <span>{project.tamanho_imovel_m2}m²</span>
            </div>
          )}
          {project.data_recebimento_chaves && (
            <div className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 shrink-0" />
              <span>Chaves: {format(parseLocalDate(project.data_recebimento_chaves), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
          )}
        </div>
      )}
      <ObraExpandedRow projectId={project.id} contractValue={contractValue} />
    </div>
  );
}

function ProjectRow({
  project, summary, isExpanded, onToggle, onNavigate,
}: {
  project: ProjectWithCustomer;
  summary?: ProjectSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const pendingCount = summary?.pending_count ?? 0;
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
    <CollapsibleTrigger asChild>
      <TableRow
        className={cn(
          'cursor-pointer transition-colors group/row border-b border-border/30',
          isOverdue
            ? 'bg-red-50/50 hover:bg-red-50/80 dark:bg-destructive/[0.03] dark:hover:bg-destructive/[0.06]'
            : isApproaching
              ? 'bg-amber-50/30 hover:bg-amber-50/60 dark:bg-amber-500/[0.02] dark:hover:bg-amber-500/[0.05]'
              : 'hover:bg-muted/30',
        )}
      >
        {/* Expand chevron */}
        <TableCell className="w-7 px-1.5 py-2">
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200', isExpanded && 'rotate-180')} />
        </TableCell>

        {/* Name */}
        <TableCell className="py-2" onClick={(e) => { e.stopPropagation(); onNavigate(); }}>
          <div className="min-w-0">
            <p className="font-semibold text-[13px] truncate max-w-[280px] group-hover/row:text-primary transition-colors leading-tight">
              {project.name}
            </p>
            {project.customer_name && (
              <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5 leading-tight">{project.customer_name}</p>
            )}
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="text-center py-2">
          <Badge variant="outline" className={cn(statusColors[project.status], 'text-[9px] font-semibold px-1.5 py-0 h-[18px] whitespace-nowrap')}>
            {statusLabels[project.status]}
          </Badge>
        </TableCell>

        {/* Health */}
        <TableCell className="text-center py-2">
          {summary ? (
            <div className="flex justify-center">
              <HealthScoreBadge project={summary} size="sm" />
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </TableCell>

        {/* Entrega */}
        <TableCell className="text-center py-2">
          {plannedEnd ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className={cn(
                'text-[13px] font-bold tabular-nums whitespace-nowrap leading-none',
                isFinished ? 'text-emerald-600 dark:text-emerald-400' :
                isOverdue ? 'text-destructive' :
                isApproaching ? 'text-amber-600 dark:text-amber-400' :
                'text-foreground',
              )}>
                {format(plannedEnd, "dd/MM", { locale: ptBR })}
              </span>
              {isFinished ? (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 leading-none">
                  <CheckCircle className="h-2.5 w-2.5" /> Entregue
                </span>
              ) : isOverdue ? (
                <span className="text-[9px] text-destructive font-bold flex items-center gap-0.5 leading-none animate-pulse">
                  <CalendarX className="h-2.5 w-2.5" /> {Math.abs(daysRemaining!)}d atraso
                </span>
              ) : isApproaching ? (
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5 leading-none">
                  <Clock className="h-2.5 w-2.5" /> {daysRemaining}d
                </span>
              ) : (
                <span className="text-[9px] text-muted-foreground/60 tabular-nums leading-none">{daysRemaining}d</span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </TableCell>

        {/* Progress */}
        <TableCell className="text-center py-2">
          <div className="flex items-center gap-1.5 justify-center">
            <div className="w-10 h-1 bg-muted/80 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  progress >= 80 ? 'bg-emerald-500' : progress >= 40 ? 'bg-primary' : 'bg-amber-500',
                )}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-6 text-right">
              {Math.round(progress)}%
            </span>
          </div>
        </TableCell>

        {/* Pending */}
        <TableCell className="text-center py-2">
          {pendingCount === 0 ? (
            <CheckCircle className="h-3 w-3 text-emerald-500/60 mx-auto" />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-0.5">
                  {overdueCount > 0 && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  <span className={cn('text-[11px] font-bold tabular-nums', overdueCount > 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
                    {pendingCount}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {overdueCount > 0
                  ? `${overdueCount} em atraso de ${pendingCount} total`
                  : `${pendingCount} pendência(s) dentro do prazo`}
              </TooltipContent>
            </Tooltip>
          )}
        </TableCell>

        {/* Action */}
        <TableCell className="py-2 px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity"
            title="Ver portal"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </TableCell>
      </TableRow>
    </CollapsibleTrigger>
  );
}
