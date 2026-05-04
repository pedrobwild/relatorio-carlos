import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  ChevronRight,
  Eye,
  Lock,
  Circle,
  CalendarClock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";
import { journeyCopy } from "@/constants/journeyCopy";
import { deriveVisualState, type VisualState } from "./deriveVisualState";

const vsConfig: Record<
  VisualState,
  {
    label: string;
    dotClass: string;
    textClass: string;
    badgeClass: string;
    Icon: React.ElementType;
  }
> = {
  completed: {
    label: journeyCopy.status.completed.label,
    dotClass: "bg-[hsl(var(--success))] text-white",
    textClass: "text-muted-foreground",
    badgeClass: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
    Icon: Check,
  },
  current: {
    label: journeyCopy.status.current.label,
    dotClass: "bg-primary text-primary-foreground",
    textClass: "text-foreground font-semibold",
    badgeClass: "bg-accent text-primary",
    Icon: ChevronRight,
  },
  validating: {
    label: journeyCopy.status.in_review.label,
    dotClass: "bg-[hsl(var(--warning))] text-white",
    textClass: "text-foreground font-medium",
    badgeClass: "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))]",
    Icon: Eye,
  },
  next: {
    label: journeyCopy.status.next.label,
    dotClass: "bg-accent text-accent-foreground",
    textClass: "text-muted-foreground",
    badgeClass: "bg-accent text-accent-foreground",
    Icon: Circle,
  },
  blocked: {
    label: journeyCopy.status.blocked.label,
    dotClass: "bg-muted text-muted-foreground",
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
    Icon: Lock,
  },
  future: {
    label: journeyCopy.status.future.label,
    dotClass: "bg-muted text-muted-foreground",
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
    Icon: Circle,
  },
};

/* ─── Component ─── */

interface RoadmapMacroProps {
  stages: JourneyStage[];
  projectId?: string;
  deliveryDate: string | null | undefined;
}

export function RoadmapMacro({ stages, deliveryDate }: RoadmapMacroProps) {
  const formattedDelivery = useMemo(() => {
    if (!deliveryDate) return null;
    try {
      return format(parseISO(deliveryDate), "dd 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      });
    } catch {
      return null;
    }
  }, [deliveryDate]);

  return (
    <div className="space-y-3">
      {/* Horizontal phase strip */}
      <div className="rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
          {stages.map((stage, idx) => {
            const vs = deriveVisualState(stage, idx, stages);
            const cfg = vsConfig[vs];
            const isLast = idx === stages.length - 1;

            return (
              <div key={stage.id} className="flex items-center shrink-0">
                {/* Phase pill */}
                <div className="flex flex-col items-center gap-1 min-w-[64px] md:min-w-[80px]">
                  <div
                    className={cn(
                      "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors",
                      cfg.dotClass,
                    )}
                  >
                    <cfg.Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] md:text-xs text-center leading-tight max-w-[72px] md:max-w-[88px]",
                      cfg.textClass,
                    )}
                  >
                    {stage.name}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-4 md:w-6 h-px mx-0.5",
                      vs === "completed"
                        ? "bg-[hsl(var(--success))]"
                        : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery date chip */}
      {formattedDelivery && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">
              Previsão de conclusão:
            </span>
            <span className="font-medium text-foreground">
              {formattedDelivery}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoadmapMacroSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="flex items-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <Skeleton className="w-8 h-8 rounded-full" />
              {i < 5 && <Skeleton className="w-6 h-px" />}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-52 rounded-lg" />
      </div>
    </div>
  );
}
