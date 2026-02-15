import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Circle, ClipboardList, Box, Ruler, FileText, FileCheck, CheckCircle, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { JourneyStage, JourneyStageStatus } from '@/hooks/useProjectJourney';

const statusLabels: Record<JourneyStageStatus, string> = {
  pending: 'Em breve',
  waiting_action: 'Aguardando sua ação',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

const statusBadgeColor: Record<JourneyStageStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  waiting_action: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const statusIconBg: Record<JourneyStageStatus, string> = {
  pending: 'bg-muted',
  waiting_action: 'bg-amber-100',
  in_progress: 'bg-blue-100',
  completed: 'bg-green-100',
};

const statusIconColor: Record<JourneyStageStatus, string> = {
  pending: 'text-muted-foreground',
  waiting_action: 'text-amber-600',
  in_progress: 'text-blue-600',
  completed: 'text-green-600',
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'clipboard-list': ClipboardList,
  'box': Box,
  'ruler': Ruler,
  'file-text': FileText,
  'file-check': FileCheck,
  'check-circle': CheckCircle,
  'circle': Circle,
};

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return iconMap[iconName] || Circle;
}

function getDisplayDate(stage: JourneyStage): string | null {
  // Show confirmed date if available, otherwise proposed
  const dateStr = stage.confirmed_start || stage.proposed_start;
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
  } catch {
    return null;
  }
}

interface StageSummaryProps {
  stage: JourneyStage;
  isExpanded: boolean;
}

export function StageSummary({ stage, isExpanded }: StageSummaryProps) {
  const Icon = getIcon(stage.icon);
  const displayDate = getDisplayDate(stage);
  const isConfirmed = !!stage.confirmed_start;

  // Count completed todos
  const totalTodos = stage.todos.length;
  const completedTodos = stage.todos.filter(t => t.completed).length;

  return (
    <div className="flex items-center gap-3 md:gap-4">
      {/* Icon */}
      <div
        className={cn(
          "p-2.5 md:p-3 rounded-lg shrink-0",
          statusIconBg[stage.status]
        )}
      >
        <Icon className={cn("h-5 w-5", statusIconColor[stage.status])} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start md:items-center gap-2 flex-col md:flex-row">
          <span className="text-base md:text-lg font-semibold leading-tight">{stage.name}</span>
          <Badge className={cn("text-[10px] md:text-xs whitespace-nowrap", statusBadgeColor[stage.status])}>
            {statusLabels[stage.status]}
          </Badge>
        </div>

        {/* Compact info row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {stage.responsible && (
            <span className="text-xs text-muted-foreground">
              {stage.responsible}
            </span>
          )}
          {displayDate && (
            <span className={cn(
              "text-xs inline-flex items-center gap-1",
              isConfirmed ? "text-green-700 font-medium" : "text-muted-foreground"
            )}>
              <CalendarDays className="h-3 w-3" />
              {displayDate}
              {isConfirmed && <CheckCircle className="h-3 w-3" />}
            </span>
          )}
          {totalTodos > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedTodos}/{totalTodos} itens
            </span>
          )}
        </div>
      </div>

      {/* Expand indicator */}
      <div className="h-10 w-10 flex items-center justify-center shrink-0">
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
