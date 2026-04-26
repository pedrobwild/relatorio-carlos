import { useMemo } from 'react';
import { ChevronRight, AlertCircle, ClipboardSignature, FileText, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
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

export function ProjectDashboardCard({ project, onClick, activities }: ProjectDashboardCardProps) {
  const isActive = project.status === 'active';
  const progress = project.progress_percentage || 0;

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

  // "Próxima ação" derivada dos contadores do summary (Issue #18).
  // Microcopy diferente quando a bola está com o cliente vs. com a BWild.
  const nextAction = useMemo(() => {
    if (project.status === 'completed') {
      return { owner: 'bwild' as const, tone: 'success' as const, icon: CheckCircle2, text: 'Obra concluída — nenhuma ação pendente.' };
    }
    if (project.overdue_count > 0) {
      return {
        owner: 'client' as const,
        tone: 'danger' as const,
        icon: AlertCircle,
        text: `Resolver ${project.overdue_count} pendência(s) atrasada(s) — ação sua`,
      };
    }
    if (project.unsigned_formalizations > 0) {
      return {
        owner: 'client' as const,
        tone: 'warning' as const,
        icon: ClipboardSignature,
        text: `Assinar ${project.unsigned_formalizations} formalização(ões) — ação sua`,
      };
    }
    if (project.pending_count > 0) {
      return {
        owner: 'client' as const,
        tone: 'warning' as const,
        icon: AlertCircle,
        text: `${project.pending_count} pendência(s) aguardando você — ação sua`,
      };
    }
    if (project.status === 'paused') {
      return { owner: 'bwild' as const, tone: 'muted' as const, icon: Clock, text: 'Obra pausada — aguardando retomada' };
    }
    return { owner: 'bwild' as const, tone: 'info' as const, icon: ArrowRight, text: 'Equipe BWild executando — sem ação sua agora' };
  }, [project.status, project.overdue_count, project.unsigned_formalizations, project.pending_count]);

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

        {/* Row 3: Próxima ação (sempre presente) — Issue #18 */}
        <div className="flex items-center gap-2 text-caption pt-1">
          <StatusBadge tone={nextAction.tone} size="sm" showDot icon={<nextAction.icon />}>
            {nextAction.owner === 'client' ? 'Sua vez' : 'Bola BWild'}
          </StatusBadge>
          <span className="text-muted-foreground truncate min-w-0 flex-1">{nextAction.text}</span>
        </div>

        {/* Row 4: Alerts / Action Items (resumo numérico) */}
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
