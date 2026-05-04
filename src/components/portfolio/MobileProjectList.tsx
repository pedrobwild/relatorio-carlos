import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarX,
  CheckCircle,
  Clock,
  ChevronRight,
  FileSignature,
  FileText,
} from "lucide-react";
import { useProjectSummaryQuery } from "@/hooks/useProjectsQuery";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, getTodayLocal } from "@/lib/activityStatus";
import { getTemporalStatusLabel } from "@/lib/temporalStatus";
import { cn } from "@/lib/utils";
import type { ProjectWithCustomer } from "@/infra/repositories";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

const statusConfig: Record<string, { label: string; dot: string }> = {
  draft: { label: "Rascunho", dot: "bg-violet-500" },
  active: { label: "Ativa", dot: "bg-emerald-500" },
  completed: { label: "Concluída", dot: "bg-blue-500" },
  paused: { label: "Pausada", dot: "bg-amber-500" },
  cancelled: { label: "Cancelada", dot: "bg-muted-foreground" },
};

interface MobileProjectListProps {
  projects: ProjectWithCustomer[];
  onProjectClick?: (project: ProjectWithCustomer) => void;
}

export function MobileProjectList({
  projects,
  onProjectClick,
}: MobileProjectListProps) {
  const { data: summaries = [], isLoading } = useProjectSummaryQuery();

  const summaryMap = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    for (const s of summaries) map.set(s.id, s);
    return map;
  }, [summaries]);

  // Stable "today" reference — avoid recreating per row
  const today = useMemo(() => getTodayLocal(), []);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[88px] bg-card rounded-xl border border-border/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="Lista de obras">
      {projects.map((project) => (
        <MobileProjectRow
          key={project.id}
          project={project}
          summary={summaryMap.get(project.id)}
          today={today}
          onClick={() => onProjectClick?.(project)}
        />
      ))}
    </div>
  );
}

function MobileProjectRow({
  project,
  summary,
  today,
  onClick,
}: {
  project: ProjectWithCustomer;
  summary?: ProjectSummary;
  today: Date;
  onClick: () => void;
}) {
  const progress = Math.max(
    0,
    Math.min(100, Math.round(Number(summary?.progress_percentage ?? 0))),
  );
  const overdueCount = summary?.overdue_count ?? 0;
  const unsignedFormalizations = summary?.unsigned_formalizations ?? 0;
  const pendingDocuments = summary?.pending_documents ?? 0;
  const status = statusConfig[project.status] ?? statusConfig.active;

  const plannedEnd = project.planned_end_date
    ? parseLocalDate(project.planned_end_date)
    : null;
  const actualEnd = project.actual_end_date
    ? parseLocalDate(project.actual_end_date)
    : null;
  const isFinished = !!actualEnd;
  const daysRemaining =
    plannedEnd && !isFinished ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isApproaching =
    daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 14;

  return (
    <button
      type="button"
      role="listitem"
      onClick={onClick}
      aria-label={`${project.name}${overdueCount > 0 ? `, ${overdueCount} atividades atrasadas` : ""}, ${Math.round(progress)}% concluído`}
      className={cn(
        "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-card text-left",
        "transition-all active:scale-[0.98] active:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "min-h-[72px]",
        isOverdue
          ? "border-destructive/25 bg-destructive/[0.02]"
          : isApproaching
            ? "border-amber-500/25 bg-amber-500/[0.02]"
            : "border-border/40",
      )}
    >
      {/* Project info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Row 1: Name + status */}
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[13px] text-foreground truncate leading-tight flex-1 min-w-0">
            {project.name}
          </p>
          <div
            className={cn("w-2 h-2 rounded-full shrink-0", status.dot)}
            title={getTemporalStatusLabel(
              project.status,
              null,
              project.created_at,
            )}
            aria-label={`Status: ${status.label}`}
            role="img"
          />
        </div>

        {/* Row 2: Customer + unit */}
        {(project.customer_name || project.unit_name) && (
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            {[project.customer_name, project.unit_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <div className="flex items-center gap-2">
          {/* Progress */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden min-w-[40px] max-w-[80px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress >= 80
                    ? "bg-[hsl(var(--success))]"
                    : progress >= 40
                      ? "bg-primary"
                      : "bg-[hsl(var(--warning))]",
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Delivery info */}
          {plannedEnd && (
            <div className="flex items-center gap-1 shrink-0">
              {isFinished ? (
                <span className="text-[10px] text-[hsl(var(--success))] font-medium flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" />
                </span>
              ) : isOverdue ? (
                <span className="text-[10px] text-destructive font-bold flex items-center gap-0.5">
                  <CalendarX className="h-3 w-3" />
                  {Math.abs(daysRemaining!)}d
                </span>
              ) : isApproaching ? (
                <span className="text-[10px] text-[hsl(var(--warning))] font-medium flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {daysRemaining}d
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                  {format(plannedEnd, "dd/MM", { locale: ptBR })}
                </span>
              )}
            </div>
          )}

          {/* Color-coded alert badges */}
          {overdueCount > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] gap-0.5 bg-destructive/10 text-destructive border-destructive/20 shrink-0"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {overdueCount}
            </Badge>
          )}
          {unsignedFormalizations > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] gap-0.5 bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 shrink-0"
            >
              <FileSignature className="h-2.5 w-2.5" />
              {unsignedFormalizations}
            </Badge>
          )}
          {pendingDocuments > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] gap-0.5 bg-primary/10 text-primary border-primary/20 shrink-0"
            >
              <FileText className="h-2.5 w-2.5" />
              {pendingDocuments}
            </Badge>
          )}
        </div>
      </div>

      {/* Right: Chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
    </button>
  );
}
