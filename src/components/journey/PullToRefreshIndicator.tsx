import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pulling: boolean;
  refreshing: boolean;
  pullDistance: number;
  threshold: number;
}

export function PullToRefreshIndicator({
  pulling,
  refreshing,
  pullDistance,
  threshold,
}: PullToRefreshIndicatorProps) {
  if (!pulling && !refreshing) return null;

  const ready = pullDistance >= threshold;
  const opacity = Math.min(pullDistance / threshold, 1);

  return (
    <div
      className="flex items-center justify-center py-2 transition-all"
      style={{ height: refreshing ? 40 : pullDistance * 0.5, opacity }}
    >
      {refreshing ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <ArrowDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            ready && "rotate-180 text-primary",
          )}
        />
      )}
    </div>
  );
}
