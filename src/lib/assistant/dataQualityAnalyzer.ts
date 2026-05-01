import type { DataQualityWarning } from "./insightTypes";

interface RuleSpec {
  field: string;
  table?: string;
  issue: DataQualityWarning["issue"];
  severity: DataQualityWarning["severity"];
  message: string;
  detect: (row: Record<string, unknown>) => boolean;
}

const RULES: RuleSpec[] = [
  {
    field: "amount",
    issue: "negative_value",
    severity: "high",
    message: "Valor monetário negativo detectado em parcela.",
    detect: (r) => typeof r.amount === "number" && (r.amount as number) < 0,
  },
  {
    field: "estimated_cost",
    issue: "negative_value",
    severity: "medium",
    message: "Custo estimado negativo em compras.",
    detect: (r) => typeof r.estimated_cost === "number" && (r.estimated_cost as number) < 0,
  },
  {
    field: "supplier_name",
    issue: "missing_supplier",
    severity: "medium",
    message: "Compra sem fornecedor associado.",
    detect: (r) =>
      ("supplier_name" in r || "fornecedor_id" in r) &&
      (r.supplier_name == null || r.supplier_name === "") &&
      (r.fornecedor_id == null || r.fornecedor_id === ""),
  },
  {
    field: "due_date",
    issue: "null_values",
    severity: "low",
    message: "Item sem data de vencimento.",
    detect: (r) => "due_date" in r && (r.due_date == null || r.due_date === ""),
  },
  {
    field: "deadline",
    issue: "null_values",
    severity: "low",
    message: "NC sem deadline.",
    detect: (r) => "deadline" in r && (r.deadline == null || r.deadline === ""),
  },
  {
    field: "responsible_user_id",
    issue: "missing_relation",
    severity: "low",
    message: "Registro sem responsável.",
    detect: (r) =>
      "responsible_user_id" in r &&
      (r.responsible_user_id == null || r.responsible_user_id === ""),
  },
  {
    field: "actual_end",
    issue: "inconsistent_status_date",
    severity: "medium",
    message: "Atividade marcada como atrasada porém com actual_end preenchida.",
    detect: (r) => {
      if (!("actual_end" in r) || !("planned_end" in r)) return false;
      if (!r.actual_end || !r.planned_end) return false;
      try {
        const ae = new Date(r.actual_end as string).getTime();
        const pe = new Date(r.planned_end as string).getTime();
        return Number.isFinite(ae) && Number.isFinite(pe) && ae < pe && r.status === "atrasada";
      } catch {
        return false;
      }
    },
  },
  {
    field: "planned_end",
    issue: "missing_planning",
    severity: "medium",
    message: "Atividade sem planned_end.",
    detect: (r) => "planned_end" in r && (r.planned_end == null || r.planned_end === ""),
  },
];

/**
 * Run deterministic checks against the rows returned by the SQL.
 * Returns aggregated warnings (one per rule that hit ≥1 row).
 */
export function analyzeDataQuality(
  rows: Record<string, unknown>[],
): DataQualityWarning[] {
  if (!rows || rows.length === 0) return [];

  const counts = new Map<string, { rule: RuleSpec; count: number }>();

  for (const row of rows) {
    for (const rule of RULES) {
      try {
        if (rule.detect(row)) {
          const key = `${rule.field}:${rule.issue}`;
          const cur = counts.get(key);
          if (cur) cur.count += 1;
          else counts.set(key, { rule, count: 1 });
        }
      } catch {
        // ignore detector failures
      }
    }
  }

  return [...counts.values()].map(({ rule, count }) => ({
    field: rule.field,
    table: rule.table,
    issue: rule.issue,
    count,
    severity: rule.severity,
    message: `${rule.message} (${count} registro(s))`,
  }));
}
