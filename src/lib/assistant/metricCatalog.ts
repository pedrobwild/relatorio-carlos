import type { InsightDomain } from "./insightTypes";

export interface MetricDefinition {
  id: string;
  label: string;
  domain: InsightDomain;
  description: string;
  table: string;
  expression: string;
  unit: "currency" | "count" | "days" | "percent" | "ratio";
  goodWhen?: "high" | "low";
  exampleQuestion: string;
}

/**
 * Curated metric catalog used by the planner and the deterministic evaluator.
 * Expressions are SQL fragments referencing the canonical tables/columns.
 */
export const METRIC_CATALOG: MetricDefinition[] = [
  {
    id: "fin.total_received",
    label: "Total recebido",
    domain: "financeiro",
    description: "Soma do valor de parcelas com paid_at preenchido no período.",
    table: "project_payments",
    expression: "SUM(amount) FILTER (WHERE paid_at IS NOT NULL)",
    unit: "currency",
    goodWhen: "high",
    exampleQuestion: "Quanto recebemos no mês?",
  },
  {
    id: "fin.total_open",
    label: "Total a receber",
    domain: "financeiro",
    description: "Soma de parcelas em aberto (paid_at IS NULL).",
    table: "project_payments",
    expression: "SUM(amount) FILTER (WHERE paid_at IS NULL)",
    unit: "currency",
    goodWhen: "low",
    exampleQuestion: "Qual o total a receber?",
  },
  {
    id: "fin.total_overdue",
    label: "Total vencido",
    domain: "financeiro",
    description: "Parcelas em atraso, valor.",
    table: "project_payments",
    expression:
      "SUM(amount) FILTER (WHERE paid_at IS NULL AND due_date < CURRENT_DATE)",
    unit: "currency",
    goodWhen: "low",
    exampleQuestion: "Quanto está vencido?",
  },
  {
    id: "fin.due_next_7",
    label: "A vencer em 7 dias",
    domain: "financeiro",
    description: "Parcelas com due_date entre hoje e +7 dias.",
    table: "project_payments",
    expression:
      "SUM(amount) FILTER (WHERE paid_at IS NULL AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')",
    unit: "currency",
    exampleQuestion: "O que vence nos próximos 7 dias?",
  },
  {
    id: "compras.pending_count",
    label: "Compras pendentes",
    domain: "compras",
    description: "Compras com status 'pending' ou 'ordered'.",
    table: "project_purchases",
    expression: "COUNT(*) FILTER (WHERE status IN ('pending','ordered'))",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Quantas compras estão pendentes?",
  },
  {
    id: "compras.atrasadas",
    label: "Compras atrasadas",
    domain: "compras",
    description: "Compras com required_by_date < hoje e status não-finalizado.",
    table: "project_purchases",
    expression:
      "COUNT(*) FILTER (WHERE required_by_date < CURRENT_DATE AND status NOT IN ('delivered','cancelled'))",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Quais compras estão atrasadas?",
  },
  {
    id: "compras.overrun_total",
    label: "Excesso de custo",
    domain: "compras",
    description:
      "Diferença total entre custo real e estimado quando real > estimado.",
    table: "project_purchases",
    expression:
      "SUM(GREATEST(actual_cost - estimated_cost, 0)) FILTER (WHERE actual_cost IS NOT NULL AND estimated_cost IS NOT NULL)",
    unit: "currency",
    goodWhen: "low",
    exampleQuestion: "Onde estamos estourando o orçamento de compras?",
  },
  {
    id: "cron.atividades_atrasadas",
    label: "Atividades atrasadas",
    domain: "cronograma",
    description: "Atividades com planned_end < hoje e actual_end NULL.",
    table: "project_activities",
    expression:
      "COUNT(*) FILTER (WHERE planned_end < CURRENT_DATE AND actual_end IS NULL)",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Quantas atividades estão atrasadas?",
  },
  {
    id: "cron.completion_rate",
    label: "Taxa de conclusão",
    domain: "cronograma",
    description:
      "Atividades concluídas (actual_end IS NOT NULL) dividido pelo total — proxy de progresso.",
    table: "project_activities",
    expression: "AVG(CASE WHEN actual_end IS NOT NULL THEN 1 ELSE 0 END)",
    unit: "ratio",
    goodWhen: "high",
    exampleQuestion: "Qual a taxa de conclusão das atividades?",
  },
  {
    id: "ncs.abertas",
    label: "NCs abertas",
    domain: "ncs",
    description: "Não-conformidades com status diferente de 'closed'.",
    table: "non_conformities",
    expression: "COUNT(*) FILTER (WHERE status <> 'closed')",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Quantas NCs estão abertas?",
  },
  {
    id: "ncs.criticas",
    label: "NCs críticas",
    domain: "ncs",
    description: "Severidade crítica e ainda não fechadas.",
    table: "non_conformities",
    expression:
      "COUNT(*) FILTER (WHERE severity = 'critical' AND status <> 'closed')",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Há NCs críticas em aberto?",
  },
  {
    id: "pend.atrasadas",
    label: "Pendências atrasadas",
    domain: "pendencias",
    description: "Pendências com due_date < hoje e status pending.",
    table: "pending_items",
    expression:
      "COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE)",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Quais pendências estão vencidas?",
  },
  {
    id: "cs.tickets_abertos",
    label: "Tickets abertos",
    domain: "cs",
    description: "cs_tickets sem resolved_at.",
    table: "cs_tickets",
    expression: "COUNT(*) FILTER (WHERE resolved_at IS NULL)",
    unit: "count",
    goodWhen: "low",
    exampleQuestion: "Quantos tickets estão abertos?",
  },
  {
    id: "cs.tempo_medio_resolucao",
    label: "Tempo médio de resolução",
    domain: "cs",
    description: "Média em dias entre created_at e resolved_at.",
    table: "cs_tickets",
    expression:
      "AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/86400) FILTER (WHERE resolved_at IS NOT NULL)",
    unit: "days",
    goodWhen: "low",
    exampleQuestion: "Em média, quantos dias levamos para fechar um ticket?",
  },
];

export const METRIC_BY_ID: Record<string, MetricDefinition> =
  Object.fromEntries(METRIC_CATALOG.map((m) => [m.id, m]));

export function metricsForDomain(domain: InsightDomain): MetricDefinition[] {
  return METRIC_CATALOG.filter((m) => m.domain === domain);
}
