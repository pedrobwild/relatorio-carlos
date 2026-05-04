import { parseISO, isPast } from "date-fns";
import { CalendarIcon, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBR } from "@/lib/dates";
import { useStageDates, type StageDate } from "@/hooks/useStageDates";
import { Skeleton } from "@/components/ui/skeleton";
import { journeyCopy } from "@/constants/journeyCopy";

interface UpcomingDatesBarProps {
  projectId: string;
}

function getEffectiveDate(sd: StageDate): string | null {
  return sd.bwild_confirmed_at || sd.customer_proposed_at;
}

export function UpcomingDatesBar({ projectId }: UpcomingDatesBarProps) {
  const { data: allDates, isLoading } = useStageDates(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-40 rounded-full shrink-0" />
        ))}
      </div>
    );
  }

  const upcoming = (allDates || [])
    .filter((d) => {
      const eff = getEffectiveDate(d);
      return eff && !isPast(parseISO(eff));
    })
    .sort((a, b) => {
      const da = getEffectiveDate(a)!;
      const db = getEffectiveDate(b)!;
      return new Date(da).getTime() - new Date(db).getTime();
    })
    .slice(0, 6);

  if (upcoming.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {journeyCopy.page.next_milestones.title}
        </p>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {upcoming.map((sd) => {
          const isConfirmed = !!sd.bwild_confirmed_at;
          const effDate = getEffectiveDate(sd)!;
          const typeInfo = journeyCopy.dates.types[sd.date_type];
          const emoji = typeInfo?.emoji || "📌";

          return (
            <div
              key={sd.id}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                isConfirmed
                  ? "bg-[hsl(var(--success-light))] border-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]"
                  : "bg-[hsl(var(--warning-light))] border-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]",
              )}
            >
              <span aria-hidden>{emoji}</span>
              <span className="font-medium truncate max-w-[120px]">
                {sd.title}
              </span>
              <span className="text-[11px] tabular-nums whitespace-nowrap">
                {formatBR(effDate, "dd/MM")}
              </span>
              {isConfirmed ? (
                <CheckCircle2 className="h-3 w-3 shrink-0" />
              ) : (
                <Clock className="h-3 w-3 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
