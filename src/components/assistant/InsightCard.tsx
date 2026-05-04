import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Activity,
  Target,
  GitCompareArrows,
  BarChart3,
} from "lucide-react";
import type { Insight } from "@/lib/assistant";
import { InsightSeverityBadge } from "./InsightSeverityBadge";

const TYPE_ICON: Record<string, typeof Lightbulb> = {
  descriptive: BarChart3,
  diagnostic: Activity,
  predictive: TrendingUp,
  prescriptive: Target,
  comparative: GitCompareArrows,
  financial: BarChart3,
  operational: Activity,
  funnel: BarChart3,
  quality: AlertTriangle,
  risk: AlertTriangle,
  anomaly: AlertTriangle,
  trend: TrendingUp,
  forecast: TrendingUp,
  prioritization: Target,
};

export function InsightCard({
  insight,
  className,
}: {
  insight: Insight;
  className?: string;
}) {
  const Icon = TYPE_ICON[insight.type] ?? Lightbulb;
  const tone =
    insight.severity === "critical"
      ? "border-red-200/80"
      : insight.severity === "high"
        ? "border-orange-200/80"
        : insight.severity === "medium"
          ? "border-amber-200/80"
          : "border-border";

  return (
    <Card className={cn("border", tone, className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight">
              {insight.title}
            </CardTitle>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <InsightSeverityBadge severity={insight.severity} />
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {insight.type}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {Math.round(insight.confidence * 100)}% confiança
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.summary}
        </p>

        {insight.evidence?.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {insight.evidence.slice(0, 6).map((e, i) => (
              <div
                key={i}
                className="rounded-md border bg-muted/30 px-2 py-1.5"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {e.label}
                </p>
                <p
                  className="text-sm font-semibold truncate"
                  title={String(e.value)}
                >
                  {e.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {insight.recommendedAction && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
            <span className="font-semibold">Ação recomendada:</span>{" "}
            {insight.recommendedAction}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
