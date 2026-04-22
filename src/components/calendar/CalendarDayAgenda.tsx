/**
 * CalendarDayAgenda — single-day list of activities scheduled (planned interval
 * intersects the chosen day). Grouped by project, with quick visibility of
 * status and a click to open the detail dialog.
 */
import { useMemo } from 'react';
import { format, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import type { WeekActivity } from '@/hooks/useWeekActivities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';

const statusBadge: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  in_progress: { label: 'Em andamento', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  overdue: { label: 'Atrasada', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

function statusOf(a: WeekActivity, today: Date) {
  if (a.actual_end) return 'completed' as const;
  if (a.actual_start) return 'in_progress' as const;
  if (today > parseISO(a.planned_start)) return 'overdue' as const;
  return 'pending' as const;
}

interface Props {
  day: Date;
  activities: WeekActivity[];
  onActivityClick: (a: WeekActivity) => void;
}

export function CalendarDayAgenda({ day, activities, onActivityClick }: Props) {
  const today = new Date();
  const dayActivities = useMemo(
    () =>
      activities.filter((a) =>
        isWithinInterval(day, { start: parseISO(a.planned_start), end: parseISO(a.planned_end) }),
      ),
    [activities, day.getTime()],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, { project_id: string; project_name: string; items: WeekActivity[] }>();
    for (const a of dayActivities) {
      if (!m.has(a.project_id)) {
        m.set(a.project_id, { project_id: a.project_id, project_name: a.project_name, items: [] });
      }
      m.get(a.project_id)!.items.push(a);
    }
    return Array.from(m.values()).sort((x, y) =>
      x.project_name.localeCompare(y.project_name, 'pt-BR'),
    );
  }, [dayActivities]);

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhuma atividade neste dia"
        description={`Não há atividades planejadas para ${format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {format(day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })} · {dayActivities.length} atividade(s)
      </div>
      {grouped.map((g) => {
        const color = getProjectColor(g.project_id);
        return (
          <Card key={g.project_id} className={cn('overflow-hidden border-l-4', color.border)}>
            <CardHeader className="py-2.5 px-4 border-b">
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md', color.bg)}>
                  <Building2 className="h-4 w-4" />
                </span>
                <CardTitle className="text-sm font-semibold truncate">{g.project_name}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{g.items.length} ativ.</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {g.items.map((a) => {
                const s = statusOf(a, today);
                const sb = statusBadge[s];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onActivityClick(a)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/40 transition-colors flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Previsto: {format(parseISO(a.planned_start), 'dd/MM')} →{' '}
                        {format(parseISO(a.planned_end), 'dd/MM')}
                        {a.etapa && <span className="ml-2">· {a.etapa}</span>}
                      </div>
                    </div>
                    <Badge className={cn('text-[10px]', sb.className)}>{sb.label}</Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
