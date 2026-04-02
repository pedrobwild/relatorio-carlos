import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { useJourneyStagesSummary } from '@/hooks/useJourneyStagesSummary';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import type { ProjectWithCustomer } from '@/infra/repositories';

const statusColors: Record<string, string> = {
  active: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  completed: 'bg-primary/10 text-primary border-primary/20',
  paused: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

const stageStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  waiting_action: 'Aguardando ação',
  completed: 'Concluída',
};

const stageStatusColors: Record<string, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-primary',
  waiting_action: 'text-[hsl(var(--warning))]',
  completed: 'text-[hsl(var(--success))]',
};

interface Props {
  projects: ProjectWithCustomer[];
}

export function ProjectsListViewProjetos({ projects }: Props) {
  const navigate = useNavigate();
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { data: stagesMap, isLoading } = useJourneyStagesSummary(projectIds);

  if (isLoading) {
    return <ContentSkeleton variant="table" rows={5} />;
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px] text-xs whitespace-nowrap">Projeto</TableHead>
              <TableHead className="w-[80px] text-center text-xs whitespace-nowrap">Status</TableHead>
              <TableHead className="min-w-[160px] text-xs whitespace-nowrap">Etapa Atual</TableHead>
              <TableHead className="w-[100px] text-center text-xs whitespace-nowrap">Status Etapa</TableHead>
              <TableHead className="w-[80px] text-center text-xs whitespace-nowrap">Progresso</TableHead>
              <TableHead className="w-[100px] text-center text-xs whitespace-nowrap">Tempo na Etapa</TableHead>
              <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Engenheiro</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const stage = stagesMap?.get(project.id);
              return (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/obra/${project.id}`)}
                >
                  {/* Name */}
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

                  {/* Current Stage Name */}
                  <TableCell>
                    {stage ? (
                      <span className="text-sm font-medium">{stage.currentStageName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sem etapas</span>
                    )}
                  </TableCell>

                  {/* Stage Status */}
                  <TableCell className="text-center">
                    {stage ? (
                      <span className={`text-xs font-medium ${stageStatusColors[stage.currentStageStatus] || 'text-muted-foreground'}`}>
                        {stageStatusLabels[stage.currentStageStatus] || stage.currentStageStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Stage Progress (e.g., 3/8) */}
                  <TableCell className="text-center">
                    {stage ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs font-medium tabular-nums">
                            {stage.stageIndex}/{stage.totalStages}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Etapa {stage.stageIndex} de {stage.totalStages}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Days in Stage */}
                  <TableCell className="text-center">
                    {stage ? (
                      <div className="flex items-center justify-center gap-1">
                        {stage.daysInStage > 14 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                        )}
                        <Clock className={`h-3.5 w-3.5 ${stage.daysInStage > 14 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium tabular-nums ${stage.daysInStage > 14 ? 'text-[hsl(var(--warning))]' : ''}`}>
                          {stage.daysInStage}d
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Engineer */}
                  <TableCell>
                    <span className="text-sm truncate block max-w-[120px]">
                      {project.engineer_name || <span className="text-muted-foreground italic text-xs">Não atribuído</span>}
                    </span>
                  </TableCell>

                  {/* Action */}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Ver portal"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhum projeto encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
