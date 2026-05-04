import type {
  Insight,
  InsightDomain,
  InsightSeverity,
  MetricSnapshot,
} from "./insightTypes";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_BR = (s: string): string => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

export const fmtBRL = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? BRL.format(n) : "R$ 0,00";
};

export const fmtNumber = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR");
};

export const fmtDateBR = (v: unknown): string => {
  if (v == null || v === "") return "—";
  return DATE_BR(String(v));
};

export const fmtPct = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return "0%";
  return `${(n * 100).toFixed(1)}%`;
};

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const toNumber = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

interface BuildInsightArgs {
  rows: Record<string, unknown>[];
  /** Reserved for future use (LLM-aware ranking). Currently informative only. */
  question: string;
  domain: InsightDomain;
  sql?: string;
}

const NUMERIC_KEYS = [
  "amount",
  "valor",
  "total",
  "estimated_cost",
  "actual_cost",
  "value",
];

function findFirstNumericKey(row: Record<string, unknown>): string | null {
  for (const k of Object.keys(row)) {
    if (NUMERIC_KEYS.includes(k.toLowerCase())) return k;
    if (typeof row[k] === "number") return k;
  }
  return null;
}

function extractTotalAmount(rows: Record<string, unknown>[]): number | null {
  if (!rows.length) return null;
  const key = findFirstNumericKey(rows[0]);
  if (!key) return null;
  let sum = 0;
  let any = false;
  for (const r of rows) {
    const n = toNumber(r[key]);
    if (n != null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

function severityForMonetary(
  amount: number,
  domain: InsightDomain,
): InsightSeverity {
  if (domain !== "financeiro" && domain !== "compras") return "low";
  if (amount >= 50_000) return "critical";
  if (amount >= 10_000) return "high";
  if (amount >= 1_000) return "medium";
  if (amount > 0) return "low";
  return "info";
}

/**
 * Generate a deterministic set of insights from raw SQL rows.
 * The LLM is still in charge of the natural-language explanation,
 * but evidences and severity are computed in TypeScript.
 */
export function generateInsights({
  rows,
  question: _question,
  domain,
  sql,
}: BuildInsightArgs): Insight[] {
  if (!rows || rows.length === 0) {
    return [
      {
        id: "empty",
        type: "descriptive",
        domain,
        title: "Sem registros para os filtros aplicados",
        summary:
          "A consulta foi executada com sucesso mas não retornou nenhuma linha. Considere ampliar o período ou rever os filtros.",
        evidence: [{ label: "Linhas", value: 0 }],
        severity: "info",
        confidence: 0.7,
        suggestedQuestions: [
          "Tente ampliar o período para os últimos 30 dias.",
        ],
        sqlUsed: sql,
      },
    ];
  }

  const insights: Insight[] = [];
  const total = rows.length;

  insights.push({
    id: "count",
    type: "descriptive",
    domain,
    title: `${total} resultado(s) retornado(s)`,
    summary:
      total === 1
        ? "A consulta retornou exatamente um registro relevante."
        : `A consulta retornou ${total} registros relevantes para a pergunta.`,
    evidence: [{ label: "Linhas", value: total }],
    severity: total >= 50 ? "medium" : "info",
    confidence: 0.95,
    visualization: { type: "kpi", title: "Total de resultados" },
    sqlUsed: sql,
  });

  const totalAmount = extractTotalAmount(rows);
  if (totalAmount != null) {
    insights.push({
      id: "sum",
      type: "financial",
      domain,
      title: "Valor total",
      summary: `Soma do principal valor numérico nas linhas retornadas: ${fmtBRL(totalAmount)}.`,
      evidence: [
        { label: "Total", value: fmtBRL(totalAmount) },
        { label: "Registros", value: total },
        ...(total > 0
          ? [{ label: "Ticket médio", value: fmtBRL(totalAmount / total) }]
          : []),
      ],
      severity: severityForMonetary(totalAmount, domain),
      confidence: 0.9,
      visualization: { type: "kpi", title: "Total" },
      sqlUsed: sql,
    });
  }

  // Top-N rank by numeric column, if cardinality allows.
  if (total >= 3) {
    const numericKey = findFirstNumericKey(rows[0]);
    if (numericKey) {
      const sorted = [...rows]
        .filter((r) => isFiniteNumber(toNumber(r[numericKey])))
        .sort(
          (a, b) =>
            (toNumber(b[numericKey]) ?? 0) - (toNumber(a[numericKey]) ?? 0),
        )
        .slice(0, 5);
      if (sorted.length > 0) {
        const labelKey =
          Object.keys(rows[0]).find((k) =>
            [
              "name",
              "obra",
              "project_name",
              "title",
              "description",
              "item_name",
              "supplier_name",
            ].includes(k.toLowerCase()),
          ) ?? Object.keys(rows[0])[0];
        insights.push({
          id: "topn",
          type: "comparative",
          domain,
          title: "Top 5 maiores",
          summary: `Maiores valores em "${numericKey}" entre os resultados retornados.`,
          evidence: sorted.map((r) => ({
            label: String(r[labelKey] ?? "—"),
            value: fmtBRL(toNumber(r[numericKey]) ?? 0),
          })),
          severity: "low",
          confidence: 0.8,
          visualization: {
            type: "bar",
            title: "Top 5",
            x: labelKey,
            y: numericKey,
          },
          sqlUsed: sql,
        });
      }
    }
  }

  // Detect overdue rows when due_date / deadline exists.
  const overdueKey = [
    "due_date",
    "deadline",
    "required_by_date",
    "planned_end",
  ].find((k) => Object.prototype.hasOwnProperty.call(rows[0], k));
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
        summary: `Foram identificados ${overdue.length} registros com ${overdueKey} no passado.`,
        evidence: [
          { label: "Atrasados", value: overdue.length },
          { label: "Total", value: total },
          { label: "Proporção", value: fmtPct(overdue.length / total) },
        ],
        severity: overdue.length > total * 0.3 ? "high" : "medium",
        confidence: 0.85,
        recommendedAction:
          "Revise prioridades e cobre/replaneje os itens com data passada.",
        suggestedQuestions: [
          "Liste os atrasados ordenados pelo maior tempo de atraso.",
          "Quais responsáveis concentram esses atrasos?",
        ],
        sqlUsed: sql,
      });
    }
  }

  // Concentration insight (Pareto-like) when categorical columns exist.
  const groupCandidates = [
    "project_name",
    "name",
    "obra",
    "supplier_name",
    "category",
    "etapa",
    "responsible",
  ]
    .map((c) => Object.keys(rows[0]).find((k) => k.toLowerCase() === c))
    .filter(Boolean) as string[];
  const groupKey = groupCandidates[0];
  const numericForGroup = findFirstNumericKey(rows[0]);
  if (groupKey && numericForGroup && total >= 5) {
    const grouped = new Map<string, number>();
    for (const r of rows) {
      const k = String(r[groupKey] ?? "—");
      grouped.set(
        k,
        (grouped.get(k) ?? 0) + (toNumber(r[numericForGroup]) ?? 0),
      );
    }
    const items = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
    const grandTotal = items.reduce((s, [, v]) => s + v, 0);
    if (grandTotal > 0 && items.length >= 3) {
      let acc = 0;
      let n = 0;
      for (const [, v] of items) {
        acc += v;
        n += 1;
        if (acc / grandTotal >= 0.8) break;
      }
      const topShare = n / items.length;
      if (topShare <= 0.4) {
        insights.push({
          id: "pareto",
          type: "diagnostic",
          domain,
          title: `Concentração em ${n} de ${items.length} ${groupKey}`,
          summary: `${n} grupos respondem por 80% do total — padrão típico de Pareto. Foque nesses para ganho rápido.`,
          evidence: items.slice(0, n).map(([label, value]) => ({
            label: label || "—",
            value: fmtBRL(value),
            changePct: value / grandTotal,
          })),
          severity: "medium",
          confidence: 0.78,
          recommendedAction: `Priorize ações nos ${n} maiores grupos para impacto máximo.`,
          visualization: {
            type: "bar",
            title: "Concentração 80/20",
            x: groupKey,
            y: numericForGroup,
          },
          sqlUsed: sql,
        });
      }
    }
  }

  return insights;
}

