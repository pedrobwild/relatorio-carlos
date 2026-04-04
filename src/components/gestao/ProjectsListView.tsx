import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalLink, AlertTriangle, CheckCircle, Clock, ChevronDown, MapPin, Ruler, Key, CalendarX } from 'lucide-react';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { ObraExpandedRow } from '@/components/admin/obras/ObraExpandedRow';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  paused: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
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
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
              <TableHead className="w-10 px-2" />
              <TableHead className="min-w-[200px] py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Obra
              </TableHead>
              <TableHead className="w-[72px] text-center py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-[56px] text-center py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Saúde
              </TableHead>
              <TableHead className="w-[80px] text-center py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Entrega
              </TableHead>
              <TableHead className="w-[100px] text-center py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Prazo
              </TableHead>
              <TableHead className="w-[80px] text-center py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Avanço
              </TableHead>
              <TableHead className="w-[80px] py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Resp.
              </TableHead>
              <TableHead className="w-[56px] text-center py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pend.
              </TableHead>
              <TableHead className="w-10" />
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
                        <TableCell colSpan={10} className="p-0">
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
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
          'cursor-pointer transition-colors group/row border-b border-border/40',
          isOverdue
            ? 'bg-red-50/60 hover:bg-red-50 dark:bg-destructive/[0.04] dark:hover:bg-destructive/[0.08]'
            : isApproaching
              ? 'bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-500/[0.03] dark:hover:bg-amber-500/[0.06]'
              : 'hover:bg-muted/40',
        )}
      >
        {/* Expand */}
        <TableCell className="w-10 px-2 py-3">
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground/60 transition-transform', isExpanded && 'rotate-180')} />
        </TableCell>

        {/* Name */}
        <TableCell className="py-3" onClick={(e) => { e.stopPropagation(); onNavigate(); }}>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate max-w-[260px] group-hover/row:text-primary transition-colors leading-tight">
              {project.name}
            </p>
            {project.unit_name && (
              <p className="text-[11px] text-primary/60 font-medium truncate mt-0.5">{project.unit_name}</p>
            )}
            {project.customer_name && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{project.customer_name}</p>
            )}
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="text-center py-3">
          <Badge variant="outline" className={cn(statusColors[project.status], 'text-[10px] font-medium px-2 py-0.5 whitespace-nowrap')}>
            {statusLabels[project.status]}
          </Badge>
        </TableCell>

        {/* Health */}
        <TableCell className="text-center py-3">
          {summary ? (
            <div className="flex justify-center">
              <HealthScoreBadge project={summary} size="sm" />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Entrega */}
        <TableCell className="text-center py-3">
          {plannedEnd ? (
            <span className={cn(
              'text-sm font-bold tabular-nums whitespace-nowrap',
              isFinished ? 'text-emerald-600 dark:text-emerald-400' :
              isOverdue ? 'text-destructive' :
              isApproaching ? 'text-amber-600 dark:text-amber-400' :
              'text-foreground',
            )}>
              {format(plannedEnd, "dd/MM", { locale: ptBR })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Prazo */}
        <TableCell className="text-center py-3">
          {plannedEnd ? (
            isFinished ? (
              <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2 py-0.5 whitespace-nowrap">
                <CheckCircle className="h-3 w-3" /> Entregue
              </Badge>
            ) : isOverdue ? (
              <Badge variant="outline" className="text-[10px] gap-1 bg-red-50 text-destructive border-red-200 dark:bg-destructive/10 dark:border-destructive/20 px-2 py-0.5 animate-pulse whitespace-nowrap font-semibold">
                <CalendarX className="h-3 w-3" /> {Math.abs(daysRemaining!)}d atraso
              </Badge>
            ) : isApproaching ? (
              <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 px-2 py-0.5 whitespace-nowrap">
                <Clock className="h-3 w-3" /> {daysRemaining}d
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground tabular-nums">{daysRemaining}d</span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Progress */}
        <TableCell className="text-center py-3">
          <div className="flex items-center gap-2 justify-center">
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-7 text-right">
              {Math.round(progress)}%
            </span>
          </div>
        </TableCell>

        {/* Engineer */}
        <TableCell className="py-3">
          <span className="text-xs truncate block max-w-[80px]">
            {project.engineer_name
              ? project.engineer_name.split(' ')[0]
              : <span className="text-muted-foreground italic">—</span>}
          </span>
        </TableCell>

        {/* Pending */}
        <TableCell className="text-center py-3">
          {pendingCount === 0 ? (
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-0.5">
                  {overdueCount > 0 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  <span className={cn('text-xs font-bold tabular-nums', overdueCount > 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
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
        <TableCell className="py-3 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover/row:opacity-100 transition-opacity"
            title="Ver portal"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    </CollapsibleTrigger>
  );
}
