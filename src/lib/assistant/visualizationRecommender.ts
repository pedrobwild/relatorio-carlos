import type {
  InsightVisualizationHint,
  VisualizationType,
} from "./insightTypes";

export interface ColumnProfile {
  name: string;
  type: "number" | "text" | "date" | "boolean" | "unknown";
  uniqueValues: number;
  totalNonNull: number;
}

const NUMERIC_HINTS =
  /^(amount|valor|total|cost|estimated|actual|count|qtd|quantity|tempo|days|tokens|score|nota|progresso|peso|weight|price)/i;
const DATE_HINTS = /(date|_at|deadline|paid|start|end)$/i;

/**
 * Profile each column in a result set so we can pick the right chart.
 */
export function profileColumns(
  rows: Record<string, unknown>[],
): ColumnProfile[] {
  if (!rows.length) return [];
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);

  return [...keys].map((name) => {
    const values: unknown[] = rows.map((r) => r[name]);
    const nonNull = values.filter((v) => v != null && v !== "");
    let type: ColumnProfile["type"] = "unknown";
    if (nonNull.length === 0) type = "unknown";
    else if (
      nonNull.every(
        (v) =>
          typeof v === "number" ||
          (!Number.isNaN(Number(v)) && typeof v === "string" && v !== ""),
      )
    ) {
      type = "number";
    } else if (
      DATE_HINTS.test(name) &&
      nonNull.every((v) => !Number.isNaN(Date.parse(String(v))))
    ) {
      type = "date";
    } else if (nonNull.every((v) => typeof v === "boolean")) {
      type = "boolean";
    } else {
      type = "text";
    }

    if (
      NUMERIC_HINTS.test(name) &&
      nonNull.every((v) => v == null || !Number.isNaN(Number(v)))
    ) {
      type = "number";
    }

    const uniques = new Set<string>();
    for (const v of nonNull) uniques.add(String(v));

    return {
      name,
      type,
      uniqueValues: uniques.size,
      totalNonNull: nonNull.length,
    };
  });
}

export interface RecommendationContext {
  rows: Record<string, unknown>[];
  /** Suggested chart kind based on the question intent. */
  intent?: "trend" | "distribution" | "ranking" | "share" | "kpi" | "compare";
}

export function recommendVisualizations(
  ctx: RecommendationContext,
): InsightVisualizationHint[] {
  const { rows, intent } = ctx;
  if (!rows || rows.length === 0) return [];

  // KPI: a single numeric scalar.
  if (rows.length === 1) {
    const cols = profileColumns(rows);
    const numeric = cols.find((c) => c.type === "number");
    if (numeric) {
      return [{ type: "kpi", title: numeric.name, y: numeric.name }];
    }
    return [{ type: "table", title: "Resultado" }];
  }

  const cols = profileColumns(rows);
  const numeric = cols.filter((c) => c.type === "number");
  const dates = cols.filter((c) => c.type === "date");
  const cats = cols.filter((c) => c.type === "text");

  const out: InsightVisualizationHint[] = [];

  // Trend over time: use line chart.
  if (dates.length > 0 && numeric.length > 0 && rows.length >= 3) {
    const chart: VisualizationType = intent === "share" ? "area" : "line";
    out.push({
      type: chart,
      title: `${numeric[0].name} ao longo do tempo`,
      x: dates[0].name,
      y: numeric[0].name,
    });
  }

  // Ranking / share: bar or pie.
  if (cats.length > 0 && numeric.length > 0) {
    const cat = cats[0];
    const num = numeric[0];
    if (cat.uniqueValues <= 8 && intent === "share") {
      out.push({
        type: "pie",
        title: `${num.name} por ${cat.name}`,
        x: cat.name,
        y: num.name,
      });
    } else if (cat.uniqueValues <= 30) {
      out.push({
        type: "bar",
        title: `${num.name} por ${cat.name}`,
        x: cat.name,
        y: num.name,
      });
    }
  }

  // Default fallback.
  if (out.length === 0) out.push({ type: "table", title: "Resultado" });

  return out;
}
