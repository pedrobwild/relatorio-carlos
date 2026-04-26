/**
 * ProjectStatusBadge — pílula única para status de obra/projeto.
 *
 * Une três coisas que estavam dispersas pelas telas de gestão:
 *   1. Label e tom semântico do status (`PROJECT_STATUS_LABEL` /
 *      `PROJECT_STATUS_TONE` em `lib/statusTones`).
 *   2. Sobreposição de "Atrasada" quando o projeto ativo passou do
 *      planned_end_date (`getProjectDelayInfo` em `lib/projectHealth`).
 *   3. Tooltip explicativo — pré-requisito de acessibilidade da issue #16:
 *      "Badge de atraso com tooltip explicativo".
 *
 * Antes existiam pelo menos 3 cópias desse mapeamento (ProjectsListView,
 * WorkQuickPreviewDrawer, MobileProjectList), cada uma com paleta levemente
 * diferente. Este componente é a única fonte da verdade.
 */
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatusBadge, type StatusSize } from '@/components/ui-premium';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  getLabel,
  getTone,
} from '@/lib/statusTones';
import { getProjectDelayInfo } from '@/lib/projectHealth';
import { getTemporalStatusLabel } from '@/lib/temporalStatus';
import { formatBR } from '@/lib/dates';

export interface ProjectStatusBadgeProject {
  status: string;
  created_at?: string | null;
  planned_end_date?: string | null;
  actual_end_date?: string | null;
}

interface ProjectStatusBadgeProps {
  project: ProjectStatusBadgeProject;
  /**
   * `last_activity_at` de `ProjectSummary`, usado para enriquecer o tooltip
   * com "Em andamento há 3 semanas" — opcional.
   */
  statusChangedAt?: string | null;
  /** Compact (sm) por padrão; use `md` em headers de detalhe. */
  size?: StatusSize;
  className?: string;
}

export function ProjectStatusBadge({
  project,
  statusChangedAt = null,
  size = 'sm',
  className,
}: ProjectStatusBadgeProps) {
  const delay = getProjectDelayInfo(project);
  // Note: getProjectDelayInfo only returns non-null when both status==='active'
  // and planned_end_date is set, so the optional-chain narrows safely below.
  const overdue = delay?.isOverdue ? delay : null;

  const baseLabel = getLabel(PROJECT_STATUS_LABEL, project.status, project.status);
  const baseTone = getTone(PROJECT_STATUS_TONE, project.status, 'neutral');

  // Atraso "promove" o tom para danger e troca o rótulo para "Atrasada".
  // O status original ainda aparece no tooltip para o usuário não perder
  // contexto ("estava ativa, mas passou do prazo").
  const label = overdue ? 'Atrasada' : baseLabel;
  const tone = overdue ? 'danger' : baseTone;

  const tooltipText = overdue
    ? buildOverdueTooltip(baseLabel, overdue.daysOverdue, overdue.plannedEnd)
    : getTemporalStatusLabel(project.status, statusChangedAt, project.created_at ?? null);

  const badge = (
    <StatusBadge
      tone={tone}
      size={size}
      className={className}
      icon={overdue ? <AlertTriangle aria-hidden /> : undefined}
      showDot={!overdue}
    >
      {label}
    </StatusBadge>
  );

  if (!tooltipText) return badge;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex outline-none">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs whitespace-pre-line">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function buildOverdueTooltip(
  baseLabel: string,
  daysOverdue: number,
  plannedEnd: Date,
): string {
  const dueLabel = formatBR(plannedEnd, 'dd/MM/yyyy');
  const daysLabel = daysOverdue === 1 ? '1 dia de atraso' : `${daysOverdue} dias de atraso`;
  return `Status original: ${baseLabel}\nPrazo: ${dueLabel}\n${daysLabel}`;
}
