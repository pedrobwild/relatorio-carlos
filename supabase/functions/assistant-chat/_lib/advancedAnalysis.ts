// Análise determinística AVANÇADA — substitui a versão genérica de
// generateInsights com detectores reais de padrão: concentração (Pareto),
// outliers (z-score / IQR), tendência temporal, planejado×realizado,
// top-ofensores, agrupamento por dimensão.
//
// Roda no servidor antes do Formatter, gerando "insights estruturados" que
// o LLM apenas verbaliza — reduz alucinação e garante que números calculados
// estejam corretos.

import type { Severity, Insight } from "./analysis.ts";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const fmt = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? BRL.format(n) : "R$ 0,00";
};

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const NUMERIC_KEYS = [
  "amount",
  "valor",
  "valor_total",
  "total",
  "estimated_cost",
  "actual_cost",
  "saldo",
  "estouro_total",
  "gasto",
  "valor_em_jogo",
];
const CATEGORY_KEYS = [
  "obra",
  "fornecedor",
  "category",
  "categoria",
  "etapa",
  "tipo",
  "supplier_name",
  "client_name",
  "city",
];
const DATE_KEYS = [
  "due_date",
  "deadline",
  "required_by_date",
  "planned_end",
  "actual_end",
  "paid_at",
  "created_at",
];

function findKey(row: Record<string, unknown>, candidates: string[]): string | null {
  for (const k of candidates) if (k in row) return k;
  return null;
}

function findFirstNumericKey(row: Record<string, unknown>): string | null {
  const explicit = findKey(row, NUMERIC_KEYS);
  if (explicit) return explicit;
  for (const k of Object.keys(row)) if (typeof row[k] === "number") return k;
  return null;
}

/**
 * Detecta concentração tipo Pareto: o quanto do total vem dos top N itens.
 * Se top 20% concentra >= 50% do valor → insight de concentração relevante.
 */
function detectConcentration(
  rows: Record<string, unknown>[],
  numKey: string,
  catKey: string,
  domain: string,
): Insight | null {
  const byCat = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const v = toNum(r[numKey]);
    if (v == null) continue;
    const c = String(r[catKey] ?? "(sem)") || "(sem)";
    byCat.set(c, (byCat.get(c) ?? 0) + v);
    total += v;
  }
  if (total <= 0 || byCat.size < 4) return null;

  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const topN = Math.max(1, Math.ceil(sorted.length * 0.2));
  const topShare = sorted.slice(0, topN).reduce((s, [, v]) => s + v, 0) / total;

  if (topShare < 0.5) return null;

  const topItems = sorted
    .slice(0, Math.min(3, topN))
    .map(([k, v]) => `${k} (${fmt(v)} · ${((v / total) * 100).toFixed(0)}%)`);

  return {
    id: "concentration",
    type: "pattern",
    domain,
    title: `Concentração: top ${topN} = ${(topShare * 100).toFixed(0)}% do total`,
    summary: `${topN} de ${sorted.length} ${catKey}(s) respondem por ${(topShare * 100).toFixed(
      0,
    )}% de ${numKey}. Principais: ${topItems.join(", ")}.`,
    evidence: [
      { label: "Top concentrado", value: `${(topShare * 100).toFixed(0)}%` },
      { label: "Total", value: fmt(total) },
    ],
    severity: topShare >= 0.7 ? "high" : "medium",
    confidence: 0.9,
    recommendedAction: `Foque em ${sorted[0][0]} primeiro — é o maior driver.`,
    visualization: { type: "bar", title: `${numKey} por ${catKey}`, x: catKey, y: numKey },
  };
}

/**
 * Outliers via z-score robusto (mediana + MAD). Retorna até 3 valores
 * fora de ±2.5 sigma — sinal de "vale conferir".
 */
