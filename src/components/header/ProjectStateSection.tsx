import { useState, useCallback } from "react";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  formatDateShort,
  formatDateFull,
  type ProjectMetrics,
  type MilestoneItem,
  type MilestoneKey,
} from "./types";

interface ProjectStateSectionProps {
  metrics: ProjectMetrics;
  displayStartDate: string | null;
  displayEndDate: string | null;
  endDate: string | null;
  dateChangeInfo: { originalDate: string; newDate: string };
  onShowDateChangeAlert: () => void;
}

export function ProjectStateSection({
  metrics,
  displayStartDate,
  displayEndDate,
  endDate,
  dateChangeInfo,
  onShowDateChangeAlert,
}: ProjectStateSectionProps) {
  return (
    <div className="px-6 py-3 border-t border-border bg-muted/30">
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <span className="text-meta font-semibold uppercase tracking-wider block mb-1">
            Etapa Atual
          </span>
          <p className="text-body font-semibold text-foreground break-words leading-snug">
            {metrics.currentActivity}
          </p>
          <Badge
            variant="secondary"
            className="mt-1.5 text-meta px-2 py-0.5 h-auto font-medium tabular-nums"
          >
            {metrics.completedActivities} de {metrics.totalActivities}{" "}
            atividades
          </Badge>
        </div>
        <Separator
          orientation="vertical"
          className="h-12 hidden lg:block self-center"
        />
        <div className="flex items-center gap-3 shrink-0 self-center">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-caption">Início</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {displayStartDate ? formatDateShort(displayStartDate) : "—"}
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-caption">Entrega</span>
            <button
              onClick={
                endDate === dateChangeInfo.originalDate
                  ? onShowDateChangeAlert
                  : undefined
              }
              className={cn(
                "text-sm font-bold tabular-nums",
                endDate === dateChangeInfo.originalDate
                  ? "text-warning underline decoration-dotted decoration-warning/50 cursor-pointer hover:decoration-warning"
                  : "text-foreground cursor-default",
              )}
            >
              {displayEndDate ? formatDateShort(displayEndDate) : "—"}
            </button>
            {endDate === dateChangeInfo.originalDate && (
              <AlertCircle className="w-3 h-3 text-warning" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MilestonesBarProps {
  milestoneItems: MilestoneItem[];
  canEdit: boolean;
  isMobile?: boolean;
  onMilestoneDateChange?: (
    key: MilestoneKey,
    date: string | null,
  ) => Promise<void>;
}

export function MilestonesBar({
  milestoneItems,
  canEdit,
  isMobile = false,
  onMilestoneDateChange,
}: MilestonesBarProps) {
  const [editingMilestone, setEditingMilestone] = useState<MilestoneKey | null>(
    null,
  );
  const [savingMilestone, setSavingMilestone] = useState(false);

  const handleSelect = useCallback(
    async (key: MilestoneKey, date: Date | undefined) => {
      if (!onMilestoneDateChange) return;
      setSavingMilestone(true);
      try {
        await onMilestoneDateChange(
          key,
          date ? date.toISOString().split("T")[0] : null,
        );
      } finally {
        setSavingMilestone(false);
        setEditingMilestone(null);
      }
    },
    [onMilestoneDateChange],
  );

  const handleClear = useCallback(
    async (key: MilestoneKey) => {
      if (!onMilestoneDateChange) return;
      setSavingMilestone(true);
      try {
        await onMilestoneDateChange(key, null);
      } finally {
        setSavingMilestone(false);
        setEditingMilestone(null);
      }
    },
    [onMilestoneDateChange],
  );

  // For clients (non-editors), only show milestones that have dates
  const visibleItems = canEdit
    ? milestoneItems
    : milestoneItems.filter((m) => !!m.value);
  if (visibleItems.length === 0) return null;

  if (isMobile) {
    return (
      <div className="mb-3">
        <span className="text-meta font-semibold uppercase tracking-wider block mb-1.5">
          Marcos do Projeto
        </span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {visibleItems.map((m) => (
            <div
              key={m.label}
              className="flex items-baseline justify-between gap-1"
            >
              {canEdit && onMilestoneDateChange ? (
                <Popover
                  open={editingMilestone === m.key}
                  onOpenChange={(open) =>
                    setEditingMilestone(open ? m.key : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button className="flex items-baseline justify-between gap-1 w-full rounded px-1 -mx-1 hover:bg-accent/60 transition-colors">
                      <span className="text-caption truncate">{m.label}</span>
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums shrink-0",
                          m.value
                            ? "text-foreground"
                            : "text-muted-foreground/40",
                        )}
                      >
                        {m.value ? formatDateShort(m.value) : "—"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <MilestonePopoverContent
                    milestone={m}
                    savingMilestone={savingMilestone}
                    onSelect={handleSelect}
                    onClear={handleClear}
                    onClose={() => setEditingMilestone(null)}
                  />
                </Popover>
              ) : (
                <>
                  <span className="text-caption truncate">{m.label}</span>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums shrink-0",
                      m.value ? "text-foreground" : "text-muted-foreground/40",
                    )}
                  >
                    {m.value ? formatDateShort(m.value) : "—"}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-2.5 border-t border-border bg-muted/15">
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
        <span className="text-meta font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          Marcos
        </span>
        <div className="flex items-center gap-3 flex-nowrap shrink-0">
          {visibleItems.map((m, i) => (
            <div key={m.label} className="flex items-center gap-3">
              {i > 0 && <span className="text-border">·</span>}
              {canEdit && onMilestoneDateChange ? (
                <Popover
                  open={editingMilestone === m.key}
                  onOpenChange={(open) =>
                    setEditingMilestone(open ? m.key : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors hover:bg-accent/60 cursor-pointer group",
                      )}
                    >
                      <span className="text-caption whitespace-nowrap">
                        {m.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums whitespace-nowrap",
                          m.value
                            ? "text-foreground"
                            : "text-muted-foreground/50",
                        )}
                      >
                        {m.value ? formatDateFull(m.value) : "—"}
                      </span>
                      <Pencil className="w-2.5 h-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors" />
                    </button>
                  </PopoverTrigger>
                  <MilestonePopoverContent
                    milestone={m}
                    savingMilestone={savingMilestone}
                    onSelect={handleSelect}
                    onClear={handleClear}
                    onClose={() => setEditingMilestone(null)}
                  />
                </Popover>
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-caption whitespace-nowrap">
                    {m.label}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums whitespace-nowrap",
                      m.value ? "text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {m.value ? formatDateFull(m.value) : "—"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MilestonePopoverContent({
  milestone,
  savingMilestone,
  onSelect,
  onClear,
  onClose,
}: {
  milestone: MilestoneItem;
  savingMilestone: boolean;
  onSelect: (key: MilestoneKey, date: Date | undefined) => void;
  onClear: (key: MilestoneKey) => void;
  onClose: () => void;
}) {
  return (
    <PopoverContent
      className="w-auto p-0"
      align="start"
      onPointerDownOutside={(e) => e.preventDefault()}
      onInteractOutside={(e) => e.preventDefault()}
    >
      <div className="p-2 border-b border-border flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          Marco: {milestone.label}
        </span>
        <div className="flex items-center gap-1">
          {milestone.value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onClear(milestone.key)}
              disabled={savingMilestone}
            >
              <X className="w-3 h-3 mr-1" />
              Limpar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </div>
      <Calendar
        mode="single"
        selected={
          milestone.value ? new Date(milestone.value + "T00:00:00") : undefined
        }
        onSelect={(date) => onSelect(milestone.key, date)}
        locale={ptBR}
        initialFocus
        className="p-3 pointer-events-auto"
      />
    </PopoverContent>
  );
}
