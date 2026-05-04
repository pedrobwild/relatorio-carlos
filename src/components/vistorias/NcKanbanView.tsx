import { useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Clock,
  ChevronRight,
  User,
  Tag,
  RotateCcw,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/searchNormalize";
import type {
  NonConformity,
  NcSeverity,
  NcStatus,
} from "@/hooks/useNonConformities";

const severityConfig: Record<
  NcSeverity,
  { label: string; className: string; order: number }
> = {
  critical: {
    label: "Crítica",
    className: "bg-red-100 text-red-700",
    order: 0,
  },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700", order: 1 },
  medium: {
    label: "Média",
    className: "bg-yellow-100 text-yellow-700",
    order: 2,
  },
  low: { label: "Baixa", className: "bg-blue-100 text-blue-700", order: 3 },
};

type KanbanColumn = {
  status: NcStatus;
  label: string;
  dotColor: string;
  borderColor: string;
  bgColor: string;
};

const COLUMNS: KanbanColumn[] = [
  {
    status: "open",
    label: "Abertas",
    dotColor: "bg-red-500",
    borderColor: "border-t-red-500",
    bgColor: "bg-red-50/60",
  },
  {
    status: "in_treatment",
    label: "Em Tratamento",
    dotColor: "bg-blue-500",
    borderColor: "border-t-blue-500",
    bgColor: "bg-blue-50/60",
  },
  {
    status: "pending_verification",
    label: "Verificação",
    dotColor: "bg-amber-500",
    borderColor: "border-t-amber-500",
    bgColor: "bg-amber-50/60",
  },
  {
    status: "pending_approval",
    label: "Aprovação",
    dotColor: "bg-purple-500",
    borderColor: "border-t-purple-500",
    bgColor: "bg-purple-50/60",
  },
  {
    status: "closed",
    label: "Encerradas",
    dotColor: "bg-green-500",
    borderColor: "border-t-green-500",
    bgColor: "bg-green-50/60",
  },
];

interface Props {
  nonConformities: NonConformity[];
  searchQuery: string;
  onSelect: (nc: NonConformity) => void;
  showProjectBadge?: boolean;
}

export function NcKanbanView({
  nonConformities,
  searchQuery,
  onSelect,
  showProjectBadge,
}: Props) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return nonConformities;
    return nonConformities.filter((nc) =>
      matchesSearch(searchQuery, [
        nc.title,
        nc.description,
        nc.category,
        nc.responsible_user_name,
      ]),
    );
  }, [nonConformities, searchQuery]);

  // Group reopened into open column
  const getColumnNcs = (status: NcStatus) => {
    const ncs =
      status === "open"
        ? filtered.filter(
            (nc) => nc.status === "open" || nc.status === "reopened",
          )
        : filtered.filter((nc) => nc.status === status);

    return ncs.sort((a, b) => {
      const sevA = severityConfig[a.severity].order;
      const sevB = severityConfig[b.severity].order;
      if (sevA !== sevB) return sevA - sevB;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-5 min-h-[calc(100vh-260px)] scrollbar-hide">
      {COLUMNS.map((col) => {
        const colNcs = getColumnNcs(col.status);
        return (
          <div
            key={col.status}
            className={cn(
              "min-w-[260px] md:min-w-0 rounded-2xl border-t-[3px] flex flex-col",
              col.borderColor,
            )}
          >
            <div className={cn("px-2.5 py-2 rounded-t-xl", col.bgColor)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn("w-2.5 h-2.5 rounded-full", col.dotColor)}
                  />
                  <h3 className="font-bold text-sm">{col.label}</h3>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold h-5 min-w-[20px] justify-center"
                >
                  {colNcs.length}
                </Badge>
              </div>
            </div>
            <div className="p-1.5 space-y-1.5 flex-1 bg-muted/20 rounded-b-2xl overflow-y-auto">
              {colNcs.map((nc) => (
                <NcKanbanCard
                  key={nc.id}
                  nc={nc}
                  today={today}
                  onSelect={onSelect}
                  showProjectBadge={showProjectBadge}
                />
              ))}
              {colNcs.length === 0 && (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 border-2 border-dashed border-border/30 rounded-xl">
                  Nenhuma NC
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NcKanbanCard({
  nc,
  today,
  onSelect,
  showProjectBadge,
}: {
  nc: NonConformity & { project_name?: string | null };
  today: string;
  onSelect: (nc: NonConformity) => void;
  showProjectBadge?: boolean;
}) {
  const sev = severityConfig[nc.severity];
  const isOverdue =
    nc.deadline && nc.deadline < today && nc.status !== "closed";
  const reopenCount = nc.reopen_count ?? 0;

  const deadlineDate = nc.deadline ? parseISO(nc.deadline) : null;
  const daysLeft =
    deadlineDate && nc.status !== "closed"
      ? differenceInDays(deadlineDate, new Date())
      : null;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;

  let deadlineDisplay: React.ReactNode = null;
  if (nc.deadline) {
    const formatted = format(deadlineDate!, "dd/MM", { locale: ptBR });
    if (nc.status === "closed") {
      deadlineDisplay = (
        <span className="text-muted-foreground">{formatted}</span>
      );
    } else if (isOverdue) {
      const daysOverdue = Math.abs(differenceInDays(new Date(), deadlineDate!));
      deadlineDisplay = (
        <span className="text-destructive font-semibold">
          {daysOverdue}d atraso · {formatted}
        </span>
      );
    } else if (isExpiringSoon) {
      deadlineDisplay = (
        <span className="text-orange-600 font-semibold">
          {daysLeft === 0 ? "Hoje" : `${daysLeft}d`} · {formatted}
        </span>
      );
    } else {
      deadlineDisplay = (
        <span className="text-muted-foreground">{formatted}</span>
      );
    }
  }

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-all rounded-xl border-border/40 active:scale-[0.98]",
        isOverdue && "border-destructive/40 bg-destructive/[0.02]",
        isExpiringSoon && !isOverdue && "border-orange-300/60",
      )}
      onClick={() => onSelect(nc)}
    >
      <CardContent className="p-2.5 space-y-1.5">
        {showProjectBadge && nc.project_name && (
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 w-fit">
            <Building2 className="h-2.5 w-2.5" />
            {nc.project_name}
          </span>
        )}
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "mt-1.5 h-2.5 w-2.5 rounded-full shrink-0",
              nc.severity === "critical"
                ? "bg-red-500"
                : nc.severity === "high"
                  ? "bg-orange-500"
                  : nc.severity === "medium"
                    ? "bg-yellow-500"
                    : "bg-blue-400",
            )}
          />
          <span className="font-semibold text-sm leading-tight line-clamp-2 flex-1">
            {nc.title}
          </span>
        </div>

        {nc.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {nc.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              sev.className,
            )}
          >
            {sev.label}
          </span>
          {nc.category && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Tag className="h-2.5 w-2.5" />
              {nc.category}
            </span>
          )}
          {nc.status === "reopened" && (
            <Badge variant="destructive" className="text-[10px] h-5 gap-0.5">
              <RotateCcw className="h-2.5 w-2.5" />
              Reaberta
            </Badge>
          )}
          {reopenCount > 1 && (
            <Badge variant="outline" className="text-[10px] h-5 gap-0.5">
              <RotateCcw className="h-2.5 w-2.5" />
              {reopenCount}x
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {nc.responsible_user_name && (
            <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5 truncate max-w-[140px]">
              <User className="h-3 w-3 shrink-0" />
              {nc.responsible_user_name}
            </span>
          )}
          {deadlineDisplay && (
            <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-muted/50">
              <Clock className="h-3 w-3" />
              {deadlineDisplay}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
