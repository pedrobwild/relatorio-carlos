import { generateInsights, metricsFromRow, buildExecutiveSummary, suggestFollowUps } from "./resultInterpreter";
import { recommendVisualizations } from "./visualizationRecommender";
import { analyzeDataQuality } from "./dataQualityAnalyzer";
import { rankInsights, scoreConfidence } from "./confidenceScoring";
import type { AnalysisResult, InsightDomain } from "./insightTypes";

export interface InsightEngineInput {
  question: string;
  rows: Record<string, unknown>[];
  rowsReturned: number;
  sql?: string;
  domain?: InsightDomain;
  status: string;
  answer?: string;
  latency_ms?: number;
}

/**
 * Combine all deterministic analyses into a single AnalysisResult.
 * The LLM-produced `answer` is preserved as-is; we *augment* it.
 */
export function buildAnalysis(input: InsightEngineInput): AnalysisResult {
  const domain: InsightDomain = (input.domain ?? "outros") as InsightDomain;
  const rows = Array.isArray(input.rows) ? input.rows : [];

  const insights = rankInsights(
    generateInsights({
      rows,
      question: input.question,
      domain,
      sql: input.sql,
    }),
  );

  const metrics = metricsFromRow(rows);
  const dataQuality = analyzeDataQuality(rows);
  const visualizations = recommendVisualizations({ rows });
  const followUps = suggestFollowUps(domain);

  const confidence = scoreConfidence({
    rowsReturned: input.rowsReturned,
    hasSql: Boolean(input.sql),
    matchesCatalog: true,
    domainKnown: domain !== "outros",
    dataQualityIssues: dataQuality.length,
    isExecutive: false,
  });

  const summary = buildExecutiveSummary({
    question: input.question,
    rows,
    insights,
    domain,
  });

  const limitations: string[] = [];
  if (rows.length === 0) limitations.push("Nenhum registro retornado para os filtros aplicados.");
  if (rows.length >= 200) limitations.push("Resultado truncado em 200 linhas pela RPC de segurança.");
  if (dataQuality.length > 0) limitations.push("Foram detectadas inconsistências de dados — veja a seção de qualidade.");
  if (!input.sql) limitations.push("Sem SQL gerado para auditoria.");

  return {
    answer: input.answer ?? "",
    executive_summary: summary,
    insights,
    metrics,
    rows,
    rows_returned: input.rowsReturned,
    sql: input.sql,
    domain,
    status: input.status,
    confidence,
    limitations,
    suggested_questions: followUps,
    visualizations,
    data_quality: dataQuality,
    latency_ms: input.latency_ms,
  };
}
