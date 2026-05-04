import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MetricSnapshot } from "@/lib/assistant";

export function MetricCard({
  metric,
  className,
}: {
  metric: MetricSnapshot;
  className?: string;
}) {
  const change = metric.changePct;
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4 space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
          {metric.label}
        </p>
        <p
          className="text-xl font-bold leading-tight truncate"
          title={String(metric.value)}
        >
          {metric.value}
        </p>
        {typeof change === "number" && (
          <p
            className={cn(
              "text-xs",
              change >= 0 ? "text-emerald-600" : "text-destructive",
            )}
          >
            {change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
