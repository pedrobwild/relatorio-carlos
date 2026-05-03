// Deterministic analysis utilities for the assistant Edge Function.
// Mirrors the logic of src/lib/assistant/* in dependency-free form so it can
// run inside Deno.

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Insight {
  id: string;
  type: string;
  domain: string;
  title: string;
  summary: string;
  evidence: Array<{ label: string; value: string | number }>;
  severity: Severity;
  confidence: number;
  recommendedAction?: string;
  visualization?: { type: string; title?: string; x?: string; y?: string };
}

export interface DataQualityWarning {
  field: string;
  issue: string;
  count: number;
  severity: Severity;
  message: string;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtBRL = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? BRL.format(n) : "R$ 0,00";
};

const toNumber = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const NUMERIC_HINTS = ["amount", "valor", "total", "estimated_cost", "actual_cost", "value", "weight"];

function findFirstNumericKey(row: Record<string, unknown>): string | null {
  for (const k of Object.keys(row)) {
    if (NUMERIC_HINTS.includes(k.toLowerCase())) return k;
    if (typeof row[k] === "number") return k;
  }
  return null;
}

function severityForMonetary(amount: number, domain: string): Severity {
  if (domain !== "financeiro" && domain !== "compras") return "low";
  if (amount >= 50_000) return "critical";
  if (amount >= 10_000) return "high";
  if (amount >= 1_000) return "medium";
  if (amount > 0) return "low";
  return "info";
}

export function generateInsights(
  rows: Record<string, unknown>[],
  domain: string,
  _sql: string | null,
): Insight[] {
  if (!rows || rows.length === 0) {
    return [
      {
        id: "empty",
        type: "descriptive",
        domain,
        title: "Sem registros",
        summary: "A consulta foi executada mas não retornou linhas.",
        evidence: [{ label: "Linhas", value: 0 }],
        severity: "info",
        confidence: 0.7,
      },
    ];
  }

  const insights: Insight[] = [];
  const total = rows.length;

  insights.push({
    id: "count",
    type: "descriptive",
    domain,
    title: `${total} resultado(s)`,
    summary:
      total === 1
        ? "A consulta retornou um único registro."
        : `A consulta retornou ${total} registros.`,
    evidence: [{ label: "Linhas", value: total }],
    severity: total >= 50 ? "medium" : "info",
    confidence: 0.95,
    visualization: { type: "kpi", title: "Total" },
  });

  const numericKey = findFirstNumericKey(rows[0]);
  if (numericKey) {
    let sum = 0;
    let any = false;
    for (const r of rows) {
      const n = toNumber(r[numericKey]);
      if (n != null) {
        sum += n;
        any = true;
      }
    }
    if (any) {
      insights.push({
        id: "sum",
        type: "financial",
        domain,
        title: "Valor total",
        summary: `Soma de ${numericKey}: ${fmtBRL(sum)}.`,
        evidence: [
          { label: "Total", value: fmtBRL(sum) },
          { label: "Registros", value: total },
        ],
        severity: severityForMonetary(sum, domain),
        confidence: 0.9,
        visualization: { type: "kpi" },
      });
    }
  }

  const overdueKey = ["due_date", "deadline", "required_by_date", "planned_end"].find((k) =>
    Object.prototype.hasOwnProperty.call(rows[0], k),
  );
  if (overdueKey) {
    const todayMs = Date.now();
    const overdue = rows.filter((r) => {
      const v = r[overdueKey];
      if (!v) return false;
      const t = Date.parse(String(v));
      return Number.isFinite(t) && t < todayMs;
    });
    if (overdue.length > 0) {
      insights.push({
        id: "overdue",
        type: "risk",
        domain,
        title: `${overdue.length} item(ns) atrasado(s)`,
        summary: `Há ${overdue.length} registros com ${overdueKey} no passado.`,
        evidence: [
          { label: "Atrasados", value: overdue.length },
          { label: "Total", value: total },
        ],
        severity: overdue.length > total * 0.3 ? "high" : "medium",
        confidence: 0.85,
        recommendedAction: "Cobre/replaneje os itens com data passada.",
      });
    }
  }

  return insights.sort((a, b) => severityWeight(b.severity) * b.confidence - severityWeight(a.severity) * a.confidence);
}

function severityWeight(s: Severity): number {
  switch (s) {
    case "critical":
      return 1.8;
    case "high":
      return 1.4;
    case "medium":
      return 1;
    case "low":
      return 0.7;
    default:
      return 0.5;
  }
}

