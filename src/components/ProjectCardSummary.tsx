import { useMemo } from 'react';
import { ChevronRight, Briefcase, HardHat } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/activityStatus';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';

type ProjectData = ProjectWithCustomer & { is_project_phase?: boolean };

interface ProjectCardSummaryProps {
  project: ProjectData;
  onClick: () => void;
}

// ── Status visual tokens (soft, low-tension) ──────────────────────────
const statusStyles: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  completed: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  paused: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Encerrada',
};

// ── Helpers ────────────────────────────────────────────────────────────
function safeFormat(dateStr: string | null | undefined, fmt = 'dd/MM/yy'): string | null {
  if (!dateStr) return null;
  try {
    return format(parseLocalDate(dateStr), fmt, { locale: ptBR });
  } catch {
    return null;
  }
}

// ── Component ──────────────────────────────────────────────────────────
export function ProjectCardSummary({ project, onClick }: ProjectCardSummaryProps) {
  const isProjectPhase = !!project.is_project_phase;
  const isActive = project.status === 'active';

  // Progress (only for obra in execution)
  const progress = useMemo(() => {
    if (isProjectPhase || !isActive) return 0;
    const rawStart = project.actual_start_date || project.planned_start_date;
    const rawEnd = project.planned_end_date;
    if (!rawStart || !rawEnd) return 0;
    const start = parseLocalDate(rawStart);
    const end = parseLocalDate(rawEnd);
    const now = Date.now();
    if (now < start.getTime()) return 0;
    const total = end.getTime() - start.getTime();
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, ((now - start.getTime()) / total) * 100));
  }, [isProjectPhase, isActive, project.actual_start_date, project.planned_start_date, project.planned_end_date]);

  // Time info
  const timeInfo = useMemo(() => {
    if (isProjectPhase) {
      // Fase de Projeto: show "Datas em alinhamento" or period if available
      const start = safeFormat(project.planned_start_date);
      const end = safeFormat(project.planned_end_date);
      if (!start && !end) return 'Datas em alinhamento';
      if (start && end) return `Período estimado: ${start} – ${end}`;
      if (end) return `Entrega estimada: ${end}`;
      return 'Datas em alinhamento';
    }
    // Obra: show delivery estimate
    const end = safeFormat(project.planned_end_date);
    if (end) return `Entrega estimada: ${end}`;
    const start = safeFormat(project.planned_start_date);
    if (start) return `Início estimado: ${start}`;
    return 'Datas em alinhamento';
  }, [isProjectPhase, project.planned_start_date, project.planned_end_date]);

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

        {/* ── BLOCO 2: Chips de contexto ──────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn('text-xs', statusStyles[project.status] ?? statusStyles.active)}
          >
            {statusLabels[project.status] ?? project.status}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs bg-muted/50 text-muted-foreground border-border"
          >
            {isProjectPhase ? (
              <><Briefcase className="h-3 w-3 mr-1" aria-hidden="true" />Fase de Projeto</>
            ) : (
              <><HardHat className="h-3 w-3 mr-1" aria-hidden="true" />Fase de Obra</>
            )}
          </Badge>
        </div>

        {/* ── BLOCO 3: Próximo passo ──────────────────────────────── */}
        <p className="text-caption text-muted-foreground leading-snug">
          Em acompanhamento pela equipe Bwild
        </p>

        {/* ── BLOCO 4: Tempo & Progresso ──────────────────────────── */}
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

        {(isProjectPhase || !isActive) && (
          <p className="text-tiny text-muted-foreground">{timeInfo}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectCardSummary;
