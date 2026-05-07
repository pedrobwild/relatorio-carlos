import { parseISO } from "date-fns";
import { combineDateAndTimeISO } from "@/lib/dates";
import { CheckCircle2, Clock, CalendarIcon, AlertTriangle } from "lucide-react";
import { journeyCopy } from "@/constants/journeyCopy";
import type { StageDate } from "@/hooks/useStageDates";

// ─── Status helpers ───

export type DateStatus = "confirmed" | "proposed" | "empty";

// eslint-disable-next-line react-refresh/only-export-components
export function getDateStatus(sd: StageDate): DateStatus {
  if (sd.bwild_confirmed_at) return "confirmed";
  if (sd.customer_proposed_at) return "proposed";
  return "empty";
}

// eslint-disable-next-line react-refresh/only-export-components
export const statusConfig: Record<
  DateStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  confirmed: {
    label: journeyCopy.dates.status.confirmed,
    badgeClass:
      "bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]",
    icon: CheckCircle2,
  },
  proposed: {
    label: journeyCopy.dates.status.proposed,
    badgeClass:
      "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]",
    icon: Clock,
  },
  empty: {
    label: journeyCopy.dates.status.empty,
    badgeClass: "bg-muted text-muted-foreground border-border/50",
    icon: CalendarIcon,
  },
};

// eslint-disable-next-line react-refresh/only-export-components
export const typeLabels = journeyCopy.dates.types;

// eslint-disable-next-line react-refresh/only-export-components
export function buildISO(date: Date, time: string): string {
  return combineDateAndTimeISO(date, time);
}

// ─── Divergence Warning ───

export function DivergenceWarning({
  proposed,
  confirmed,
}: {
  proposed: string;
  confirmed: string;
}) {
  const pDate = parseISO(proposed);
  const cDate = parseISO(confirmed);
  const diffMs = Math.abs(cDate.getTime() - pDate.getTime());
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return null;

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-md bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning)/0.15)]"
      role="alert"
    >
      <AlertTriangle
        className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5"
        aria-hidden
      />
      <p className="text-xs text-[hsl(var(--warning))]">
        A data confirmada difere da proposta em{" "}
        <span className="font-semibold">
          {diffDays}{" "}
          {diffDays > 1
            ? journeyCopy.dates.divergence.days
            : journeyCopy.dates.divergence.day}
        </span>
        .{journeyCopy.dates.divergence.suffix}
      </p>
    </div>
  );
}
