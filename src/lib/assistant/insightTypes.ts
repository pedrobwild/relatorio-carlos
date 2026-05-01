export type InsightDomain =
  | "financeiro"
  | "compras"
  | "cronograma"
  | "ncs"
  | "pendencias"
  | "cs"
  | "obras"
  | "fornecedores"
  | "formalizacoes"
  | "arquivos"
  | "auditoria"
  | "outros";

export type InsightType =
  | "descriptive"
  | "diagnostic"
  | "predictive"
  | "prescriptive"
  | "comparative"
  | "financial"
  | "operational"
  | "funnel"
  | "quality"
  | "risk"
  | "anomaly"
  | "trend"
  | "forecast"
  | "prioritization";

export type InsightSeverity = "info" | "low" | "medium" | "high" | "critical";

export type VisualizationType =
  | "kpi"
  | "table"
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "funnel"
  | "scatter"
  | "heatmap";

export interface InsightEvidence {
  label: string;
  value: string | number;
  previousValue?: string | number;
  changeAbs?: number;
  changePct?: number;
  period?: string;
  entityId?: string;
  entityName?: string;
}

export interface InsightVisualizationHint {
  type: VisualizationType;
  title?: string;
  x?: string;
  y?: string;
  groupBy?: string;
}

export interface Insight {
  id: string;
  type: InsightType;
  domain: InsightDomain;
  title: string;
  summary: string;
  evidence: InsightEvidence[];
  severity: InsightSeverity;
  confidence: number;
  recommendedAction?: string;
  suggestedQuestions?: string[];
  visualization?: InsightVisualizationHint;
  limitations?: string[];
  sqlUsed?: string;
}

export interface MetricSnapshot {
  label: string;
  value: string | number;
  unit?: string;
  changePct?: number;
  severity?: InsightSeverity;
}

export interface DataQualityWarning {
  field: string;
  table?: string;
  issue:
    | "null_values"
    | "invalid_date"
    | "unexpected_status"
    | "missing_relation"
    | "negative_value"
    | "missing_supplier"
    | "missing_planning"
    | "inconsistent_status_date";
  count: number;
  severity: InsightSeverity;
  message: string;
}

export interface AnalysisResult {
  answer: string;
  executive_summary?: string;
  insights: Insight[];
  metrics: MetricSnapshot[];
  rows: Record<string, unknown>[];
  rows_returned: number;
  sql?: string;
  domain?: InsightDomain;
  status: string;
  confidence?: number;
  limitations?: string[];
  suggested_questions?: string[];
  visualizations?: InsightVisualizationHint[];
  data_quality?: DataQualityWarning[];
  latency_ms?: number;
}