function detectOutliers(
  rows: Record<string, unknown>[],
  numKey: string,
  catKey: string | null,
  domain: string,
): Insight | null {
  const values = rows.map((r) => toNum(r[numKey])).filter((v): v is number => v != null);
  if (values.length < 6) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)] || 1;
  const threshold = 2.5;

  const outliers = rows
    .map((r, i) => ({
      row: r,
      v: values[i],
      z: Math.abs((values[i] - median) / (1.4826 * mad)),
    }))
    .filter((x) => x.z >= threshold)
    .sort((a, b) => b.z - a.z)
    .slice(0, 3);

  if (outliers.length === 0) return null;

  const items = outliers.map((o) => {
    const label = catKey ? String(o.row[catKey] ?? "?") : `linha ${o.v}`;
    return `${label}: ${fmt(o.v)} (mediana ${fmt(median)})`;
  });

  return {
    id: "outliers",
    type: "anomaly",
    domain,
    title: `${outliers.length} outlier(s) detectado(s)`,
    summary: `Valor(es) muito acima/abaixo do típico em ${numKey}: ${items.join(" · ")}.`,
    evidence: [
      { label: "Mediana", value: fmt(median) },
      { label: "Outliers", value: outliers.length },
    ],
    severity: outliers[0].v > median * 5 ? "high" : "medium",
    confidence: 0.8,
    recommendedAction: "Confira se o valor anômalo é real ou erro de digitação.",
  };
}

/**
 * Plano×Realizado: quando linhas têm estimated_cost + actual_cost,
 * calcula estouro agregado e %.
 */
function detectBudgetBreach(
  rows: Record<string, unknown>[],
  domain: string,
): Insight | null {
  if (!rows.length) return null;
  if (!("estimated_cost" in rows[0]) || !("actual_cost" in rows[0])) return null;

  let estimated = 0;
  let actual = 0;
  let breaches = 0;
  for (const r of rows) {
    const e = toNum(r.estimated_cost);
    const a = toNum(r.actual_cost);
    if (e == null || a == null) continue;
    estimated += e;
    actual += a;
    if (a > e) breaches += 1;
  }
  if (estimated <= 0) return null;
  const delta = actual - estimated;
  const pct = (delta / estimated) * 100;

  if (Math.abs(pct) < 5) return null;

  const sev: Severity = pct >= 30 ? "critical" : pct >= 15 ? "high" : pct >= 5 ? "medium" : "low";
  return {
    id: "budget_breach",
    type: "financial",
    domain,
    title: pct > 0 ? `Estouro de ${pct.toFixed(1)}% sobre o estimado` : `Economia de ${Math.abs(pct).toFixed(1)}% sobre o estimado`,
    summary:
      pct > 0
        ? `${breaches} item(ns) acima do estimado. Estouro agregado: ${fmt(delta)} (estimado ${fmt(
            estimated,
          )} → realizado ${fmt(actual)}).`
        : `Realizado abaixo do estimado por ${fmt(Math.abs(delta))}.`,
    evidence: [
      { label: "Estimado", value: fmt(estimated) },
      { label: "Realizado", value: fmt(actual) },
      { label: "Δ", value: fmt(delta) },
    ],
    severity: sev,
    confidence: 0.95,
    recommendedAction:
      pct > 15 ? "Revisar cotações e renegociar com fornecedor antes do próximo pedido." : undefined,
  };
}

/**
 * Tendência temporal: agrupa por mês/semana e detecta crescimento/queda
 * consistente.
 */
function detectTrend(
  rows: Record<string, unknown>[],
  numKey: string,
  domain: string,
): Insight | null {
  const dateKey = findKey(rows[0] ?? {}, DATE_KEYS);
  if (!dateKey) return null;
  if (rows.length < 4) return null;

  const buckets = new Map<string, number>();
  for (const r of rows) {
    const v = toNum(r[numKey]);
    const d = r[dateKey];
    if (v == null || !d) continue;
    const t = Date.parse(String(d));
    if (!Number.isFinite(t)) continue;
    const key = new Date(t).toISOString().slice(0, 7); // YYYY-MM
    buckets.set(key, (buckets.get(key) ?? 0) + v);
  }
  if (buckets.size < 3) return null;
  const series = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const first = series[0][1];
  const last = series[series.length - 1][1];
  if (first <= 0) return null;
  const growth = ((last - first) / first) * 100;
  if (Math.abs(growth) < 20) return null;

  return {
    id: "trend",
    type: "trend",
    domain,
    title: growth > 0 ? `Crescimento de ${growth.toFixed(0)}% no período` : `Queda de ${Math.abs(growth).toFixed(0)}% no período`,
    summary: `${numKey} variou de ${fmt(first)} (${series[0][0]}) para ${fmt(last)} (${
      series[series.length - 1][0]
    }) em ${series.length} meses.`,
    evidence: [
      { label: "Início", value: fmt(first) },
      { label: "Fim", value: fmt(last) },
      { label: "Variação", value: `${growth > 0 ? "+" : ""}${growth.toFixed(0)}%` },
    ],
    severity: Math.abs(growth) >= 50 ? "high" : "medium",
    confidence: 0.75,
    visualization: { type: "line", title: `${numKey} ao longo do tempo`, x: dateKey, y: numKey },
  };
}

