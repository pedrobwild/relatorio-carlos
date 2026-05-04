import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { journeyCopy } from "@/constants/journeyCopy";
import { typeLabels } from "./helpers";
import type { StageDate } from "@/hooks/useStageDates";

export function MiniTimeline({ dates }: { dates: StageDate[] }) {
  const timelineItems = dates
    .map((sd) => {
      const dateStr = sd.bwild_confirmed_at || sd.customer_proposed_at;
      if (!dateStr) return null;
      const isConfirmed = !!sd.bwild_confirmed_at;
      const tl = typeLabels[sd.date_type] || {
        emoji: "📌",
        label: sd.date_type,
      };
      return {
        id: sd.id,
        date: parseISO(dateStr),
        dateStr,
        title: sd.title,
        isConfirmed,
        tl,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.getTime() - b!.date.getTime()) as {
    id: string;
    date: Date;
    dateStr: string;
    title: string;
    isConfirmed: boolean;
    tl: { emoji: string; label: string };
  }[];

  if (timelineItems.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {journeyCopy.dates.miniTimeline.title}
      </p>
      <ol
        className="relative pl-4 space-y-0 list-none"
        aria-label="Linha do tempo de datas"
      >
        <div
          className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
          aria-hidden
        />
        {timelineItems.map((item) => (
          <li
            key={item.id}
            className="relative flex items-start gap-2.5 py-1.5"
          >
            <div
              className={cn(
                "absolute -left-4 top-[7px] h-2.5 w-2.5 rounded-full border-2 border-background shrink-0",
                item.isConfirmed
                  ? "bg-[hsl(var(--success))]"
                  : "bg-[hsl(var(--warning))]",
              )}
              aria-hidden
            />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs" aria-hidden>
                {item.tl.emoji}
              </span>
              <span className="text-xs font-medium text-foreground truncate">
                {item.title}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap ml-auto">
                {format(item.date, "dd/MM", { locale: ptBR })}
              </span>
              {item.isConfirmed ? (
                <CheckCircle2
                  className="h-3 w-3 text-[hsl(var(--success))] shrink-0"
                  aria-label="Confirmada"
                />
              ) : (
                <Clock
                  className="h-3 w-3 text-[hsl(var(--warning))] shrink-0"
                  aria-label="Proposta"
                />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
