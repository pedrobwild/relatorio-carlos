import { useState, useMemo, useCallback, useEffect } from "react";
import { CalendarDays, AlertTriangle, ChevronDown, Rows3, Rows2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { ScheduleTableProps, SortField, SortDirection } from "./schedule/types";
import { formatDate, parseDate, getActivityStatus, statusOrder } from "./schedule/utils";
import { StatusBadge } from "./schedule/StatusBadge";
import { SortableHeader } from "./schedule/SortableHeader";
import { EditableDateCell, EditableDateCellMobile } from "./schedule/EditableDateCell";

const ScheduleTable = ({
  activities, reportDate, selectedActivityId, onActivitySelect,
  canEditDates, onUpdateActivityDates,
}: ScheduleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // Descrições detalhadas começam expandidas para TODOS os roles
  // (desktop, tablet e mobile); o usuário pode colapsar no chevron.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const isExpanded = useCallback((id: string) => !collapsedIds.has(id), [collapsedIds]);
  const [ultraCompact, setUltraCompact] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("schedule:ultraCompact") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("schedule:ultraCompact", ultraCompact ? "1" : "0");
    }
  }, [ultraCompact]);

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const baseYear = activities.length > 0 && activities[0].plannedStart
    ? new Date(activities[0].plannedStart + "T00:00:00").getFullYear()
    : new Date().getFullYear();

  const currentActivityIndex = useMemo(() => {
    if (!reportDate) return -1;
    const currentDate = new Date(reportDate + "T00:00:00");
    return activities.findIndex(a => {
      const s = new Date(a.plannedStart + "T00:00:00");
      const e = new Date(a.plannedEnd + "T00:00:00");
      return currentDate >= s && currentDate <= e;
    });
  }, [activities, reportDate]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedActivities = useMemo(() => {
    if (!sortField) return activities;
    return [...activities].sort((a, b) => {
      let cmp = 0;
      if (sortField === "status") {
        cmp = statusOrder[getActivityStatus(a)] - statusOrder[getActivityStatus(b)];
      } else if (sortField === "description") {
        cmp = a.description.localeCompare(b.description, "pt-BR");
      } else {
        const dA = parseDate(a[sortField]);
        const dB = parseDate(b[sortField]);
        if (!dA && !dB) cmp = 0;
        else if (!dA) cmp = 1;
        else if (!dB) cmp = -1;
        else cmp = dA.getTime() - dB.getTime();
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [activities, sortField, sortDirection]);

  const stats = useMemo(() => {
    const delayed = activities.filter(a => getActivityStatus(a) === "delayed").length;
    const completed = activities.filter(a => getActivityStatus(a) === "completed").length;
    const pending = activities.filter(a => getActivityStatus(a) === "pending").length;
    return { delayed, completed, pending, total: activities.length };
  }, [activities]);

  if (activities.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          variant="schedule"
          title="Cronograma em preparação"
          description="Assim que as etapas da obra forem definidas, o cronograma completo aparecerá aqui com prazos e responsáveis."
          infoLink={{ label: "Entenda como funciona", href: "#faq-cronograma" }}
          compact
        />
      </div>
    );
  }

  return (
    <div className="mt-2 md:mt-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs md:text-base font-bold text-foreground tracking-tight">Cronograma</h3>
            <p className="text-[9px] md:text-xs text-muted-foreground">
              {stats.total} atividades • {stats.completed} concluídas
              {canEditDates && <span className="text-primary ml-1">• Datas editáveis</span>}
            </p>
          </div>
          {stats.delayed > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30 shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" />
              {stats.delayed}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setUltraCompact(v => !v); }}
            className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground active:scale-95 transition shrink-0"
            aria-label={ultraCompact ? "Mostrar mais detalhes" : "Modo ultra compacto"}
            aria-pressed={ultraCompact}
            title={ultraCompact ? "Modo padrão" : "Modo ultra compacto"}
          >
            {ultraCompact ? <Rows3 className="w-3.5 h-3.5" /> : <Rows2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Mobile Card View — compact list, expand on tap */}
      <div className={cn("md:hidden", ultraCompact ? "space-y-px" : "space-y-1")}>
        {sortedActivities.map((activity, index) => {
          const originalIndex = activities.indexOf(activity);
          const status = getActivityStatus(activity);
          const isCurrent = originalIndex === currentActivityIndex;
          const isSelected = selectedActivityId === activity.id;
          const expanded = isSelected;
          const hasDetails = !!activity.detailed_description?.trim();
          const realRange = activity.actualStart
            ? `${formatDate(activity.actualStart, baseYear)}${activity.actualEnd ? ` → ${formatDate(activity.actualEnd, baseYear)}` : ""}`
            : null;
          return (
            <div
              key={activity.id}
              className={cn(
                "bg-card border rounded-lg px-2.5 py-1.5 shadow-sm opacity-0 animate-fade-in transition-all",
                onActivitySelect && "cursor-pointer active:scale-[0.99]",
                isSelected
                  ? "border-primary ring-1 ring-primary/20"
                  : isCurrent
                    ? "border-primary/40 bg-primary/5"
                    : "border-border"
              )}
              style={{ animationDelay: `${Math.min(index, 10) * 20}ms` }}
              onClick={() => onActivitySelect?.(selectedActivityId === activity.id ? null : activity.id || null)}
            >
              {/* Compact summary row */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0 bg-primary/10 text-primary">{originalIndex + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-foreground line-clamp-2">{activity.description}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5 truncate">
                    {formatDate(activity.plannedStart, baseYear)} → {formatDate(activity.plannedEnd, baseYear)}
                    {realRange && <span className="ml-1.5 text-foreground/70">• Real {realRange}</span>}
                  </p>
                </div>
                <StatusBadge status={status} />
                {onActivitySelect && (
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
                )}
              </div>

              {/* Expanded details */}
              {expanded && (
                <div className="mt-2 pt-2 border-t border-border/60 animate-fade-in">
                  {(activity.etapa || hasDetails) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {activity.etapa && (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent text-accent-foreground">{activity.etapa}</span>
                      )}
                      {hasDetails && (
                        <button
                          onClick={(e) => toggleExpand(activity.id, e)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                          aria-label={isExpanded(activity.id) ? "Ocultar descrição" : "Ver descrição"}
                        >
                          {isExpanded(activity.id) ? "Ocultar descrição" : "Ver descrição"}
                          <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded(activity.id) && "rotate-180")} />
                        </button>
                      )}
                    </div>
                  )}
                  {hasDetails && isExpanded(activity.id) && (
                    <p className="mb-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-secondary/30 rounded-md p-2 animate-fade-in">
                      {activity.detailed_description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-muted/40 rounded-md px-2 py-1">
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Previsto</p>
                      <p className="text-[11px] font-semibold text-foreground tabular-nums">
                        {formatDate(activity.plannedStart, baseYear)} → {formatDate(activity.plannedEnd, baseYear)}
                      </p>
                    </div>
                    {canEditDates && onUpdateActivityDates && activity.id ? (
                      <>
                        <EditableDateCellMobile value={activity.actualStart} baseYear={baseYear} activityId={activity.id} field="actual_start" label="Início Real" onSave={onUpdateActivityDates} />
                        <EditableDateCellMobile value={activity.actualEnd} baseYear={baseYear} activityId={activity.id} field="actual_end" label="Término Real" onSave={onUpdateActivityDates} />
                      </>
                    ) : (
                      <div className="bg-muted/40 rounded-md px-2 py-1">
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Real</p>
                        <p className="text-[11px] font-semibold tabular-nums text-foreground">
                          {realRange ?? "—"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <TooltipProvider>
        <div className="hidden md:block overflow-hidden rounded-xl border border-border shadow-sm">
          <Table data-testid="schedule-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-0">
                <SortableHeader field="description" currentField={sortField} direction={sortDirection} onSort={handleSort} className="bg-primary text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5 pl-4 text-left w-[35%]">Atividade</SortableHeader>
                <SortableHeader field="plannedStart" currentField={sortField} direction={sortDirection} onSort={handleSort} className="bg-primary text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5">Início Prev.</SortableHeader>
                <SortableHeader field="plannedEnd" currentField={sortField} direction={sortDirection} onSort={handleSort} className="bg-primary text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5">Término Prev.</SortableHeader>
                <SortableHeader field="actualStart" currentField={sortField} direction={sortDirection} onSort={handleSort} className="bg-primary-dark text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5">Início Real</SortableHeader>
                <SortableHeader field="actualEnd" currentField={sortField} direction={sortDirection} onSort={handleSort} className="bg-primary-dark text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5">Término Real</SortableHeader>
                <SortableHeader field="status" currentField={sortField} direction={sortDirection} onSort={handleSort} className="bg-primary-dark text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5 pr-4">Status</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedActivities.map((activity, index) => {
                const originalIndex = activities.indexOf(activity);
                const status = getActivityStatus(activity);
                const isCurrent = originalIndex === currentActivityIndex;
                const isSelected = selectedActivityId === activity.id;
                return (
                  <TableRow
                    key={activity.id}
                    className={cn(
                      "transition-colors border-b border-border/50 last:border-b-0",
                      !canEditDates && onActivitySelect && "cursor-pointer",
                      isSelected
                        ? "bg-primary/10 hover:bg-primary/15 ring-1 ring-inset ring-primary/30"
                        : isCurrent
                          ? "bg-primary/[0.04] hover:bg-primary/10 ring-1 ring-inset ring-primary/20"
                          : index % 2 === 0
                            ? "bg-card hover:bg-accent/30"
                            : "bg-secondary/20 hover:bg-accent/30"
                    )}
                    onClick={() => !canEditDates && onActivitySelect?.(selectedActivityId === activity.id ? null : activity.id || null)}
                  >
                    <TableCell className="py-3.5 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 bg-primary/10 text-primary">{originalIndex + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium leading-snug text-foreground">{activity.description}</span>
                            {activity.etapa && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent text-accent-foreground shrink-0">{activity.etapa}</span>
                            )}
                            {activity.detailed_description?.trim() && (
                              <button
                                onClick={(e) => toggleExpand(activity.id, e)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shrink-0"
                                aria-label={isExpanded(activity.id) ? "Ocultar descrição" : "Ver descrição"}
                              >
                                {isExpanded(activity.id) ? "Ocultar descrição" : "Ver descrição"}
                                <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded(activity.id) && "rotate-180")} />
                              </button>
                            )}
                          </div>
                          {activity.detailed_description?.trim() && isExpanded(activity.id) && (
                            <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-secondary/30 rounded-md p-2.5 animate-fade-in">
                              {activity.detailed_description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm text-muted-foreground tabular-nums">{formatDate(activity.plannedStart, baseYear)}</TableCell>
                    <TableCell className="py-3.5 text-center text-sm text-muted-foreground tabular-nums">{formatDate(activity.plannedEnd, baseYear)}</TableCell>
                    <TableCell className="py-3.5 text-center">
                      {canEditDates && onUpdateActivityDates && activity.id
                        ? <EditableDateCell value={activity.actualStart} baseYear={baseYear} activityId={activity.id} field="actual_start" onSave={onUpdateActivityDates} />
                        : <span className="text-sm font-medium text-foreground tabular-nums">{formatDate(activity.actualStart, baseYear)}</span>}
                    </TableCell>
                    <TableCell className="py-3.5 text-center">
                      {canEditDates && onUpdateActivityDates && activity.id
                        ? <EditableDateCell value={activity.actualEnd} baseYear={baseYear} activityId={activity.id} field="actual_end" onSave={onUpdateActivityDates} />
                        : <span className="text-sm font-medium tabular-nums text-foreground">{formatDate(activity.actualEnd, baseYear)}</span>}
                    </TableCell>
                    <TableCell className="py-3.5 pr-4 text-center">
                      <StatusBadge status={status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </div>
  );
};

export default ScheduleTable;
