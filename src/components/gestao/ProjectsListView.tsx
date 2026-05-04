import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, Clock, ChevronDown, MapPin, Ruler, Key, CalendarX, Hourglass, HardHat, Pencil, FileSignature, FileText, MoreHorizontal, Trash2, Settings, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, PlayCircle, PauseCircle } from 'lucide-react';
import { useProjectSummaryQuery, useUpdateProjectStatusMutation } from '@/hooks/useProjectsQuery';
import { useCurrentStages, type CurrentStageInfo } from '@/hooks/useCurrentStages';
import { useJourneyStagesSummary } from '@/hooks/useJourneyStagesSummary';
import { useDeleteProject } from '@/hooks/useDeleteProject';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { ObraExpandedRow } from '@/components/admin/obras/ObraExpandedRow';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import { getTemporalStatusLabel } from '@/lib/temporalStatus';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';



const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  active: 'bg-success/10 text-success border-success/30',
  completed: 'bg-info/10 text-info border-info/30',
  paused: 'bg-warning/10 text-warning border-warning/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
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
  const deleteProject = useDeleteProject();
  const updateStatus = useUpdateProjectStatusMutation();
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithCustomer | null>(null);

  // Split IDs: obras use cronograma stages, projetos use journey stages
  const { obraIds, projetoIds } = useMemo(() => {
    const obraIds: string[] = [];
    const projetoIds: string[] = [];
    for (const p of projects) {
      if (p.is_project_phase) projetoIds.push(p.id);
      else obraIds.push(p.id);
    }
    return { obraIds, projetoIds };
  }, [projects]);

  const { data: stagesMapRaw } = useCurrentStages(obraIds);
  const { data: journeyStagesMap } = useJourneyStagesSummary(projetoIds);

  // Merge both sources into a single CurrentStageInfo map
  const stagesMap = useMemo(() => {
    const map = new Map<string, CurrentStageInfo>();

    // Normalize obra stages (may be deserialized as plain object)
    if (stagesMapRaw) {
      const entries = stagesMapRaw instanceof Map
        ? stagesMapRaw.entries()
        : Object.entries(stagesMapRaw as Record<string, CurrentStageInfo>);
      for (const [k, v] of entries) {
        map.set(k, v);
      }
    }

    // Convert journey stages to CurrentStageInfo format
    if (journeyStagesMap) {
      const entries = journeyStagesMap instanceof Map
        ? journeyStagesMap.entries()
        : Object.entries(journeyStagesMap as Record<string, any>);
      for (const [k, v] of entries) {
        map.set(k, {
          description: v.currentStageName,
          isAwaitingStart: false,
        });
      }
    }

    return map;
  }, [stagesMapRaw, journeyStagesMap]);
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

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'entrega', direction: 'asc' });

  const sortedProjects = useMemo(() => {
    const sorted = [...projects];
    sorted.sort((a, b) => {
      const { key, direction } = sortConfig;
      const mul = direction === 'asc' ? 1 : -1;
      let cmp = 0;
      if (key === 'obra') {
        cmp = (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR');
      } else if (key === 'responsavel') {
        const aName = a.engineer_name ?? '';
        const bName = b.engineer_name ?? '';
        // Push empty values to the end regardless of direction
        if (!aName && bName) return 1;
        if (aName && !bName) return -1;
        cmp = aName.localeCompare(bName, 'pt-BR');
      } else if (key === 'status') {
        cmp = (a.status ?? '').localeCompare(b.status ?? '', 'pt-BR');
      } else if (key === 'entrega') {
        const aDate = a.planned_end_date ? new Date(a.planned_end_date).getTime() : null;
        const bDate = b.planned_end_date ? new Date(b.planned_end_date).getTime() : null;
        // Push nulls to end regardless of direction
        if (aDate === null && bDate === null) return 0;
        if (aDate === null) return 1;
        if (bDate === null) return -1;
        cmp = aDate - bDate;
      } else if (key === 'avanco') {
        const aVal = summaryMap.get(a.id)?.progress_percentage ?? 0;
        const bVal = summaryMap.get(b.id)?.progress_percentage ?? 0;
        cmp = aVal - bVal;
      } else if (key === 'pendencias') {
        const aVal = summaryMap.get(a.id)?.overdue_count ?? 0;
        const bVal = summaryMap.get(b.id)?.overdue_count ?? 0;
        cmp = aVal - bVal;
      }
      // Primary sort with direction, then stable tie-break by name
      const result = mul * cmp;
      if (result !== 0) return result;
      return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR');
    });
    return sorted;
  }, [projects, sortConfig, summaryMap]);

  const handleSort = (key: string, defaultDirection: 'asc' | 'desc' = 'asc') => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: defaultDirection }
    );
  };

  const sortIcon = (colKey: string) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
  };

  if (summariesLoading) {
    return <ContentSkeleton variant="table" rows={5} />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border border-border/50 bg-white dark:bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-white dark:bg-card hover:bg-white dark:hover:bg-card border-b border-border/50">
              <TableHead className="w-7 px-1" />
              <TableHead className="py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort('obra')}>
                Obra{sortIcon('obra')}
              </TableHead>
              <TableHead className="w-[100px] py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort('responsavel')}>
                Responsável{sortIcon('responsavel')}
              </TableHead>
              <TableHead className="w-[180px] py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Etapa Atual
              </TableHead>
              <TableHead className="w-[56px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort('status')}>
                Status{sortIcon('status')}
              </TableHead>
              <TableHead className="w-[80px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Atualizado
              </TableHead>
              <TableHead className="w-[96px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort('entrega')}>
                Entrega{sortIcon('entrega')}
              </TableHead>
              <TableHead className="w-[110px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort('avanco')}>
                Avanço{sortIcon('avanco')}
              </TableHead>
              <TableHead className="w-[40px] text-center py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort('pendencias', 'desc')}>
                Pend.{sortIcon('pendencias')}
              </TableHead>
              <TableHead className="w-7" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => {
              const summary = summaryMap.get(project.id);
              const isExpanded = expandedIds.has(project.id);
              return (
                <Collapsible key={project.id} asChild open={isExpanded} onOpenChange={() => toggleExpanded(project.id)}>
                  <>
                    <ProjectRow
                      project={project}
                      summary={summary}
                      currentStage={stagesMap?.get(project.id)}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpanded(project.id)}
                      onNavigate={() => onProjectClick ? onProjectClick(project) : navigate(`/obra/${project.id}`)}
                      onEdit={() => navigate(`/gestao/obra/${project.id}/editar`)}
                      onDelete={() => setDeleteTarget(project)}
                      onChangeStatus={(status) => updateStatus.mutate({ projectId: project.id, status })}
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
            {sortedProjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  Nenhuma obra encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Obra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a obra "{deleteTarget?.name}"? Esta ação é irreversível e excluirá todos os dados relacionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProject.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteProject.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {deleteProject.isPending ? 'Excluindo...' : 'Excluir Definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  project, summary, currentStage, isExpanded, onToggle: _onToggle, onNavigate, onEdit, onDelete, onChangeStatus,
}: {
  project: ProjectWithCustomer;
  summary?: ProjectSummary;
  currentStage?: CurrentStageInfo;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: (status: 'active' | 'completed' | 'paused' | 'draft' | 'cancelled') => void;
}) {
  const navigate = useNavigate();
  const pendingCount = summary?.pending_count ?? 0;
  const overdueCount = summary?.overdue_count ?? 0;
  const unsignedFormalizations = summary?.unsigned_formalizations ?? 0;
  const pendingDocuments = summary?.pending_documents ?? 0;
  const progress = Math.max(0, Math.min(100, Math.round(Number(summary?.progress_percentage ?? 0))));

  const plannedProgress = useMemo(() => {
    const startStr = project.actual_start_date ?? project.planned_start_date;
    if (!startStr || !project.planned_end_date) return 0;
    const start = new Date(startStr).getTime();
    const end = new Date(project.planned_end_date).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    const total = end - start;
    if (total <= 0) return 0;
    return Math.round(((now - start) / total) * 100);
  }, [project.actual_start_date, project.planned_start_date, project.planned_end_date]);
  const progressDeviation = progress - plannedProgress;

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
          'cursor-pointer transition-colors group/row border-b border-border/30 bg-white dark:bg-card',
          isOverdue
            ? 'hover:bg-destructive/[0.06]'
            : isApproaching
              ? 'hover:bg-warning/[0.06]'
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
            {project.customer_name ? (
              <>
                <p className="font-bold text-[13px] truncate max-w-[280px] group-hover/row:text-primary transition-colors leading-tight">
                  {project.customer_name}
                </p>
                <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5 leading-tight">{project.name}</p>
              </>
            ) : (
              <p className="font-bold text-[13px] truncate max-w-[280px] group-hover/row:text-primary transition-colors leading-tight">
                {project.name}
              </p>
            )}
          </div>
         </TableCell>

         {/* Responsável */}
         <TableCell className="py-2">
           {project.engineer_name ? (() => {
             const parts = project.engineer_name!.trim().split(/\s+/);
             const initials = (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '');
             const shortName = parts.length > 1
               ? `${parts[0]} ${parts[parts.length - 1][0]}.`
               : parts[0];
             return (
               <div className="flex items-center gap-1.5 min-w-0">
                 <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                   <span className="text-[10px] font-bold text-primary uppercase">{initials}</span>
                 </div>
                 <span className="text-[11px] font-medium text-foreground/80 truncate max-w-[80px]">{shortName}</span>
               </div>
             );
           })() : (
             <span className="text-[10px] text-muted-foreground/40">—</span>
           )}
         </TableCell>

         {/* Etapa Atual */}
        <TableCell className="py-2">
          {currentStage ? (
            <div className="flex items-center gap-1.5 min-w-0">
              {currentStage.isAwaitingStart ? (
                <Hourglass className="h-3 w-3 shrink-0 text-warning" />
              ) : (
                <HardHat className="h-3 w-3 shrink-0 text-primary" />
              )}
              <span className={cn(
                'text-[11px] font-medium truncate max-w-[160px]',
                currentStage.isAwaitingStart ? 'text-warning' : 'text-foreground/80',
              )}>
                {currentStage.description}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </TableCell>
        <TableCell className="text-center py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={cn(statusColors[project.status], 'text-[9px] font-semibold px-1.5 py-0 h-[18px] whitespace-nowrap')}>
                {statusLabels[project.status]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {getTemporalStatusLabel(project.status, null, project.created_at)}
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Atualizado */}
        <TableCell className="text-center py-2">
          {(() => {
            const lastActivityDate = summary?.last_activity_at ? new Date(summary.last_activity_at) : null;
            const daysSinceUpdate = lastActivityDate ? differenceInDays(getTodayLocal(), lastActivityDate) : null;
            if (daysSinceUpdate === null || !lastActivityDate) {
              return <span className="text-[10px] text-muted-foreground/40">—</span>;
            }
            let label: string;
            let cls: string;
            if (daysSinceUpdate === 0) {
              label = 'hoje';
              cls = 'text-success';
            } else if (daysSinceUpdate === 1) {
              label = 'ontem';
              cls = 'text-foreground/70';
            } else if (daysSinceUpdate <= 6) {
              label = `há ${daysSinceUpdate}d`;
              cls = 'text-foreground/70';
            } else if (daysSinceUpdate <= 13) {
              label = `há ${daysSinceUpdate}d`;
              cls = 'text-warning font-semibold';
            } else {
              label = `há ${daysSinceUpdate}d`;
              cls = 'text-destructive font-bold';
            }
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn('text-[11px] tabular-nums', cls)}>{label}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {format(lastActivityDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </TooltipContent>
              </Tooltip>
            );
          })()}
        </TableCell>


        {/* Entrega */}
        <TableCell className="text-center py-2">
          {plannedEnd ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className={cn(
                'text-[13px] font-bold tabular-nums whitespace-nowrap leading-none',
                isFinished ? 'text-success' :
                isOverdue ? 'text-destructive' :
                isApproaching ? 'text-warning' :
                'text-foreground',
              )}>
                {format(plannedEnd, "dd/MM", { locale: ptBR })}
              </span>
              {isFinished ? (
                <span className="text-[9px] text-success font-medium flex items-center gap-0.5 leading-none">
                  <CheckCircle className="h-2.5 w-2.5" /> Entregue
                </span>
              ) : isOverdue ? (
                <span className="text-[9px] text-destructive font-bold flex items-center gap-0.5 leading-none animate-pulse">
                  <CalendarX className="h-2.5 w-2.5" /> {Math.abs(daysRemaining!)}d atraso
                </span>
              ) : isApproaching ? (
                <span className="text-[9px] text-warning font-medium flex items-center gap-0.5 leading-none">
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

        {/* Progress — real vs planned */}
        <TableCell className="text-center py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-0.5">
                <div className="relative w-14 h-1.5 rounded-full overflow-hidden bg-muted/40">
                  <div className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full" style={{ width: `${Math.min(100, plannedProgress)}%` }} />
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all',
                      progressDeviation >= 0 ? 'bg-success' : progressDeviation >= -10 ? 'bg-warning' : 'bg-destructive',
                    )}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <span className="text-[9px] tabular-nums text-muted-foreground/70 leading-none whitespace-nowrap">
                  {Math.round(progress)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>Real: {Math.round(progress)}% | Planejado: {plannedProgress}%</p>
              <p>Desvio: {progressDeviation >= 0 ? '+' : ''}{progressDeviation} p.p.</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Pending — color-coded by urgency */}
        <TableCell className="text-center py-2">
          {pendingCount === 0 && unsignedFormalizations === 0 && pendingDocuments === 0 ? (
            <CheckCircle className="h-3 w-3 text-[hsl(var(--success))]/60 mx-auto" />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-1">
                  {overdueCount > 0 && (
                    <span className="flex items-center gap-0.5 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-[11px] font-bold tabular-nums">{overdueCount}</span>
                    </span>
                  )}
                  {(pendingCount - overdueCount) > 0 && (
                    <span className="text-[11px] font-bold tabular-nums text-[hsl(var(--warning))]">
                      {pendingCount - overdueCount}
                    </span>
                  )}
                  {unsignedFormalizations > 0 && (
                    <FileSignature className="h-3 w-3 text-[hsl(var(--warning))]" />
                  )}
                  {pendingDocuments > 0 && (
                    <FileText className="h-3 w-3 text-primary" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs space-y-0.5">
                {overdueCount > 0 && <p className="text-destructive font-medium">{overdueCount} em atraso</p>}
                {(pendingCount - overdueCount) > 0 && <p>{pendingCount - overdueCount} pendente(s) no prazo</p>}
                {unsignedFormalizations > 0 && <p>{unsignedFormalizations} formalização(ões) p/ assinar</p>}
                {pendingDocuments > 0 && <p>{pendingDocuments} documento(s) pendente(s)</p>}
              </TooltipContent>
            </Tooltip>
          )}
        </TableCell>

        {/* Action */}
        <TableCell className="py-2 px-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onNavigate()}>
                <Eye className="h-4 w-4 mr-2" /> Ver obra
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit()}>
                <Settings className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              {project.status === 'draft' && (
                <DropdownMenuItem onClick={() => navigate(`/gestao/obra/${project.id}/wizard`)}>
                  <Pencil className="h-4 w-4 mr-2" /> Revisar rascunho
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {project.status !== 'completed' && (
                <DropdownMenuItem onClick={() => onChangeStatus('completed')}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-[hsl(var(--success))]" /> Marcar como concluída
                </DropdownMenuItem>
              )}
              {project.status === 'completed' && (
                <DropdownMenuItem onClick={() => onChangeStatus('active')}>
                  <PlayCircle className="h-4 w-4 mr-2" /> Reabrir obra
                </DropdownMenuItem>
              )}
              {project.status === 'active' && (
                <DropdownMenuItem onClick={() => onChangeStatus('paused')}>
                  <PauseCircle className="h-4 w-4 mr-2" /> Pausar obra
                </DropdownMenuItem>
              )}
              {project.status === 'paused' && (
                <DropdownMenuItem onClick={() => onChangeStatus('active')}>
                  <PlayCircle className="h-4 w-4 mr-2" /> Retomar obra
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete()}>
                <Trash2 className="h-4 w-4 mr-2" /> Excluir obra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </CollapsibleTrigger>
  );
}