/**
 * Top-ofensores genérico: quando o resultado tem dias_em_atraso ou similar,
 * destaca os 3 piores.
 */
function detectTopOffenders(
  rows: Record<string, unknown>[],
  domain: string,
): Insight | null {
  const offenderKey = ["dias_em_atraso", "dias_aberta", "estouro_pct", "estouro_total"].find(
    (k) => rows[0] && k in rows[0],
  );
  if (!offenderKey) return null;
  const labelKey = findKey(rows[0], CATEGORY_KEYS) ?? "obra";
  const sorted = [...rows].sort((a, b) => (toNum(b[offenderKey]) ?? 0) - (toNum(a[offenderKey]) ?? 0));
  const top = sorted.slice(0, 3);
  if (!top.length || (toNum(top[0][offenderKey]) ?? 0) <= 0) return null;

  const items = top
    .map((r) => `${r[labelKey] ?? "?"} (${offenderKey}=${r[offenderKey]})`)
    .join(" · ");
  return {
    id: "top_offenders",
    type: "ranking",
    domain,
    title: `Top 3 piores em ${offenderKey}`,
    summary: items,
    evidence: top.map((r, i) => ({
      label: `#${i + 1}`,
      value: `${r[labelKey] ?? "?"}: ${r[offenderKey]}`,
    })),
    severity: "high",
    confidence: 0.9,
    recommendedAction: `Comece pelo ${top[0][labelKey] ?? "primeiro"}.`,
  };
}

export function generateAdvancedInsights(
  rows: Record<string, unknown>[],
  domain: string,
): Insight[] {
  if (!rows || rows.length === 0) return [];
  const out: Insight[] = [];
  const sample = rows[0];
  const numKey = findFirstNumericKey(sample);
  const catKey = findKey(sample, CATEGORY_KEYS);

  if (numKey && catKey) {
    const c = detectConcentration(rows, numKey, catKey, domain);
    if (c) out.push(c);
  }
  if (numKey) {
    const o = detectOutliers(rows, numKey, catKey, domain);
    if (o) out.push(o);
    const t = detectTrend(rows, numKey, domain);
    if (t) out.push(t);
  }
  const b = detectBudgetBreach(rows, domain);
  if (b) out.push(b);
  const off = detectTopOffenders(rows, domain);
  if (off) out.push(off);

  return out;
}

/**
 * Sugestões DINÂMICAS baseadas no resultado real, não em domínio fixo.
 * Se a resposta tem 1 obra dominante → sugere drill-down dela. Se tem
 * coluna de data → sugere recorte temporal. Etc.
 */
export function generateDynamicFollowUps(
  rows: Record<string, unknown>[],
  domain: string,
  question: string,
): string[] {
  if (!rows || rows.length === 0) {
    return [
      "Quer ver o mês passado?",
      "Quer incluir registros já fechados?",
      "Quer ampliar o período para últimos 90 dias?",
    ];
  }

  const out: string[] = [];
  const sample = rows[0];
  const catKey = findKey(sample, CATEGORY_KEYS);
  const numKey = findFirstNumericKey(sample);

  if (catKey && rows.length >= 2) {
    const top = String(rows[0][catKey] ?? "");
    if (top) out.push(`Drill-down em "${top}" — mostrar tudo dessa ${catKey}`);
  }
  if (numKey && rows.length >= 3) {
    out.push(`Comparar com o mesmo período anterior`);
  }
  if (rows.length >= 10) {
    out.push(`Mostrar só os 5 mais críticos`);
  }
  if (
    domain === "financeiro" &&
    !/m[êe]s|semana|hoje|ano|trimestre/i.test(question)
  ) {
    out.push("Recortar por mês corrente vs mês anterior");
  }
  if (domain === "compras" && !/fornecedor/i.test(question)) {
    out.push("Quebrar por fornecedor");
  }
  if (domain === "ncs" || domain === "pendencias") {
    out.push("Mostrar quem é o responsável de cada item");
  }

  // sempre uma sugestão "ampliar"
  out.push("Cruzar com mercado (CUB, INCC, dólar)");

  return out.slice(0, 4);
}
