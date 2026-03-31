import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, AlertTriangle, FileSignature, FileText, CheckCircle, Clock } from 'lucide-react';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { useProjectSummaryQuery } from '@/hooks/useProjectsQuery';
import { ContentSkeleton } from '@/components/ContentSkeleton';
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

interface ProjectsListViewProps {
  projects: ProjectWithCustomer[];
}

export function ProjectsListView({ projects }: ProjectsListViewProps) {
  const navigate = useNavigate();
  const { data: summaries = [], isLoading: summariesLoading } = useProjectSummaryQuery();

  // Map summaries by project id for O(1) lookup
  const summaryMap = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    for (const s of summaries) {
      map.set(s.id, s);
    }
    return map;
  }, [summaries]);

  if (summariesLoading) {
    return <ContentSkeleton variant="table" rows={5} />;
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Obra</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
              <TableHead className="w-[60px] text-center">Saúde</TableHead>
              <TableHead className="w-[100px] text-center">Prazo</TableHead>
              <TableHead className="w-[70px] text-center">Progresso</TableHead>
              <TableHead className="min-w-[120px]">Engenheiro</TableHead>
              <TableHead className="w-[90px] text-center">Pendências</TableHead>
              <TableHead className="w-[90px] text-center">Assinaturas</TableHead>
              <TableHead className="w-[80px] text-center">Docs</TableHead>
              <TableHead className="w-[120px] text-center">Financeiro</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const summary = summaryMap.get(project.id);
              return (
                <ProjectRow
                  key={project.id}
                  project={project}
                  summary={summary}
                  onNavigate={() => navigate(`/obra/${project.id}`)}
                />
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

function ProjectRow({
  project,
  summary,
  onNavigate,
}: {
  project: ProjectWithCustomer;
  summary?: ProjectSummary;
  onNavigate: () => void;
}) {
  const pendingCount = summary?.pending_count ?? 0;
  const overdueCount = summary?.overdue_count ?? 0;
  const unsignedFormalizations = summary?.unsigned_formalizations ?? 0;
  const pendingDocs = summary?.pending_documents ?? 0;
  const progress = summary?.progress_percentage ?? 0;
  const contractValue = project.contract_value ?? 0;

  // Financial: calculate paid percentage from summary if available
  const paidPct = contractValue > 0 && summary
    ? Math.min(100, Math.round(progress)) // approximate from progress
    : null;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onNavigate}
    >
      {/* Name + Customer */}
      <TableCell>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{project.name}</p>
          {project.customer_name && (
            <p className="text-xs text-muted-foreground truncate">{project.customer_name}</p>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="text-center">
        <Badge variant="outline" className={`${statusColors[project.status]} text-[10px] whitespace-nowrap`}>
          {statusLabels[project.status]}
        </Badge>
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
            // Already navigates on row click
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
