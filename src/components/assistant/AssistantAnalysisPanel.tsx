import type { AnalysisResult } from "@/lib/assistant";
import { InsightCard } from "./InsightCard";
import { MetricCard } from "./MetricCard";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { DataQualityWarnings } from "./DataQualityWarnings";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { InsightVisualization } from "./InsightVisualization";
import { UsedDataTable } from "./UsedDataTable";
import { AlertTriangle, Lightbulb } from "lucide-react";

interface Props {
  analysis: Partial<AnalysisResult>;
  rows: Record<string, unknown>[];
  onAsk?: (q: string) => void;
}

export function AssistantAnalysisPanel({ analysis, rows, onAsk }: Props) {
  const {
    insights = [],
    metrics = [],
    visualizations = [],
    suggested_questions = [],
    data_quality = [],
    limitations = [],
    confidence,
  } = analysis;

  const hasContent =
    insights.length > 0 ||
    metrics.length > 0 ||
    (visualizations?.length ?? 0) > 0 ||
    (data_quality?.length ?? 0) > 0;

  if (!hasContent && !rows?.length) return null;

  const primaryViz = visualizations?.find((v) => v.type !== "kpi" && v.type !== "table");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" />
          Análise automática
        </p>
        {typeof confidence === "number" && <ConfidenceBadge confidence={confidence} />}
      </div>

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {metrics.slice(0, 8).map((m, i) => (
            <MetricCard key={i} metric={m} />
          ))}
        </div>
      )}

      {primaryViz && rows.length > 1 && (
        <div className="rounded-md border bg-card/40 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{primaryViz.title}</p>
          <InsightVisualization hint={primaryViz} rows={rows} />
        </div>
      )}

      {insights.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {insights.slice(0, 6).map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}

      {data_quality && data_quality.length > 0 && <DataQualityWarnings warnings={data_quality} />}

      {limitations && limitations.length > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            <p className="text-xs font-semibold">Limitações</p>
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground list-disc pl-5">
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <UsedDataTable rows={rows} rowsReturned={rows.length} />

      {suggested_questions && suggested_questions.length > 0 && onAsk && (
        <SuggestedQuestions questions={suggested_questions} onAsk={onAsk} />
      )}
    </div>
  );
}