export function analyzeDataQuality(rows: Record<string, unknown>[]): DataQualityWarning[] {
  if (!rows || rows.length === 0) return [];
  const out: DataQualityWarning[] = [];
  let negativeAmount = 0;
  let missingSupplier = 0;
  let missingResponsible = 0;
  let missingPlanning = 0;
  for (const r of rows) {
    if (typeof r.amount === "number" && (r.amount as number) < 0) negativeAmount += 1;
    if (
      ("supplier_name" in r || "fornecedor_id" in r) &&
      (r.supplier_name == null || r.supplier_name === "") &&
      (r.fornecedor_id == null || r.fornecedor_id === "")
    ) missingSupplier += 1;
    if ("responsible_user_id" in r && (r.responsible_user_id == null || r.responsible_user_id === "")) missingResponsible += 1;
    if ("planned_end" in r && (r.planned_end == null || r.planned_end === "")) missingPlanning += 1;
  }
  if (negativeAmount > 0)
    out.push({ field: "amount", issue: "negative_value", count: negativeAmount, severity: "high", message: `${negativeAmount} valor(es) negativo(s) em amount.` });
  if (missingSupplier > 0)
    out.push({ field: "supplier_name", issue: "missing_supplier", count: missingSupplier, severity: "medium", message: `${missingSupplier} compra(s) sem fornecedor.` });
  if (missingResponsible > 0)
    out.push({ field: "responsible_user_id", issue: "missing_relation", count: missingResponsible, severity: "low", message: `${missingResponsible} item(ns) sem responsável.` });
  if (missingPlanning > 0)
    out.push({ field: "planned_end", issue: "missing_planning", count: missingPlanning, severity: "medium", message: `${missingPlanning} atividade(s) sem planned_end.` });
  return out;
}

export function recommendVisualizations(rows: Record<string, unknown>[]): Array<{
  type: string;
  title: string;
  x?: string;
  y?: string;
}> {
  if (!rows || rows.length === 0) return [];
  if (rows.length === 1) {
    const num = findFirstNumericKey(rows[0]);
    if (num) return [{ type: "kpi", title: num, y: num }];
    return [{ type: "table", title: "Resultado" }];
  }
  const numKey = findFirstNumericKey(rows[0]);
  const dateKey = Object.keys(rows[0]).find((k) => /(date|_at|deadline)$/i.test(k));
  const catKey = Object.keys(rows[0]).find((k) => !/(date|_at|deadline|id$)/i.test(k) && typeof rows[0][k] === "string");
  const out: Array<{ type: string; title: string; x?: string; y?: string }> = [];
  if (dateKey && numKey && rows.length >= 3) out.push({ type: "line", title: `${numKey} ao longo do tempo`, x: dateKey, y: numKey });
  if (catKey && numKey) out.push({ type: "bar", title: `${numKey} por ${catKey}`, x: catKey, y: numKey });
  if (out.length === 0) out.push({ type: "table", title: "Resultado" });
  return out;
}

export function scoreConfidence(input: {
  rowsReturned: number;
  hasSql: boolean;
  domainKnown?: boolean;
  dataQualityIssues?: number;
}): number {
  let score = 0.7;
  if (!input.hasSql) score -= 0.25;
  if (input.domainKnown === false) score -= 0.1;
  if (input.rowsReturned === 0) score -= 0.2;
  else if (input.rowsReturned >= 5 && input.rowsReturned <= 200) score += 0.1;
  else if (input.rowsReturned > 200) score -= 0.05;
  if (input.dataQualityIssues && input.dataQualityIssues > 0) score -= Math.min(0.25, 0.05 * input.dataQualityIssues);
  return Math.max(0.05, Math.min(0.99, score));
}

export function suggestFollowUps(domain: string): string[] {
  switch (domain) {
    case "financeiro":
      return [
        "Quais pagamentos vencem nos próximos 7 dias?",
        "Qual obra concentra mais valor em aberto?",
      ];
    case "compras":
      return [
        "Quais compras estão atrasadas e por quanto tempo?",
        "Onde o custo real ultrapassou o estimado?",
      ];
    case "cronograma":
      return [
        "Liste atividades atrasadas por etapa.",
        "Qual o progresso médio por obra?",
      ];
    case "ncs":
      return ["Quais NCs críticas estão abertas?", "Quais obras concentram mais NCs?"];
    case "pendencias":
      return ["Quais pendências bloqueiam obras?", "Quais vencem nos próximos 7 dias?"];
    case "cs":
      return ["Quais tickets críticos estão abertos?", "Tickets sem responsável."];
    default:
      return ["Compare com o mesmo período anterior.", "Mostre apenas os 5 mais críticos."];
  }
}
