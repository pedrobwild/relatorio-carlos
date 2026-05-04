import { useMemo } from 'react';
import { ChevronRight, AlertCircle, ClipboardSignature, FileText, Compass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SCurveSparkline } from '@/components/scurve/SCurveSparkline';
import { StatusBadge } from '@/components/ui-premium';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';
import type { Activity } from '@/types/report';

interface ProjectDashboardCardProps {
  project: ProjectSummary;
  onClick: () => void;
  activities?: Activity[];
}

const statusLabels: Record<string, string> = {
  active: 'Em andamento',
  completed: 'Concluído',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};

const statusVariants: Record<string, string> = {
  active: 'bg-primary/10 text-primary border-primary/20',
  completed: 'bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  paused: 'bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

/**
 * Resume a próxima ação do projeto a partir dos contadores agregados em
 * ProjectSummary. Determina título humano e dono da bola sem consultar
 * dados extras (mantém o card barato de renderizar em listagens longas).
 */
function deriveNextAction(project: ProjectSummary): {
  label: string;
  owner: 'client' | 'bwild';
  tone: 'warning' | 'info' | 'success' | 'muted';
} {
  if (!project) return { label: 'Aguardando atualização', owner: 'bwild', tone: 'muted' };
  if (project.status !== 'active') {
    return { label: 'Sem ações pendentes nesta obra', owner: 'bwild', tone: 'muted' };
  }
  if ((project.overdue_count ?? 0) > 0) {
    return {
      label: `Resolver ${project.overdue_count} pendência(s) atrasada(s)`,
      owner: 'client',
      tone: 'warning',
    };
  }
  if ((project.unsigned_formalizations ?? 0) > 0) {
    return {
      label: `Assinar ${project.unsigned_formalizations} formalização(ões)`,
      owner: 'client',
      tone: 'warning',
    };
  }
  if ((project.pending_count ?? 0) > 0) {
    return {
      label: `Decidir ${project.pending_count} item(ns) pendente(s)`,
      owner: 'client',
      tone: 'warning',
    };
  }
  if ((project.pending_documents ?? 0) > 0) {
    return {
      label: `Aguardando ${project.pending_documents} documento(s) da BWild`,
      owner: 'bwild',
      tone: 'info',
    };
  }
  return { label: 'Tudo em dia — acompanhar evolução', owner: 'bwild', tone: 'success' };
}

export function ProjectDashboardCard({ project, onClick, activities }: ProjectDashboardCardProps) {
  const isActive = project.status === 'active';
  const progress = project.progress_percentage || 0;
  const nextAction = useMemo(() => deriveNextAction(project), [project]);

  const alerts = useMemo(() => {
    const items: Array<{ icon: React.ElementType; label: string; accent: string }> = [];
    if (project.pending_count > 0) {
      items.push({ icon: AlertCircle, label: `${project.pending_count} pendência(s)`, accent: 'text-[hsl(var(--warning))]' });
    }
    if (project.unsigned_formalizations > 0) {
      items.push({ icon: ClipboardSignature, label: `${project.unsigned_formalizations} assinatura(s)`, accent: 'text-[hsl(var(--warning))]' });
    }
    if (project.pending_documents > 0) {
      items.push({ icon: FileText, label: `${project.pending_documents} doc(s)`, accent: 'text-primary' });
    }
    return items;
  }, [project]);

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
        {/* Row 1: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-semibold truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.org_name && (
              <p className="text-tiny text-muted-foreground truncate">{project.org_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-tiny px-2 py-0.5 ${statusVariants[project.status] || ''}`}>
              {statusLabels[project.status] || project.status}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
          </div>
        </div>

        {/* Row 2: Progress bar (only for active non-project-phase) */}
        {isActive && (
          <div className="space-y-1.5">
            {/* S-Curve Sparkline */}
            {activities && activities.length > 0 && (
                <ErrorBoundary name="SCurveSparkline" feature="general" fallback={null}>
                  <SCurveSparkline activities={activities} height={44} />
                </ErrorBoundary>
            )}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-tiny text-muted-foreground">
              <span>{Math.round(progress)}% concluído</span>
              {project.user_role && (
                <span className="capitalize">{project.user_role === 'owner' ? 'Proprietário' : project.user_role}</span>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Próxima ação + responsável */}
        {isActive && (
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Compass className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate flex-1">
              <span className="font-medium text-foreground/80">Próxima ação:</span>{' '}
              {nextAction.label}
            </span>
            <StatusBadge tone={nextAction.tone === 'success' ? 'success' : nextAction.tone === 'info' ? 'info' : nextAction.tone === 'warning' ? 'warning' : 'muted'} size="sm" showDot={false}>
              {nextAction.owner === 'client' ? 'Você' : 'BWild'}
            </StatusBadge>
          </div>
        )}

        {/* Row 4: Alerts / Action Items */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert, i) => (
              <span key={i} className={`flex items-center gap-1 text-tiny ${alert.accent}`}>
                <alert.icon className="h-3 w-3" />
                {alert.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
