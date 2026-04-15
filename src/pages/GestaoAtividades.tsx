import { useMemo, useState } from 'react';
import { useAllActivities, deriveStatus, type KanbanStatus, type UnifiedActivity } from '@/hooks/useAllActivities';
import { AppHeader } from '@/components/AppHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, CalendarDays, ChevronDown, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const COLUMNS: { key: KanbanStatus; label: string; color: string; dotColor: string }[] = [
  { key: 'not_started', label: 'Não iniciada', color: 'bg-muted/50', dotColor: 'bg-muted-foreground/40' },
  { key: 'in_progress', label: 'Em andamento', color: 'bg-blue-500/5', dotColor: 'bg-blue-500' },
  { key: 'overdue', label: 'Atrasada', color: 'bg-destructive/5', dotColor: 'bg-destructive' },
  { key: 'completed', label: 'Concluída', color: 'bg-emerald-500/5', dotColor: 'bg-emerald-500' },
];

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yy', { locale: ptBR }); } catch { return d; }
}

export default function GestaoAtividades() {
  const { data: activities = [], isLoading } = useAllActivities();
  const [filterProject, setFilterProject] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach(a => map.set(a.project_id, a.project_name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  const filtered = useMemo(() => {
    if (filterProject === 'all') return activities;
    return activities.filter(a => a.project_id === filterProject);
  }, [activities, filterProject]);

  const columns = useMemo(() => {
    const grouped: Record<KanbanStatus, UnifiedActivity[]> = {
      not_started: [], in_progress: [], overdue: [], completed: [],
    };
    filtered.forEach(a => grouped[deriveStatus(a)].push(a));
    return grouped;
  }, [filtered]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col">
      <AppHeader />
      <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Atividades</h1>
            <p className="text-sm text-muted-foreground">Visão unificada de todas as obras</p>
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <Building2 className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por obra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras ({activities.length})</SelectItem>
              {projects.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban board */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-xl bg-muted/30 animate-pulse h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 min-h-0">
            {COLUMNS.map(col => (
              <div key={col.key} className={cn('rounded-xl border border-border/50 flex flex-col min-h-0', col.color)}>
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
                  <span className={cn('w-2.5 h-2.5 rounded-full', col.dotColor)} />
                  <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
                    {columns[col.key].length}
                  </Badge>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                  {columns[col.key].length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade</p>
                  )}
                  {columns[col.key].map(act => (
                    <ActivityCard
                      key={act.id}
                      activity={act}
                      expanded={expandedIds.has(act.id)}
                      onToggle={() => toggleExpand(act.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
  media: { label: 'Média', className: 'bg-amber-500/10 text-amber-600' },
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
};

function ActivityCard({ activity: a, expanded, onToggle }: { activity: UnifiedActivity; expanded: boolean; onToggle: () => void }) {
  const hasDesc = !!a.detailed_description?.trim();
  const priority = PRIORITY_LABELS[a.prioridade] ?? null;

  return (
    <div className="bg-card rounded-lg border border-border/60 p-3 shadow-sm hover:shadow-md transition-shadow space-y-2">
      {/* Project badge */}
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[11px] font-medium text-primary truncate">{a.project_name}</span>
        {priority && (
          <Badge variant="secondary" className={cn('ml-auto text-[10px] px-1.5 py-0', priority.className)}>
            {priority.label}
          </Badge>
        )}
      </div>

      {/* Title + expand */}
      <div className="flex items-start gap-1">
        <p className="text-sm font-medium text-foreground leading-snug flex-1">{a.description}</p>
        {hasDesc && (
          <button onClick={onToggle} className="p-0.5 rounded hover:bg-accent shrink-0 mt-0.5">
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Expanded description */}
      {hasDesc && expanded && (
        <p className="text-xs text-muted-foreground whitespace-pre-line bg-secondary/30 rounded-md p-2 animate-fade-in">
          {a.detailed_description}
        </p>
      )}

      {/* Etapa */}
      {a.etapa && (
        <div className="flex items-center gap-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{a.etapa}</span>
        </div>
      )}

      {/* Dates */}
      {(a.planned_start || a.planned_end) && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          <span>{formatDate(a.planned_start)} — {formatDate(a.planned_end)}</span>
        </div>
      )}
    </div>
  );
}
