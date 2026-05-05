import { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInCalendarDays, startOfWeek, endOfWeek, isWithinInterval, addWeeks, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  Play,
  MoreHorizontal,
  Pencil,
  Upload,
  Wand2,
  Bookmark,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { type ProjectActivity } from "@/hooks/useProjectActivities";
import { cn } from "@/lib/utils";

interface Props {
  activities: ProjectActivity[];
  loading: boolean;
  hasBaseline: boolean;
  onEditMode: () => void;
  onImport: () => void;
  onSaveBaseline: () => void;
  onGenerateAI?: () => void;
  projectName?: string;
}

type ActivityStatus =
  | "overdue"
  | "in_progress"
  | "upcoming"
  | "completed"
  | "pending";
type FilterValue =
  | "all"
  | "attention"
  | "in_progress"
  | "completed"
  | "pending";

function getActivityStatus(
  act: ProjectActivity,
  today: string,
): ActivityStatus {
  if (act.actual_end) return "completed";
  if (act.actual_start && !act.actual_end) {
    if (act.planned_end < today) return "overdue";
    return "in_progress";
  }
  if (act.planned_end < today) return "overdue";
  if (act.planned_start <= today) return "in_progress";
  // Upcoming = starts within 7 days
  const daysUntilStart = differenceInCalendarDays(
    new Date(act.planned_start + "T00:00:00"),
    new Date(),
  );
  if (daysUntilStart <= 7) return "upcoming";
  return "pending";
}

const statusConfig: Record<
  ActivityStatus,
  { icon: typeof AlertTriangle; label: string; color: string; dot: string }
> = {
  overdue: {
    icon: AlertTriangle,
    label: "Atrasada",
    color: "text-destructive",
    dot: "bg-destructive",
  },
  in_progress: {
    icon: Play,
    label: "Em andamento",
    color: "text-primary",
    dot: "bg-primary",
  },
  upcoming: {
    icon: Clock,
    label: "Próxima",
    color: "text-[hsl(var(--warning))]",
    dot: "bg-[hsl(var(--warning))]",
  },
  completed: {
    icon: CheckCircle2,
    label: "Concluída",
    color: "text-[hsl(var(--success))]",
    dot: "bg-[hsl(var(--success))]",
  },
  pending: {
    icon: Circle,
    label: "Pendente",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

const filters: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "attention", label: "⚠️ Atenção" },
  { value: "in_progress", label: "Andamento" },
  { value: "completed", label: "Concluídas" },
  { value: "pending", label: "Pendentes" },
];

export function CronogramaMobileView({
  activities,
  loading,
  hasBaseline,
  onEditMode,
  onImport,
  onSaveBaseline,
  onGenerateAI,
  projectName: _projectName,
}: Props) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["overdue", "in_progress", "upcoming"]),
  );

  // "Today" reference — refreshed every 60s to handle day rollover
  const [tick, setTick] = useState(0);
  const todayRef = useRef(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toISOString().slice(0, 10);
      if (now !== todayRef.current) {
        todayRef.current = now;
        setTick((t) => t + 1);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const today = todayRef.current;

  // Enrich activities with computed status
  const enriched = useMemo(
    () =>
      activities.map((act) => ({
        ...act,
        computedStatus: getActivityStatus(act, today),
      })),
    [activities, today],
  );

  // Filter
  const filtered = useMemo(() => {
    if (filter === "all") return enriched;
    if (filter === "attention")
      return enriched.filter(
        (a) =>
          a.computedStatus === "overdue" || a.computedStatus === "upcoming",
      );
    if (filter === "in_progress")
      return enriched.filter((a) => a.computedStatus === "in_progress");
    if (filter === "completed")
      return enriched.filter((a) => a.computedStatus === "completed");
    if (filter === "pending")
      return enriched.filter(
        (a) =>
          a.computedStatus === "pending" || a.computedStatus === "upcoming",
      );
    return enriched;
  }, [enriched, filter]);

  // Stats — always follow the visible (filtered) list for consistency
  const stats = useMemo(() => {
    const totalWeight = filtered.reduce((s, a) => s + a.weight, 0);
    const completedWeight = filtered
      .filter((a) => a.actual_end)
      .reduce((s, a) => s + a.weight, 0);
    const progress =
      totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    const overdue = filtered.filter(
      (a) => a.computedStatus === "overdue",
    ).length;
    const inProgress = filtered.filter(
      (a) => a.computedStatus === "in_progress",
    ).length;
    const completed = filtered.filter(
      (a) => a.computedStatus === "completed",
    ).length;
    return { progress, overdue, inProgress, completed, total: filtered.length };
  }, [filtered]);

  // Group by status
  const grouped = useMemo(() => {
    const groups: Record<ActivityStatus, typeof filtered> = {
      overdue: [],
      in_progress: [],
      upcoming: [],
      pending: [],
      completed: [],
    };
    filtered.forEach((a) => groups[a.computedStatus].push(a));
    return groups;
  }, [filtered]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) return <PageSkeleton rows={6} />;

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Cronograma não cadastrado"
        description="Cadastre atividades ou gere automaticamente com IA."
        action={{ label: "Editar cronograma", onClick: onEditMode }}
      />
    );
  }

  const statusOrder: ActivityStatus[] = [
    "overdue",
    "in_progress",
    "upcoming",
    "pending",
    "completed",
  ];

  return (
    <div className="space-y-4 pb-bottom-nav">
      {/* Progress summary card */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold tabular-nums">
              {stats.progress}%
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">
              concluído
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {stats.overdue > 0 && (
              <span className="flex items-center gap-1 text-destructive font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> {stats.overdue}
              </span>
            )}
            <span className="flex items-center gap-1 text-primary">
              <Play className="h-3 w-3" /> {stats.inProgress}
            </span>
            <span className="flex items-center gap-1 text-[hsl(var(--success))]">
              <CheckCircle2 className="h-3 w-3" /> {stats.completed}
            </span>
          </div>
        </div>
        <Progress
          value={stats.progress}
          className={cn(
            "h-2.5 rounded-full",
            stats.overdue > 0
              ? "[&>div]:bg-[hsl(var(--warning))]"
              : "[&>div]:bg-[hsl(var(--success))]",
          )}
        />
        <p className="text-[11px] text-muted-foreground">
          {stats.completed} de {stats.total} atividades
          {filter !== "all" && ` · ${filtered.length} visíveis`}
          {" · "}
          {stats.overdue > 0 ? `${stats.overdue} em atraso` : "No prazo"}
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex items-center h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
              filter === f.value
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/60 text-muted-foreground active:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped activity list */}
      <div className="space-y-2">
        {statusOrder.map((statusKey) => {
          const items = grouped[statusKey];
          if (items.length === 0) return null;
          const config = statusConfig[statusKey];
          const isOpen = expandedGroups.has(statusKey);
          const _Icon = config.icon;

          return (
            <Collapsible
              key={statusKey}
              open={isOpen}
              onOpenChange={() => toggleGroup(statusKey)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 px-1 touch-target">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", config.dot)} />
                  <span className="text-sm font-bold">{config.label}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 font-bold"
                  >
                    {items.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 pb-2">
                  <AnimatePresence>
                    {items.map((act, i) => (
                      <ActivityCard key={act.id} activity={act} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Actions sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl gap-2 text-sm font-medium"
          >
            <MoreHorizontal className="h-4 w-4" /> Ações do Cronograma
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-base">Ações</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            <SheetActionButton
              icon={Pencil}
              label="Editar cronograma"
              description="Abrir editor completo"
              onClick={onEditMode}
            />
            {onGenerateAI && (
              <SheetActionButton
                icon={Wand2}
                label="Gerar com IA"
                description="A partir do orçamento"
                onClick={onGenerateAI}
              />
            )}
            <SheetActionButton
              icon={Upload}
              label="Importar planilha"
              description="CSV ou Excel"
              onClick={onImport}
            />
            <SheetActionButton
              icon={Bookmark}
              label={hasBaseline ? "Atualizar baseline" : "Salvar baseline"}
              description="Fixar datas atuais como referência"
              onClick={onSaveBaseline}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ActivityCard({
  activity: act,
  index,
}: {
  activity: ProjectActivity & { computedStatus: ActivityStatus };
  index: number;
}) {
  const config = statusConfig[act.computedStatus];
  const isOverdue = act.computedStatus === "overdue";
  const hasDetails = !!act.detailed_description?.trim();
  // Visível por padrão para TODOS os roles; o usuário pode ocultar.
  const [showDetails, setShowDetails] = useState(hasDetails);
  const daysInfo = useMemo(() => {
    if (act.actual_end) return null;
    if (isOverdue) {
      const days = differenceInCalendarDays(
        new Date(),
        new Date(act.planned_end + "T00:00:00"),
      );
      return `${days}d atrasada`;
    }
    if (act.computedStatus === "upcoming") {
      const days = differenceInCalendarDays(
        new Date(act.planned_start + "T00:00:00"),
        new Date(),
      );
      return `em ${days}d`;
    }
    if (act.computedStatus === "in_progress") {
      const days = differenceInCalendarDays(
        new Date(act.planned_end + "T00:00:00"),
        new Date(),
      );
      return days >= 0 ? `${days}d restantes` : `${Math.abs(days)}d atrasada`;
    }
    return null;
  }, [act, isOverdue]);

  const duration =
    differenceInCalendarDays(
      new Date(act.planned_end + "T00:00:00"),
      new Date(act.planned_start + "T00:00:00"),
    ) + 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12, delay: index * 0.02 }}
    >
      <div
        className={cn(
          "relative rounded-xl border border-border/40 bg-card px-3 py-2.5 transition-all",
          isOverdue && "border-destructive/30 bg-destructive/5",
          act.computedStatus === "completed" && "opacity-60",
        )}
      >
        {/* Left status indicator */}
        <div
          className={cn(
            "absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full",
            config.dot,
          )}
        />

        <div className="pl-2.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "text-sm font-semibold leading-snug line-clamp-2",
                act.computedStatus === "completed" && "line-through",
              )}
            >
              {act.description || `Atividade ${act.sort_order + 1}`}
            </span>
            {act.weight > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-bold shrink-0 tabular-nums"
              >
                {act.weight}%
              </Badge>
            )}
          </div>

          {/* Etapa badge — visible to all roles */}
          {act.etapa && (
            <div className="mt-1">
              <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent text-accent-foreground">
                {act.etapa}
              </span>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(act.planned_start + "T00:00:00"), "dd/MM", {
                locale: ptBR,
              })}
              {" → "}
              {format(new Date(act.planned_end + "T00:00:00"), "dd/MM", {
                locale: ptBR,
              })}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>{duration}d</span>
            {daysInfo && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span
                  className={cn(
                    "font-semibold",
                    isOverdue
                      ? "text-destructive"
                      : act.computedStatus === "upcoming"
                        ? "text-[hsl(var(--warning))]"
                        : "text-primary",
                  )}
                >
                  {daysInfo}
                </span>
              </>
            )}
          </div>

          {/* Progress bar for in-progress activities */}
          {act.computedStatus === "in_progress" && act.actual_start && (
            <div className="mt-2">
              <Progress
                value={Math.min(
                  100,
                  Math.max(
                    5,
                    (differenceInCalendarDays(
                      new Date(),
                      new Date(act.actual_start + "T00:00:00"),
                    ) /
                      Math.max(
                        1,
                        differenceInCalendarDays(
                          new Date(act.planned_end + "T00:00:00"),
                          new Date(act.actual_start + "T00:00:00"),
                        ),
                      )) *
                      100,
                  ),
                )}
                className="h-1.5 rounded-full [&>div]:bg-primary"
              />
            </div>
          )}

          {/* Detailed description — visible to all roles */}
          {hasDetails && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors touch-target"
                aria-expanded={showDetails}
              >
                <FileText className="h-3 w-3" />
                {showDetails ? "Ocultar descrição" : "Ver descrição da etapa"}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showDetails && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {showDetails && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-1.5 text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-secondary/30 rounded-md p-2 overflow-hidden"
                  >
                    {act.detailed_description}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SheetActionButton({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 active:bg-muted transition-colors touch-target text-left"
    >
      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
    </button>
  );
}