/**
 * Build a flat list of metric snapshots from a row when the result represents
 * a single aggregated row (e.g. SUM/COUNT/AVG). Returns [] for list-style results.
 */
export function metricsFromRow(
  rows: Record<string, unknown>[],
): MetricSnapshot[] {
  if (rows.length !== 1) return [];
  const row = rows[0];
  const out: MetricSnapshot[] = [];
  for (const [key, value] of Object.entries(row)) {
    const n = toNumber(value);
    if (n == null) continue;
    const lower = key.toLowerCase();
    const isCurrency =
      lower.includes("amount") ||
      lower.includes("valor") ||
      lower.includes("cost") ||
      lower.includes("total") ||
      lower.includes("budget");
    out.push({
      label: key,
      value: isCurrency ? fmtBRL(n) : fmtNumber(n),
      unit: isCurrency ? "BRL" : undefined,
    });
  }
  return out;
}

export interface ExecutiveSummaryArgs {
  question: string;
  rows: Record<string, unknown>[];
  insights: Insight[];
  domain: InsightDomain;
}

/**
 * Produce a deterministic executive summary that the UI can show even before
 * the LLM streams its prose. The LLM-generated `answer` may override it.
 */
export function buildExecutiveSummary(args: ExecutiveSummaryArgs): string {
  const { rows, insights, domain } = args;
  if (rows.length === 0) {
    return `Nenhum registro encontrado no domínio **${domain}** para a pergunta. Considere ampliar o período ou revisar filtros.`;
  }
  const top = insights.slice(0, 3);
  const bullets = top.map((i) => `- **${i.title}** — ${i.summary}`).join("\n");
  return [
    `Analisando ${rows.length} registro(s) no domínio **${domain}**:`,
    bullets,
  ].join("\n");
}

export function suggestFollowUps(domain: InsightDomain): string[] {
  const generic = [
    "Compare com o mesmo período anterior.",
    "Mostre apenas os 5 mais críticos.",
  ];
  switch (domain) {
    case "financeiro":
      return [
        "Quais pagamentos vencem nos próximos 7 dias?",
        "Qual obra concentra mais valor em aberto?",
        ...generic,
      ];
    case "compras":
      return [
        "Quais compras estão atrasadas e por quanto tempo?",
        "Onde o custo real ultrapassou o estimado?",
        ...generic,
      ];
    case "cronograma":
      return [
        "Liste atividades atrasadas por etapa.",
        "Qual o progresso médio por obra?",
        ...generic,
      ];
    case "ncs":
      return [
        "Quais NCs críticas estão abertas?",
        "Quais obras concentram mais NCs?",
        ...generic,
      ];
    case "pendencias":
      return [
        "Quais pendências bloqueiam obras?",
        "Quais vencem nos próximos 7 dias?",
        ...generic,
      ];
    case "cs":
      return [
        "Quais tickets críticos estão abertos?",
        "Tickets sem responsável.",
        ...generic,
      ];
    default:
      return generic;
  }
}
