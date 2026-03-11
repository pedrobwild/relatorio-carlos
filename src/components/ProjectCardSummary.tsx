import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/activityStatus';
import type { ProjectWithCustomer } from '@/infra/repositories';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcWeightedProgress } from '@/lib/progressCalc';

type ProjectData = ProjectWithCustomer & { is_project_phase?: boolean };

interface ProjectCardSummaryProps {
  project: ProjectData;
  onClick: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────
function safeFormat(dateStr: string | null | undefined, fmt = 'dd/MM/yy'): string | null {
  if (!dateStr) return null;
  try {
    return format(parseLocalDate(dateStr), fmt, { locale: ptBR });
  } catch {
    return null;
  }
}

/** Fetch current journey stage name for a project */
function useCurrentJourneyStage(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['project-current-stage', projectId],
    queryFn: async () => {
      // Get the first non-completed stage (current stage)
      const { data } = await supabase
        .from('journey_stages')
        .select('name, status')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (!data || data.length === 0) return null;
      const current = data.find(s => s.status !== 'completed');
      return current?.name ?? data[data.length - 1]?.name ?? null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch current cronograma activity (etapa) for obra projects */
function useCurrentObraEtapa(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['project-current-etapa', projectId],
    queryFn: async () => {
      // Get in-progress activities, or the next planned one
      const { data } = await supabase
        .from('atividades')
        .select('titulo, etapa, status, data_prevista_fim')
        .eq('obra_id', projectId)
        .in('status', ['em_andamento', 'nao_iniciada'])
        .order('data_prevista_fim', { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        return data[0].etapa || data[0].titulo;
      }
      return null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Fetch activity-based progress ──────────────────────────────────────
function useActivityProgress(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['project-activity-progress', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_activities')
        .select('weight, actual_end')
        .eq('project_id', projectId);
      if (!data || data.length === 0) return 0;
      return calcWeightedProgress(data.map(a => ({ weight: Number(a.weight) || 0, actualEnd: a.actual_end })));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Component ──────────────────────────────────────────────────────────
export function ProjectCardSummary({ project, onClick }: ProjectCardSummaryProps) {
  const isProjectPhase = !!project.is_project_phase;
  const isActive = project.status === 'active';

  // Fetch current stage info
  const { data: journeyStageName } = useCurrentJourneyStage(project.id, isProjectPhase && isActive);
  const { data: obraEtapa } = useCurrentObraEtapa(project.id, !isProjectPhase && isActive);
  
  // Fetch activity-based progress (unified calculation)
  const { data: progress = 0 } = useActivityProgress(project.id, !isProjectPhase && isActive);

  const isCompletedJourney = isProjectPhase && project.status === 'completed';

  // Current stage label
  const currentStageLabel = useMemo(() => {
    if (isCompletedJourney) return null;
    if (!isActive) return null;
    if (isProjectPhase) {
      return journeyStageName ? `Etapa atual: ${journeyStageName}` : 'Em acompanhamento';
    }
    return obraEtapa ? `Etapa atual: ${obraEtapa}` : 'Em acompanhamento';
  }, [isActive, isProjectPhase, isCompletedJourney, journeyStageName, obraEtapa]);

  // Time info
  const timeInfo = useMemo(() => {
    if (isCompletedJourney) return 'Jornada de Projeto Concluída';
    if (isProjectPhase) {
      const start = safeFormat(project.planned_start_date);
      const end = safeFormat(project.planned_end_date);
      if (!start && !end) return 'Datas em alinhamento';
      if (start && end) return `Período estimado: ${start} – ${end}`;
      if (end) return `Entrega estimada: ${end}`;
      return 'Datas em alinhamento';
    }
    const end = safeFormat(project.planned_end_date);
    if (end) return `Entrega estimada: ${end}`;
    const start = safeFormat(project.planned_start_date);
    if (start) return `Início estimado: ${start}`;
    return 'Datas em alinhamento';
  }, [isProjectPhase, isCompletedJourney, project.planned_start_date, project.planned_end_date]);

  // Sub-label (unit / code)
  const subLabel = project.unit_name || undefined;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      tabIndex={0}
      role="button"
      aria-label={`Abrir detalhes de ${project.name}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* ── BLOCO 1: Identificação ──────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-semibold truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {subLabel && (
              <p className="text-caption text-muted-foreground truncate">{subLabel}</p>
            )}
          </div>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-0.5"
            aria-hidden="true"
          />
        </div>

        {/* ── BLOCO 2: Etapa atual ────────────────────────────────── */}
        {currentStageLabel && (
          <p className="text-caption text-muted-foreground leading-snug">
            {currentStageLabel}
          </p>
        )}

        {/* ── BLOCO 3: Tempo & Progresso ──────────────────────────── */}
        {isActive && !isProjectPhase && (
          <div className="space-y-1.5">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-tiny text-muted-foreground">
              <span>{Math.round(progress)}% concluído</span>
              <span>{timeInfo}</span>
            </div>
          </div>
        )}

        {isCompletedJourney && (
          <p className="text-tiny font-medium text-[hsl(var(--success))]">{timeInfo}</p>
        )}

        {!isCompletedJourney && (isProjectPhase || !isActive) && (
          <p className="text-tiny text-muted-foreground">{timeInfo}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectCardSummary;
