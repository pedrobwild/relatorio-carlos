import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addWeeks, endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import { useWeekActivities, type WeekActivity } from '@/hooks/useWeekActivities';
import { EmptyState } from '@/components/ui/states';

const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function getActivityStatus(a: WeekActivity, today: Date) {
  if (a.actual_end) return 'completed' as const;
  if (a.actual_start) return 'in_progress' as const;
  const plannedStart = parseISO(a.planned_start);
  if (today > plannedStart) return 'overdue' as const;
  return 'pending' as const;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  in_progress: { label: 'Em andamento', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  overdue: { label: 'Atrasada', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

export default function CalendarioObras() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [refDate, setRefDate] = useState<Date>(today);

  const weekStartDate = startOfWeek(refDate, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(refDate, { weekStartsOn: 1 });
  const weekStart = format(weekStartDate, 'yyyy-MM-dd');
  const weekEnd = format(weekEndDate, 'yyyy-MM-dd');

  const { byProject, activities, isLoading, updateDates, isUpdating } = useWeekActivities(weekStart, weekEnd);

  const counts = useMemo(() => {
    const c = { total: activities.length, completed: 0, in_progress: 0, overdue: 0, pending: 0 };
    for (const a of activities) {
      const s = getActivityStatus(a, today);
      c[s]++;
    }
    return c;
  }, [activities, today]);

  const handleStart = async (a: WeekActivity) => {
    await updateDates(a.id, { actual_start: format(today, 'yyyy-MM-dd') });
  };
  const handleFinish = async (a: WeekActivity) => {
    const updates: { actual_start?: string | null; actual_end?: string | null } = {
      actual_end: format(today, 'yyyy-MM-dd'),
    };
    if (!a.actual_start) updates.actual_start = a.planned_start;
    await updateDates(a.id, updates);
  };
  const handleReset = async (a: WeekActivity) => {
    await updateDates(a.id, { actual_start: null, actual_end: null });
  };

  const goPrev = () => setRefDate(addWeeks(refDate, -1));
  const goNext = () => setRefDate(addWeeks(refDate, 1));
  const goToday = () => setRefDate(today);

  const weekLabel = `${format(weekStartDate, "d 'de' MMM", { locale: ptBR })} – ${format(
    weekEndDate,
    "d 'de' MMM 'de' yyyy",
    { locale: ptBR },
  )}`;

  return (
    <PageContainer>
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <CalendarDays className="h-4 w-4" />
          <span>Visão semanal</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendário de Obras</h1>
        <p className="text-muted-foreground mt-1">
          Atividades programadas para a semana em todas as obras. Atualize as datas reais e veja o reflexo
          imediato no cronograma de cada obra.
        </p>
      </header>

      {/* Week navigator */}
      <Card className="mb-4">
        <CardContent className="py-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="font-semibold">
                <CalendarDays className="h-4 w-4 mr-2" />
                {weekLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar
                mode="single"
                selected={refDate}
                onSelect={(d) => d && setRefDate(d)}
                initialFocus
                locale={ptBR}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Hoje
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Total: {counts.total}</Badge>
            <Badge className={statusBadge.in_progress.className}>Em andamento: {counts.in_progress}</Badge>
            <Badge className={statusBadge.overdue.className}>Atrasadas: {counts.overdue}</Badge>
            <Badge className={statusBadge.pending.className}>Pendentes: {counts.pending}</Badge>
            <Badge className={statusBadge.completed.className}>Concluídas: {counts.completed}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : byProject.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma atividade programada"
          description="Não há atividades planejadas para esta semana em nenhuma obra."
        />
      ) : (
        <div className="space-y-4">
          {byProject.map((group) => {
            const color = getProjectColor(group.project_id);
            return (
              <Card key={group.project_id} className={cn('overflow-hidden border-l-4', color.border)}>
                <CardHeader className="py-3 px-4 border-b">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('inline-flex items-center justify-center h-7 w-7 rounded-md', color.bg)}>
                        <Building2 className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-base font-semibold truncate">
                        {group.project_name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {group.items.length} ativ.
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/obra/${group.project_id}/cronograma`)}
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
                    const sb = statusBadge[status];
                    const ps = parseISO(a.planned_start);
                    const pe = parseISO(a.planned_end);
                    const inThisWeek = isWithinInterval(today, { start: weekStartDate, end: weekEndDate });
                    return (
                      <div
                        key={a.id}
                        className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{a.description}</span>
                            {a.etapa && (
                              <Badge variant="outline" className="text-[10px]">
                                {a.etapa}
                              </Badge>
                            )}
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

                        <div className="flex items-center gap-2 shrink-0">
                          {!a.actual_start && !a.actual_end && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => handleStart(a)}
                              title={
                                inThisWeek
                                  ? 'Marcar início real como hoje'
                                  : 'Marcar início real como hoje (data atual do sistema)'
                              }
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
                              onClick={() => handleFinish(a)}
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
                              onClick={() => handleReset(a)}
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
      )}

      {/* Weekday legend */}
      <p className="text-[11px] text-muted-foreground text-center mt-6">
        Semana {weekdayLabels.join(' · ')} — referenciada pela segunda-feira.
      </p>
    </PageContainer>
  );
}
