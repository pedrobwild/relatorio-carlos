import { useMemo } from "react";
import { differenceInDays, parseISO, isPast, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronRight,
  Eye,
  Check,
  Circle,
  Lock,
  Clock,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";
import { useStageDates, type StageDate } from "@/hooks/useStageDates";

/* ─── Visual state config ─── */

type HeroVisualState =
  | "waiting_client"
  | "in_progress"
  | "validating"
  | "completed"
  | "next"
  | "blocked";

function deriveHeroState(stage: JourneyStage): HeroVisualState {
  if (stage.status === "completed") return "completed";
  if (stage.status === "waiting_action") return "waiting_client";
  if (stage.status === "in_progress") return "in_progress";
  if (stage.dependencies_text) return "blocked";
  return "next";
}

const heroConfig: Record<
  HeroVisualState,
  {
    label: string;
    chipClass: string;
    Icon: React.ElementType;
    borderClass: string;
    bgClass: string;
  }
> = {
  waiting_client: {
    label: "Aguardando você",
    chipClass:
      "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]",
    Icon: Clock,
    borderClass: "border-[hsl(var(--warning)/0.3)]",
    bgClass: "bg-[hsl(var(--warning)/0.03)]",
  },
  in_progress: {
    label: "Em andamento",
    chipClass: "bg-accent text-primary border-primary/20",
    Icon: ChevronRight,
    borderClass: "border-primary/20",
    bgClass: "bg-primary/[0.03]",
  },
  validating: {
    label: "Em validação",
    chipClass:
      "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]",
    Icon: Eye,
    borderClass: "border-[hsl(var(--warning)/0.3)]",
    bgClass: "bg-[hsl(var(--warning)/0.03)]",
  },
  completed: {
    label: "Concluída",
    chipClass:
      "bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]",
    Icon: Check,
    borderClass: "border-[hsl(var(--success)/0.2)]",
    bgClass: "bg-[hsl(var(--success)/0.03)]",
  },
  next: {
    label: "Próxima etapa",
    chipClass: "bg-accent text-accent-foreground border-border",
    Icon: Circle,
    borderClass: "border-border",
    bgClass: "bg-muted/30",
  },
  blocked: {
    label: "Bloqueada",
    chipClass: "bg-muted text-muted-foreground border-border",
    Icon: Lock,
    borderClass: "border-border",
    bgClass: "bg-muted/20",
  },
};

/* ─── Helpers ─── */

function getEffectiveDate(sd: StageDate): string | null {
  return sd.bwild_confirmed_at || sd.customer_proposed_at;
}

function computeWaitingDays(stage: JourneyStage): number | null {
  if (stage.status !== "waiting_action") return null;
  const ref =
    stage.waiting_since || stage.confirmed_start || stage.proposed_start;
  if (!ref) return null;
  const days = differenceInDays(new Date(), parseISO(ref));
  return days > 0 ? days : null;
}

/* ─── Component ─── */

interface CurrentStageHeroProps {
  stage: JourneyStage;
  projectId: string;
  onCtaClick?: () => void;
}

export function CurrentStageHero({
  stage,
  projectId,
  onCtaClick,
}: CurrentStageHeroProps) {
  const { data: allDates, isLoading: datesLoading } = useStageDates(
    projectId,
    stage.id,
  );
  const heroState = deriveHeroState(stage);
  const cfg = heroConfig[heroState];
  const Icon = cfg.Icon;
  const waitingDays = computeWaitingDays(stage);

  // Next upcoming date for this stage
  const nextDate = useMemo(() => {
    if (!allDates) return null;
    const upcoming = allDates
      .map((d) => ({ ...d, eff: getEffectiveDate(d) }))
      .filter((d) => d.eff && !isPast(parseISO(d.eff!)))
      .sort((a, b) => new Date(a.eff!).getTime() - new Date(b.eff!).getTime());
    return upcoming[0] || null;
  }, [allDates]);

  const hasCta = stage.cta_visible && stage.cta_text;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 md:p-5 space-y-3 transition-all",
        cfg.borderClass,
        cfg.bgClass,
      )}
    >
      {/* Top row: stage name + status chip */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Etapa atual
          </p>
          <h2 className="text-base md:text-lg font-bold text-foreground leading-tight truncate">
            {stage.name}
          </h2>
        </div>
        <Badge
          className={cn(
            "shrink-0 text-[11px] md:text-xs font-semibold border gap-1 px-2.5 py-1",
            cfg.chipClass,
          )}
        >
          <Icon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </div>

      {/* Info row: waiting counter + next date */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {waitingDays !== null && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[hsl(var(--warning))]">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tabular-nums">
                Aguardando você há {waitingDays}{" "}
                {waitingDays === 1 ? "dia" : "dias"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground ml-5">
              Para manter o planejamento alinhado, esta etapa está aguardando
              sua ação.
            </p>
          </div>
        )}

        {datesLoading ? (
          <Skeleton className="h-4 w-32 rounded" />
        ) : nextDate ? (
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Próxima data:</span>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                nextDate.bwild_confirmed_at
                  ? "text-[hsl(var(--success))]"
                  : "text-[hsl(var(--warning))]",
              )}
            >
              {format(parseISO(nextDate.eff!), "dd 'de' MMMM", {
                locale: ptBR,
              })}
            </span>
          </div>
        ) : null}
      </div>

      {/* CTA button */}
      {hasCta && (
        <Button
          className="w-full md:w-auto min-h-[44px] gap-2"
          onClick={onCtaClick}
        >
          {stage.cta_text}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/* ─── Skeleton ─── */

export function CurrentStageHeroSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-5 w-40 rounded" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
    </div>
  );
}
