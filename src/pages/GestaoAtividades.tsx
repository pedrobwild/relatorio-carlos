import { useMemo, useState } from'react';
import { useNavigate } from'react-router-dom';
import { useAllActivities, deriveKanbanStatus, type KanbanStatus, type GlobalTask } from'@/hooks/useAllActivities';
import type { ObraTaskStatus } from'@/hooks/useObraTasks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Badge } from'@/components/ui/badge';
import { Card, CardContent } from'@/components/ui/card';
import { Input } from'@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Building2, Calendar, User, Flag, Search, LayoutList, Columns3, ChevronUp, ChevronDown } from'lucide-react';
import { format } from'date-fns';
import { ptBR } from'date-fns/locale';
import { cn } from'@/lib/utils';
import { matchesSearch } from'@/lib/searchNormalize';
import { Skeleton } from'@/components/ui/skeleton';
import { PageContainer } from'@/components/layout/PageContainer';
import { useStaffUsers } from'@/hooks/useStaffUsers';
import { getMemberName, isTaskOverdue, priorityConfig, getProjectColor, statusVariant } from'@/lib/taskUtils';

// ── Kanban column definitions ────────────────────────────────
const COLUMNS: { key: KanbanStatus; label: string }[] = [
 { key:'not_started', label:'Pendente' },
 { key:'in_progress', label:'Em andamento' },
 { key:'overdue', label:'Atrasada' },
 { key:'completed', label:'Concluída' },
];

const columnColors: Record<KanbanStatus, string> = {
 not_started:'border-t-yellow-500',
 in_progress:'border-t-blue-500',
 overdue:'border-t-red-500',
 completed:'border-t-green-500',
};

const columnBg: Record<KanbanStatus, string> = {
 not_started:'bg-yellow-50/60',
 in_progress:'bg-blue-50/60',
 overdue:'bg-red-50/60',
 completed:'bg-green-50/60',
};

const kanbanDotColors: Record<KanbanStatus, string> = {
 not_started:'bg-yellow-500',
 in_progress:'bg-blue-500',
 overdue:'bg-red-500',
 completed:'bg-green-500',
};

// ── Sort helper ──────────────────────────────────────────────
type SortField ='title' |'project_name' |'due_date' |'priority' |'status' |'responsible';
type SortDir ='asc' |'desc';

const PRIORITY_ORDER: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
const STATUS_ORDER: Record<string, number> = { pendente: 0, em_andamento: 1, pausado: 2, concluido: 3 };

function sortTasks(tasks: GlobalTask[], field: SortField, dir: SortDir, staffUsers: any[]): GlobalTask[] {
 const sorted = [...tasks].sort((a, b) => {
 let cmp = 0;
 switch (field) {
 case'title':
 cmp = a.title.localeCompare(b.title,'pt-BR');
 break;
 case'project_name':
 cmp = a.project_name.localeCompare(b.project_name,'pt-BR');
 break;
 case'due_date':
 cmp = (a.due_date ??'9999').localeCompare(b.due_date ??'9999');
 break;
 case'priority':
 cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
 break;
 case'status':
 cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
 break;
 case'responsible': {
 const na = getMemberName(staffUsers, a.responsible_user_id) ??'zzz';
 const nb = getMemberName(staffUsers, b.responsible_user_id) ??'zzz';
 cmp = na.localeCompare(nb,'pt-BR');
 break;
 }
 }
 return dir ==='asc' ? cmp : -cmp;
 });
 return sorted;
}

