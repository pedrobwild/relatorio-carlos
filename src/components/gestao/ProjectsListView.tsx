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

const statusTooltips: Record<string, string> = {
  active: 'Obra em execução — cronograma e financeiro ativos',
  completed: 'Obra entregue e finalizada',
  paused: 'Obra temporariamente pausada',
  cancelled: 'Obra cancelada',
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
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead className="min-w-[180px] text-xs whitespace-nowrap">Obra</TableHead>
              <TableHead className="w-[100px] text-center text-xs whitespace-nowrap">Status</TableHead>
              <TableHead className="w-[60px] text-center text-xs whitespace-nowrap">Saúde</TableHead>
              <TableHead className="w-[100px] text-center text-xs whitespace-nowrap">📅 Entrega</TableHead>
              <TableHead className="w-[110px] text-center text-xs whitespace-nowrap">Prazo</TableHead>
              <TableHead className="w-[70px] text-center text-xs whitespace-nowrap">Progresso</TableHead>
              <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Engenheiro</TableHead>
              <TableHead className="w-[90px] text-center text-xs whitespace-nowrap">Pendências</TableHead>
              <TableHead className="w-[50px]" />
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
          {project.tipo_de_locacao && (
            <Badge variant="secondary" className="text-xs">{project.tipo_de_locacao}</Badge>
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
  project,
  summary,
  isExpanded,
  onToggle,
  onNavigate,
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
  const contractValue = project.contract_value ?? 0;

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
          'cursor-pointer hover:bg-muted/50 transition-colors',
          isOverdue && 'bg-destructive/[0.03] hover:bg-destructive/[0.06]',
          isApproaching && !isOverdue && 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]',
        )}
      >
        {/* Expand toggle */}
        <TableCell className="w-[30px] px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </TableCell>

        {/* Name + Customer */}
        <TableCell onClick={(e) => { e.stopPropagation(); onNavigate(); }}>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{project.name}</p>
            {project.unit_name && (
              <p className="text-[11px] text-primary/70 font-medium truncate">{project.unit_name}</p>
            )}
            {project.customer_name && (
              <p className="text-xs text-muted-foreground truncate">{project.customer_name}</p>
            )}
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-0.5">
                <Badge variant="outline" className={`${statusColors[project.status]} text-[10px] whitespace-nowrap cursor-help`}>
                  {statusLabels[project.status]}
                </Badge>
                {project.is_project_phase && (
                  <span className="text-[10px] text-accent-foreground font-medium">Fase Projeto</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">
              <p className="text-xs font-medium mb-1">Status da Obra: {statusLabels[project.status]}</p>
              <p className="text-xs text-muted-foreground">{statusTooltips[project.status]}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Health Score */}
        <TableCell className="text-center">
          {summary ? (
            <div className="flex justify-center">
              <HealthScoreBadge project={summary} size="sm" />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Data de Entrega */}
        <TableCell className="text-center">
          {plannedEnd ? (
            <span className={cn(
              'text-sm font-bold tabular-nums',
              isFinished ? 'text-[hsl(var(--success))]' :
              isOverdue ? 'text-destructive' :
              isApproaching ? 'text-[hsl(var(--warning))]' :
              'text-foreground',
            )}>
              {format(plannedEnd, "dd/MM/yy", { locale: ptBR })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">A definir</span>
          )}
        </TableCell>

        {/* Prazo — days remaining / status */}
        <TableCell className="text-center">
          {plannedEnd ? (
            isFinished ? (
              <Badge variant="outline" className="text-[10px] gap-0.5 bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success))]/20 px-1.5 py-0">
                <CheckCircle className="h-3 w-3" /> Entregue
              </Badge>
            ) : isOverdue ? (
              <Badge variant="outline" className="text-[10px] gap-0.5 bg-destructive/10 text-destructive border-destructive/20 px-1.5 py-0 animate-pulse">
                <CalendarX className="h-3 w-3" /> {Math.abs(daysRemaining!)}d atraso
              </Badge>
            ) : isApproaching ? (
              <Badge variant="outline" className="text-[10px] gap-0.5 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 px-1.5 py-0">
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
        <TableCell className="text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-medium tabular-nums">{Math.round(progress)}%</span>
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        </TableCell>

        {/* Engineer */}
        <TableCell>
          <span className="text-sm truncate block max-w-[120px]">
            {project.engineer_name || <span className="text-muted-foreground italic text-xs">Não atribuído</span>}
          </span>
        </TableCell>

        {/* Pending Items */}
        <TableCell className="text-center">
          {pendingCount === 0 ? (
            <span className="text-xs text-[hsl(var(--success))] font-medium">Em dia</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-1">
                  {overdueCount > 0 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  <span className={`text-sm font-medium ${overdueCount > 0 ? 'text-destructive' : 'text-[hsl(var(--warning))]'}`}>
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
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Ver portal"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    </CollapsibleTrigger>
  );
}
