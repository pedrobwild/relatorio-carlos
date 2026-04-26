/**
 * Visão "Semana · Lista" do Calendário de Obras: cards agrupados por obra
 * com ações de iniciar / concluir / resetar atividade no dia atual.
 */
import { format, isWithinInterval, parseISO } from 'date-fns';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import type { WeekActivity } from '@/hooks/useWeekActivities';
import { STATUS_BADGE, getActivityStatus } from './types';

interface ProjectGroup {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  items: WeekActivity[];
}

interface WeekListViewProps {
  filteredByProject: ProjectGroup[];
  today: Date;
  weekStart: Date;
  weekEnd: Date;
  isUpdating: boolean;
  onActivityClick: (a: WeekActivity) => void;
  onStart: (a: WeekActivity) => void;
  onFinish: (a: WeekActivity) => void;
  onReset: (a: WeekActivity) => void;
  onOpenSchedule: (projectId: string) => void;
  projectFilter: string;
}

export function WeekListView({
  filteredByProject,
  today,
  weekStart,
  weekEnd,
  isUpdating,
  onActivityClick,
  onStart,
  onFinish,
  onReset,
  onOpenSchedule,
  projectFilter,
}: WeekListViewProps) {
  if (filteredByProject.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={projectFilter === 'all' ? 'Nenhuma atividade programada' : 'Nenhuma atividade para esta obra'}
        description={
          projectFilter === 'all'
            ? 'Não há atividades planejadas para esta semana em nenhuma obra.'
            : 'Esta obra não possui atividades planejadas para a semana selecionada.'
        }
      />
    );
  }
  const inThisWeek = isWithinInterval(today, { start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      {filteredByProject.map((group) => {
        const color = getProjectColor(group.project_id);
        return (
          <Card key={group.project_id} className={cn('overflow-hidden border-l-4', color.border)}>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={cn('inline-flex items-center justify-center h-7 w-7 rounded-md shrink-0', color.bg)}>
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-semibold truncate">{group.project_name}</CardTitle>
                    {group.client_name && (
                      <div className="text-xs text-muted-foreground truncate">Cliente: {group.client_name}</div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {group.items.length} ativ.
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenSchedule(group.project_id)}
                  className="h-7 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver cronograma
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {group.items.map((a) => {
                const status = getActivityStatus(a, today);
                const sb = STATUS_BADGE[status];
                const ps = parseISO(a.planned_start);
                const pe = parseISO(a.planned_end);
                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onActivityClick(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onActivityClick(a);
                      }
                    }}
                    className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer focus:outline-none focus-visible:bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{a.description}</span>
                        {a.etapa && <Badge variant="outline" className="text-[10px]">{a.etapa}</Badge>}
                        <Badge className={cn('text-[10px]', sb.className)}>{sb.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          Previsto: <strong>{format(ps, 'dd/MM')}</strong> →{' '}
                          <strong>{format(pe, 'dd/MM')}</strong>
                        </span>
                        {a.actual_start && (
                          <span className="text-blue-600">
                            Início real: <strong>{format(parseISO(a.actual_start), 'dd/MM')}</strong>
                          </span>
                        )}
                        {a.actual_end && (
                          <span className="text-green-600">
                            Fim real: <strong>{format(parseISO(a.actual_end), 'dd/MM')}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!a.actual_start && !a.actual_end && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => onStart(a)}
                          title={inThisWeek ? 'Marcar início real como hoje' : 'Marcar início real como hoje (data atual do sistema)'}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      {!a.actual_end && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isUpdating}
                          onClick={() => onFinish(a)}
                          title="Marcar conclusão real como hoje"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Concluir
                        </Button>
                      )}
                      {(a.actual_start || a.actual_end) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isUpdating}
                          onClick={() => onReset(a)}
                          title="Limpar datas reais"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
