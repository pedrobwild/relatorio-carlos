import { useMemo, useState } from 'react';
import { useAllActivities, deriveStatus, type KanbanStatus, type UnifiedActivity } from '@/hooks/useAllActivities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Calendar, User, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/PageContainer';
import { useStaffUsers } from '@/hooks/useStaffUsers';

const COLUMNS: { key: KanbanStatus; value: KanbanStatus; label: string }[] = [
  { key: 'not_started', value: 'not_started', label: 'Pendente' },
  { key: 'in_progress', value: 'in_progress', label: 'Em andamento' },
  { key: 'overdue', value: 'overdue', label: 'Atrasada' },
  { key: 'completed', value: 'completed', label: 'Concluída' },
];

const columnColors: Record<KanbanStatus, string> = {
  not_started: 'border-t-yellow-500',
  in_progress: 'border-t-blue-500',
  overdue: 'border-t-red-500',
  completed: 'border-t-green-500',
};

const columnBg: Record<KanbanStatus, string> = {
  not_started: 'bg-yellow-50/60 dark:bg-yellow-950/20',
  in_progress: 'bg-blue-50/60 dark:bg-blue-950/20',
  overdue: 'bg-red-50/60 dark:bg-red-950/20',
  completed: 'bg-green-50/60 dark:bg-green-950/20',
};

const dotColors: Record<KanbanStatus, string> = {
  not_started: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  overdue: 'bg-red-500',
  completed: 'bg-green-500',
};

export default function GestaoAtividades() {
  const { data: activities = [], isLoading } = useAllActivities();
  const { data: staffUsers = [] } = useStaffUsers();
  const [filterProject, setFilterProject] = useState<string>('all');

  const getMemberName = (userId: string | null) => {
    if (!userId) return null;
    const u = staffUsers.find(u => u.id === userId);
    return u?.nome || u?.email || null;
  };

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach(a => map.set(a.project_id, a.project_name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  const filtered = useMemo(() => {
    if (filterProject === 'all') return activities;
    return activities.filter(a => a.project_id === filterProject);
  }, [activities, filterProject]);

  const grouped = useMemo(() => {
    const g: Record<KanbanStatus, UnifiedActivity[]> = {
      not_started: [], in_progress: [], overdue: [], completed: [],
    };
    filtered.forEach(a => g[deriveStatus(a)].push(a));
    return g;
  }, [filtered]);

  const statusCounts = {
    total: filtered.length,
    not_started: grouped.not_started.length,
    in_progress: grouped.in_progress.length,
    overdue: grouped.overdue.length,
    completed: grouped.completed.length,
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Atividades</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Visão unificada de todas as obras</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span className="font-bold text-foreground tabular-nums">{statusCounts.total}</span> total
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="tabular-nums font-medium">{statusCounts.not_started}</span>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="tabular-nums font-medium">{statusCounts.in_progress}</span>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="tabular-nums font-medium">{statusCounts.overdue}</span>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="tabular-nums font-medium">{statusCounts.completed}</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <Building2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue placeholder="Filtrar por obra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as obras</SelectItem>
                {projects.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="min-w-[260px] md:min-w-0 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 min-h-[calc(100vh-220px)] scrollbar-hide">
          {COLUMNS.map(col => {
            const colTasks = grouped[col.key];
            return (
              <div
                key={col.key}
                className={cn(
                  'min-w-[260px] md:min-w-0 rounded-2xl border-t-[3px] transition-all flex flex-col',
                  columnColors[col.key],
                )}
              >
                <div className={cn('px-2.5 py-2 rounded-t-xl', columnBg[col.key])}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', dotColors[col.key])} />
                      <h3 className="font-bold text-sm">{col.label}</h3>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold h-5 min-w-[20px] justify-center">
                      {colTasks.length}
                    </Badge>
                  </div>
                </div>
                <div className="p-1.5 space-y-1.5 flex-1 bg-muted/20 rounded-b-2xl overflow-y-auto">
                  {colTasks.map(act => {
                    const responsible = getMemberName(act.responsible_user_id);
                    const isOverdue = act.planned_end && act.status !== 'concluido' && act.planned_end < new Date().toISOString().slice(0, 10);
                    return (
                      <Card
                        key={act.id}
                        className="hover:shadow-md transition-all rounded-xl border-border/40"
                      >
                        <CardContent className="p-2.5 space-y-1.5">
                          {/* Project badge */}
                          <span className="flex items-center gap-1 text-[11px] font-medium text-primary truncate">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {act.project_name}
                          </span>

                          {/* Title */}
                          <span className={cn(
                            'font-semibold text-sm leading-tight block',
                            act.status === 'concluido' && 'line-through opacity-60'
                          )}>
                            {act.description}
                          </span>

                          {/* Description */}
                          {act.detailed_description && (
                            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{act.detailed_description}</p>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {responsible && (
                              <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
                                <User className="h-3 w-3" /> {responsible}
                              </span>
                            )}
                            {act.planned_end && (
                              <span className={cn(
                                'flex items-center gap-1 rounded-md px-1.5 py-0.5',
                                isOverdue ? 'bg-destructive/10 text-destructive font-semibold' : 'bg-muted/50'
                              )}>
                                <Calendar className="h-3 w-3" />
                                {format(new Date(act.planned_end + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 border-2 border-dashed border-border/30 rounded-xl">
                      Nenhuma atividade
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
