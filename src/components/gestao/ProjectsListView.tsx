import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalLink, AlertTriangle, FileSignature, FileText, CheckCircle, Clock, ChevronDown, MapPin, Ruler, Key } from 'lucide-react';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { ObraExpandedRow } from '@/components/admin/obras/ObraExpandedRow';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  paused: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
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
              <TableHead className="w-[100px] text-center text-xs whitespace-nowrap">Prazo</TableHead>
              <TableHead className="w-[70px] text-center text-xs whitespace-nowrap">Progresso</TableHead>
              <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Engenheiro</TableHead>
              <TableHead className="w-[90px] text-center text-xs whitespace-nowrap">Pendências</TableHead>
              <TableHead className="w-[90px] text-center text-xs whitespace-nowrap">Assinaturas</TableHead>
              <TableHead className="w-[80px] text-center text-xs whitespace-nowrap">Docs</TableHead>
              <TableHead className="w-[120px] text-center text-xs whitespace-nowrap">Financeiro</TableHead>
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
                      onNavigate={() => navigate(`/obra/${project.id}`)}
                    />
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/30">
                        <TableCell colSpan={12} className="p-0">
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
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
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
      {/* Studio info row */}
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
      {/* Dashboard summary */}
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
  const unsignedFormalizations = summary?.unsigned_formalizations ?? 0;
  const pendingDocs = summary?.pending_documents ?? 0;
  const progress = summary?.progress_percentage ?? 0;
  const contractValue = project.contract_value ?? 0;

  const today = getTodayLocal();
  const plannedEnd = project.planned_end_date ? parseLocalDate(project.planned_end_date) : null;
  const actualEnd = project.actual_end_date ? parseLocalDate(project.actual_end_date) : null;
  const isFinished = !!actualEnd;
  const daysRemaining = plannedEnd && !isFinished ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  return (
    <CollapsibleTrigger asChild>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors"
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
            <p className="font-medium text-sm truncate">{project.name}</p>
            {project.customer_name && (
              <p className="text-xs text-muted-foreground truncate">{project.customer_name}</p>
            )}
          </div>
        </TableCell>

        {/* Status — composite label */}
        <TableCell className="text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-0.5">
                <Badge variant="outline" className={`${statusColors[project.status]} text-[10px] whitespace-nowrap cursor-help`}>
                  {statusLabels[project.status]}
                </Badge>
                {project.is_project_phase && (
                  <span className="text-[10px] text-purple-600 font-medium">Fase Projeto</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">
              <p className="text-xs font-medium mb-1">Status da Obra: {statusLabels[project.status]}</p>
              <p className="text-xs text-muted-foreground">{statusTooltips[project.status]}</p>
              {project.is_project_phase && (
                <p className="text-xs text-purple-600 mt-1">Fase de Projeto — planejamento e aprovações</p>
              )}
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

        {/* Prazo */}
        <TableCell className="text-center">
          {plannedEnd ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {project.planned_start_date && format(parseLocalDate(project.planned_start_date), 'dd/MM', { locale: ptBR })} – {format(plannedEnd, 'dd/MM', { locale: ptBR })}
                  </span>
                  {isFinished ? (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-[hsl(var(--success))]">
                      <CheckCircle className="h-3 w-3" /> Entregue
                    </span>
                  ) : isOverdue ? (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3" /> {Math.abs(daysRemaining!)}d atraso
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-[hsl(var(--success))]">
                      <Clock className="h-3 w-3" /> {daysRemaining}d restantes
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Início: {project.planned_start_date ? format(parseLocalDate(project.planned_start_date), 'dd/MM/yyyy') : 'N/D'}<br />
                Término: {format(plannedEnd, 'dd/MM/yyyy')}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground italic">A definir</span>
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

        {/* Formalizations */}
        <TableCell className="text-center">
          {unsignedFormalizations === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-1">
                  <FileSignature className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                  <span className="text-sm font-medium text-[hsl(var(--warning))]">{unsignedFormalizations}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{unsignedFormalizations} assinatura(s) pendente(s)</TooltipContent>
            </Tooltip>
          )}
        </TableCell>

        {/* Documents */}
        <TableCell className="text-center">
          {pendingDocs === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                  <span className="text-sm font-medium text-[hsl(var(--warning))]">{pendingDocs}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{pendingDocs} documento(s) pendente(s)</TooltipContent>
            </Tooltip>
          )}
        </TableCell>

        {/* Financial */}
        <TableCell className="text-center">
          {contractValue > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-medium tabular-nums">
                  R$ {(contractValue / 1000).toFixed(0)}k
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Contrato: R$ {contractValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
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
