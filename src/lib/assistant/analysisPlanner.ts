import { classifyDomain } from "./domainClassifier";
import { parseDateRange } from "./dateRangeParser";
import { metricsForDomain } from "./metricCatalog";
import type { InsightDomain, InsightType } from "./insightTypes";

export type AnalysisIntent =
  | "lookup"
  | "aggregation"
  | "comparison"
  | "diagnostic"
  | "forecast"
  | "prioritization"
  | "data_quality"
  | "executive"
  | "ambiguous"
  | "out_of_scope"
  | "multi_query";

export interface AnalysisPlan {
  intent: AnalysisIntent;
  domain: InsightDomain;
  complexity: "simple" | "medium" | "advanced";
  requiredMetrics: string[];
  requiredDimensions: string[];
  requiredDateRange?: string;
  dateRangeSql?: string;
  sqlStrategy: "single_query" | "multi_query" | "aggregate_then_explain";
  expectedInsightTypes: InsightType[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  safetyNotes: string[];
}

const INTENT_HINTS: Array<{
  intent: AnalysisIntent;
  patterns: RegExp[];
}> = [
  {
    intent: "executive",
    patterns: [
      /resumo\s+executivo/i,
      /vis[aã]o\s+geral/i,
      /preciso\s+priorizar/i,
      /o\s+que\s+olhar\s+hoje/i,
      /maiores\s+riscos/i,
      /panor[aâ]ma/i,
      /5\s+a[cç][oõ]es/i,
    ],
  },
  {
    intent: "prioritization",
    patterns: [
      /priorit/i,
      /\bprioridade/i,
      /a[cç][oõ]es?\s+da\s+(semana|hoje)/i,
    ],
  },
  {
    intent: "comparison",
    patterns: [
      /vs\.?\s+|comparad/i,
      /em\s+rela[cç][aã]o/i,
      /m[eê]s\s+passado/i,
      /semana\s+passada/i,
      /diferen[cç]a\s+entre/i,
      /ontem/i,
    ],
  },
  {
    intent: "diagnostic",
    patterns: [
      /por\s+que/i,
      /motivo/i,
      /causa/i,
      /diagn[oó]stico/i,
      /onde\s+(estou|estamos)/i,
      /raz[aã]o/i,
      /\b80\/20\b/i,
      /pareto/i,
    ],
  },
  {
    intent: "forecast",
    patterns: [
      /prev(is|er|isão|isto)/i,
      /vai\s+vencer/i,
      /tend[eê]ncia/i,
      /projetad[oa]/i,
      /forecast/i,
      /acabar\s+at[eé]/i,
    ],
  },
  {
    intent: "data_quality",
    patterns: [
      /qualidade\s+dos\s+dados/i,
      /incompletos?/i,
      /inconsist[eê]nci/i,
      /dado\s+ru[ií]m/i,
      /lacuna/i,
      /sem\s+(fornecedor|respons[aá]vel|prazo|data)/i,
    ],
  },
  {
    intent: "aggregation",
    patterns: [
      /\btotal\b/i,
      /soma/i,
      /m[eé]dia/i,
      /quantos|quantas/i,
      /mediana/i,
      /m[ií]nim/i,
      /m[aá]xim/i,
      /participa[cç][aã]o/i,
      /\bpor\s+(obra|fornecedor|categoria|status|severidade|etap)/i,
    ],
  },
];

export function planAnalysis(question: string): AnalysisPlan {
  const trimmed = question.trim();
  const safetyNotes: string[] = [];
  const { domain, isExecutive } = classifyDomain(trimmed);
  const dateRange = parseDateRange(trimmed);

  let intent: AnalysisIntent = "lookup";
  for (const h of INTENT_HINTS) {
    if (h.patterns.some((re) => re.test(trimmed))) {
      intent = h.intent;
      break;
    }
  }
  if (isExecutive) intent = "executive";

  let complexity: AnalysisPlan["complexity"] = "simple";
  let strategy: AnalysisPlan["sqlStrategy"] = "single_query";
  let expectedInsightTypes: InsightType[] = ["descriptive"];

  switch (intent) {
    case "executive":
      complexity = "advanced";
      strategy = "multi_query";
      expectedInsightTypes = [
        "prioritization",
        "risk",
        "financial",
        "operational",
        "diagnostic",
      ];
      break;
    case "prioritization":
      complexity = "medium";
      strategy = "aggregate_then_explain";
      expectedInsightTypes = ["prioritization", "risk", "prescriptive"];
      break;
    case "comparison":
      complexity = "medium";
      strategy = "aggregate_then_explain";
      expectedInsightTypes = ["comparative", "trend", "diagnostic"];
      break;
    case "diagnostic":
      complexity = "advanced";
      strategy = "aggregate_then_explain";
      expectedInsightTypes = ["diagnostic", "anomaly", "risk"];
      break;
    case "forecast":
      complexity = "advanced";
      strategy = "aggregate_then_explain";
      expectedInsightTypes = ["forecast", "trend", "predictive"];
      break;
    case "data_quality":
      complexity = "medium";
      strategy = "aggregate_then_explain";
      expectedInsightTypes = ["quality"];
      break;
    case "aggregation":
      complexity = "medium";
      strategy = "aggregate_then_explain";
      expectedInsightTypes = ["descriptive", "comparative"];
      break;
    default:
      break;
  }

  const requiredMetrics = metricsForDomain(domain)
    .slice(0, 4)
    .map((m) => m.id);

  const ambiguous =
    trimmed.length < 12 ||
    /^(o que|qual)\s*\??$/i.test(trimmed) ||
    /(ajuda|help)\s*\??$/i.test(trimmed);

  if (intent === "executive")
    safetyNotes.push("Resposta executiva — não pedir esclarecimento.");
  if (dateRange.granularity === "none")
    safetyNotes.push("Sem janela temporal explícita.");

  return {
    intent,
    domain,
    complexity,
    requiredMetrics,
    requiredDimensions: [],
    requiredDateRange:
      dateRange.granularity === "none" ? undefined : dateRange.label,
    dateRangeSql: dateRange.sqlFragment,
    sqlStrategy: strategy,
    expectedInsightTypes,
    needsClarification: ambiguous && intent !== "executive",
    clarificationQuestion:
      ambiguous && intent !== "executive"
        ? "Pode me dizer o domínio (financeiro, compras, cronograma, NCs, pendências ou CS) e o período?"
        : undefined,
    safetyNotes,
  };
}