export default function GestaoAtividades() {
 const { tasks, isLoading, updateStatus } = useAllActivities();
 const { data: staffUsers = [] } = useStaffUsers();
 const navigate = useNavigate();

 // ── Filters ──
 const [filterProject, setFilterProject] = useState<string>('all');
 const [filterResponsible, setFilterResponsible] = useState<string>('all');
 const [filterPriority, setFilterPriority] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');

 // ── View mode ──
 const [view, setView] = useState<'kanban' |'list'>('kanban');

 // ── Sort (list view) ──
 const [sortField, setSortField] = useState<SortField>('due_date');
 const [sortDir, setSortDir] = useState<SortDir>('asc');

 // ── Drag state (kanban) ──
 const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

 // ── Derived data ──
 const projects = useMemo(() => {
 const map = new Map<string, string>();
 tasks.forEach(a => map.set(a.project_id, a.project_name));
 return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
 }, [tasks]);

 const responsibleOptions = useMemo(() => {
 const ids = new Set(tasks.map(t => t.responsible_user_id).filter(Boolean) as string[]);
 return staffUsers.filter(u => ids.has(u.id));
 }, [tasks, staffUsers]);

 const filtered = useMemo(() => {
 let result = tasks;
 if (filterProject !=='all') result = result.filter(a => a.project_id === filterProject);
 if (filterResponsible !=='all') {
 if (filterResponsible ==='unassigned') result = result.filter(a => !a.responsible_user_id);
 else result = result.filter(a => a.responsible_user_id === filterResponsible);
 }
 if (filterPriority !=='all') result = result.filter(a => a.priority === filterPriority);
 if (searchQuery.trim()) {
 result = result.filter((a) =>
 matchesSearch(searchQuery, [a.title, a.project_name, a.description]),
 );
 }
 return result;
 }, [tasks, filterProject, filterResponsible, filterPriority, searchQuery]);

 const grouped = useMemo(() => {
 const g: Record<KanbanStatus, GlobalTask[]> = {
 not_started: [], in_progress: [], overdue: [], completed: [],
 };
 filtered.forEach(a => g[deriveKanbanStatus(a)].push(a));
 return g;
 }, [filtered]);

 const statusCounts = {
 total: filtered.length,
 not_started: grouped.not_started.length,
 in_progress: grouped.in_progress.length,
 overdue: grouped.overdue.length,
 completed: grouped.completed.length,
 };

 const sortedForList = useMemo(
 () => sortTasks(filtered, sortField, sortDir, staffUsers),
 [filtered, sortField, sortDir, staffUsers]
 );

 // ── Handlers ──
 const handleSort = (field: SortField) => {
 if (sortField === field) {
 setSortDir(d => d ==='asc' ?'desc' :'asc');
 } else {
 setSortField(field);
 setSortDir('asc');
 }
 };

 const handleDragStart = (e: React.DragEvent, taskId: string) => {
 e.dataTransfer.setData('taskId', taskId);
 e.dataTransfer.effectAllowed ='move';
 };

 const handleDragOver = (e: React.DragEvent, status: KanbanStatus) => {
 e.preventDefault();
 e.dataTransfer.dropEffect ='move';
 setDragOverColumn(status);
 };

 const handleDrop = (e: React.DragEvent, kanbanStatus: KanbanStatus) => {
 e.preventDefault();
 const taskId = e.dataTransfer.getData('taskId');
 if (!taskId) return;
 setDragOverColumn(null);
 // Map kanban column back to ObraTaskStatus
 const statusMap: Record<KanbanStatus, ObraTaskStatus> = {
 not_started:'pendente',
 in_progress:'em_andamento',
 overdue:'em_andamento', // dropping into overdue → em_andamento (overdue is derived)
 completed:'concluido',
 };
 updateStatus.mutate({ id: taskId, status: statusMap[kanbanStatus] });
 };

 const handleCardClick = (task: GlobalTask) => {
 navigate(`/obra/${task.project_id}/atividades/${task.id}`);
 };

 // ── Sort icon ──
 const SortIcon = ({ field }: { field: SortField }) => {
 if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
 return sortDir ==='asc'
 ? <ChevronUp className="h-3 w-3" />
 : <ChevronDown className="h-3 w-3" />;
 };

 return (
 <PageContainer maxWidth="full" className="py-4 sm:py-6 flex flex-col flex-1 min-h-0">
 {/* ── Header ── */}
 <div className="flex flex-col gap-3 mb-4 sm:mb-6">
 <div className="flex items-center justify-between gap-2">
 <div className="min-w-0">
 <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Atividades</h1>
 <p className="text-xs sm:text-sm text-muted-foreground">Visão unificada de todas as obras</p>
 </div>
 {/* View toggle */}
 <div className="flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5 shrink-0" role="radiogroup">
 {([
 { mode:'kanban' as const, icon: Columns3, label:'Kanban' },
 { mode:'list' as const, icon: LayoutList, label:'Lista' },
 ]).map(({ mode, icon: Icon, label }) => (
 <button
 key={mode}
 role="radio"
 aria-checked={view === mode}
 onClick={() => setView(mode)}
 className={cn(
'inline-flex items-center gap-1.5 h-9 sm:h-7 px-2.5 rounded-md text-xs font-medium transition-all',
 view === mode
 ?'bg-background text-foreground shadow-sm'
 :'text-muted-foreground hover:text-foreground'
 )}
 >
 <Icon className="h-3.5 w-3.5" />
 {label}
 </button>
 ))}
 </div>
 </div>

 {/* ── Filters row ── */}
 <div className="flex items-center gap-2 flex-wrap overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
 {/* Status counts */}
 <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide shrink-0">
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
 <span className="font-bold text-foreground tabular-nums">{statusCounts.total}</span> total
 </div>
 <div className="w-px h-3 bg-border" />
 {([
 { count: statusCounts.not_started, dot:'bg-yellow-500' },
 { count: statusCounts.in_progress, dot:'bg-blue-500' },
 { count: statusCounts.overdue, dot:'bg-red-500' },
 { count: statusCounts.completed, dot:'bg-green-500' },
 ]).map((s, i) => (
 <div key={i} className="flex items-center gap-1 text-xs shrink-0">
 <div className={cn('w-2 h-2 rounded-full', s.dot)} />
 <span className="tabular-nums font-medium">{s.count}</span>
 </div>
 ))}
 </div>

 <div className="w-px h-3 bg-border shrink-0 hidden sm:block" />

 {/* Search */}
 <div className="relative shrink-0">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
 <Input
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 placeholder="Buscar..."
 className="h-9 sm:h-8 w-full sm:w-[180px] pl-8 text-xs"
 />
 </div>

 {/* Project filter */}
 <Select value={filterProject} onValueChange={setFilterProject}>
 <SelectTrigger className="h-9 sm:h-8 w-[140px] sm:w-[200px] text-xs shrink-0">
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

 {/* Responsible filter */}
 <Select value={filterResponsible} onValueChange={setFilterResponsible}>
 <SelectTrigger className="h-9 sm:h-8 w-[130px] sm:w-[180px] text-xs shrink-0">
 <User className="h-3.5 w-3.5 mr-1.5 shrink-0" />
 <SelectValue placeholder="Responsável" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos</SelectItem>
 <SelectItem value="unassigned">Sem responsável</SelectItem>
 {responsibleOptions.map(u => (
 <SelectItem key={u.id} value={u.id}>{u.nome || u.email}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Priority filter */}
 <Select value={filterPriority} onValueChange={setFilterPriority}>
 <SelectTrigger className="h-9 sm:h-8 w-[120px] sm:w-[150px] text-xs shrink-0">
 <Flag className="h-3.5 w-3.5 mr-1.5 shrink-0" />
 <SelectValue placeholder="Prioridade" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todas</SelectItem>
 {Object.entries(priorityConfig).map(([key, cfg]) => (
 <SelectItem key={key} value={key}>
 <span className={cn('flex items-center gap-1.5', cfg.color)}>
 <span>{cfg.icon}</span> {cfg.label}
 </span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* ── Content ── */}
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
 ) : view ==='kanban' ? (
 /* ── KANBAN VIEW ── */
 <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 min-h-[calc(100vh-220px)] scrollbar-hide">
 {COLUMNS.map(col => {
 const colTasks = grouped[col.key];
 return (
 <div
 key={col.key}
 className={cn(
'min-w-[260px] md:min-w-0 rounded-2xl border-t-[3px] transition-all flex flex-col',
 columnColors[col.key],
 dragOverColumn === col.key &&'ring-2 ring-primary/40 shadow-lg',
 )}
 onDragOver={(e) => handleDragOver(e, col.key)}
 onDragLeave={() => setDragOverColumn(null)}
 onDrop={(e) => handleDrop(e, col.key)}
 >
 <div className={cn('px-2.5 py-2 rounded-t-xl', columnBg[col.key])}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className={cn('w-2.5 h-2.5 rounded-full', kanbanDotColors[col.key])} />
 <h3 className="font-bold text-sm">{col.label}</h3>
 </div>
 <Badge variant="secondary" className="text-[10px] font-bold h-5 min-w-[20px] justify-center">
 {colTasks.length}
 </Badge>
 </div>
 </div>
 <div className="p-1.5 space-y-1.5 flex-1 bg-muted/20 rounded-b-2xl overflow-y-auto">
 {colTasks.map(task => {
 const responsible = getMemberName(staffUsers, task.responsible_user_id);
 const overdue = isTaskOverdue(task);
 const prio = priorityConfig[task.priority];
 const projColor = getProjectColor(task.project_id);
 return (
 <Card
 key={task.id}
 draggable
 onDragStart={(e) => handleDragStart(e, task.id)}
 className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all rounded-xl border-border/40 active:scale-[0.98]"
 onClick={() => handleCardClick(task)}
 >
 <CardContent className="p-2.5 space-y-1.5">
 {/* Project badge (colored) */}
 <span className={cn(
'inline-flex items-center gap-1 text-[11px] font-medium truncate rounded-md px-1.5 py-0.5 border max-w-full',
 projColor.bg, projColor.border
 )}>
 <Building2 className="h-3 w-3 shrink-0" />
 <span className="truncate">{task.project_name}</span>
 </span>

 {/* Title */}
 <span className={cn(
'font-semibold text-sm leading-tight block',
 task.status ==='concluido' &&'line-through opacity-60'
 )}>
 {task.title}
 </span>

 {/* Description */}
 {task.description && (
 <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{task.description}</p>
 )}

 {/* Meta row */}
 <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
 {/* Priority */}
 <span className={cn('flex items-center gap-0.5 font-medium', prio.color)}>
 <span className="text-xs">{prio.icon}</span> {prio.label}
 </span>
 {responsible && (
 <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
 <User className="h-3 w-3" /> {responsible}
 </span>
 )}
 {task.due_date && (
 <span className={cn(
'flex items-center gap-1 rounded-md px-1.5 py-0.5',
 overdue ?'bg-destructive/10 text-destructive font-semibold' :'bg-muted/50'
 )}>
 <Calendar className="h-3 w-3" />
 {format(new Date(task.due_date +'T00:00:00'),'dd/MM', { locale: ptBR })}
 </span>
 )}
 </div>
 </CardContent>
 </Card>
 );
 })}
 {colTasks.length === 0 && (
 <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 border-2 border-dashed border-border/30 rounded-xl">
 {col.key ==='overdue' ?'Nenhuma atrasada' :'Arraste aqui'}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 /* ── LIST VIEW ── */
 <>
 {/* Desktop table */}
 <div className="hidden md:block border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[22%] cursor-pointer select-none" onClick={() => handleSort('title')}>
 <span className="inline-flex items-center gap-1">Atividade <SortIcon field="title" /></span>
 </TableHead>
 <TableHead className="cursor-pointer select-none" onClick={() => handleSort('project_name')}>
 <span className="inline-flex items-center gap-1">Obra <SortIcon field="project_name" /></span>
 </TableHead>
 <TableHead className="cursor-pointer select-none" onClick={() => handleSort('responsible')}>
 <span className="inline-flex items-center gap-1">Responsável <SortIcon field="responsible" /></span>
 </TableHead>
 <TableHead className="cursor-pointer select-none" onClick={() => handleSort('priority')}>
 <span className="inline-flex items-center gap-1">Prioridade <SortIcon field="priority" /></span>
 </TableHead>
 <TableHead className="cursor-pointer select-none" onClick={() => handleSort('due_date')}>
 <span className="inline-flex items-center gap-1">Prazo <SortIcon field="due_date" /></span>
 </TableHead>
 <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
 <span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span>
 </TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {sortedForList.length === 0 ? (
 <TableRow>
 <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
 Nenhuma atividade encontrada
 </TableCell>
 </TableRow>
 ) : sortedForList.map(task => {
 const responsible = getMemberName(staffUsers, task.responsible_user_id);
 const overdue = isTaskOverdue(task);
 const prio = priorityConfig[task.priority];
 const projColor = getProjectColor(task.project_id);
 return (
 <TableRow
 key={task.id}
 className={cn(
'cursor-pointer hover:bg-muted/40',
 task.status ==='concluido' &&'opacity-60'
 )}
 onClick={() => handleCardClick(task)}
 >
 <TableCell>
 <div>
 <span className={cn('font-medium text-sm', task.status ==='concluido' &&'line-through')}>
 {task.title}
 </span>
 {task.description && (
 <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
 )}
 </div>
 </TableCell>
 <TableCell>
 <span className={cn(
'inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-0.5 border',
 projColor.bg, projColor.border
 )}>
 <Building2 className="h-3 w-3 shrink-0" />
 <span className="truncate max-w-[120px]">{task.project_name}</span>
 </span>
 </TableCell>
 <TableCell className="text-sm">{responsible ??'—'}</TableCell>
 <TableCell>
 <span className={cn('flex items-center gap-1 text-xs font-medium', prio.color)}>
 <span>{prio.icon}</span> {prio.label}
 </span>
 </TableCell>
 <TableCell>
 {task.due_date ? (
 <span className={cn('text-sm flex items-center gap-1', overdue &&'text-destructive font-medium')}>
 <Calendar className="h-3.5 w-3.5" />
 {format(new Date(task.due_date +'T00:00:00'),'dd/MM/yy', { locale: ptBR })}
 </span>
 ) :'—'}
 </TableCell>
 <TableCell>
 <Badge variant="outline" className={cn('text-xs', statusVariant[task.status])}>
 {task.status ==='pendente' &&'Pendente'}
 {task.status ==='em_andamento' &&'Em andamento'}
 {task.status ==='pausado' &&'Pausado'}
 {task.status ==='concluido' &&'Concluído'}
 </Badge>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>

 {/* Mobile card list */}
 <div className="md:hidden space-y-2">
 {sortedForList.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 Nenhuma atividade encontrada
 </div>
 ) : sortedForList.map(task => {
 const responsible = getMemberName(staffUsers, task.responsible_user_id);
 const overdue = isTaskOverdue(task);
 const prio = priorityConfig[task.priority];
 const projColor = getProjectColor(task.project_id);
 return (
 <Card
 key={task.id}
 className={cn(
'cursor-pointer hover:shadow-md transition-all active:scale-[0.98] rounded-xl',
 task.status ==='concluido' &&'opacity-60'
 )}
 onClick={() => handleCardClick(task)}
 >
 <CardContent className="p-3 space-y-2">
 {/* Project + Status */}
 <div className="flex items-center justify-between gap-2">
 <span className={cn(
'inline-flex items-center gap-1 text-[11px] font-medium truncate rounded-md px-1.5 py-0.5 border max-w-[60%]',
 projColor.bg, projColor.border
 )}>
 <Building2 className="h-3 w-3 shrink-0" />
 <span className="truncate">{task.project_name}</span>
 </span>
 <Badge variant="outline" className={cn('text-[10px] shrink-0', statusVariant[task.status])}>
 {task.status ==='pendente' &&'Pendente'}
 {task.status ==='em_andamento' &&'Em andamento'}
 {task.status ==='pausado' &&'Pausado'}
 {task.status ==='concluido' &&'Concluído'}
 </Badge>
 </div>

 {/* Title */}
 <span className={cn(
'font-semibold text-sm leading-tight block',
 task.status ==='concluido' &&'line-through'
 )}>
 {task.title}
 </span>

 {task.description && (
 <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
 )}

 {/* Meta row */}
 <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
 <span className={cn('flex items-center gap-0.5 font-medium', prio.color)}>
 <span className="text-xs">{prio.icon}</span> {prio.label}
 </span>
 {responsible && (
 <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
 <User className="h-3 w-3" /> {responsible}
 </span>
 )}
 {task.due_date && (
 <span className={cn(
'flex items-center gap-1 rounded-md px-1.5 py-0.5',
 overdue ?'bg-destructive/10 text-destructive font-semibold' :'bg-muted/50'
 )}>
 <Calendar className="h-3 w-3" />
 {format(new Date(task.due_date +'T00:00:00'),'dd/MM', { locale: ptBR })}
 </span>
 )}
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 </>
 )}
 </PageContainer>
 );
}
