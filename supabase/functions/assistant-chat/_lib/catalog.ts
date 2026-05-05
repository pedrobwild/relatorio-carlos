// Schema catalog used by the LLM prompt. Mirrors src/lib/assistant/dataCatalog.ts
// but is kept dependency-free so it can run inside Deno (Edge Functions).

export interface CatalogColumn {
  name: string;
  type: string;
  description?: string;
}

export interface CatalogTable {
  table: string;
  businessName: string;
  domain: string;
  description: string;
  columns: CatalogColumn[];
  joinHints?: string[];
  derivedRules?: string[];
  forbidden?: string[];
}

export const CATALOG: CatalogTable[] = [
  {
    table: "projects",
    businessName: "Obras / Projetos",
    domain: "obras",
    description: "Cadastro principal de obras.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "status", type: "text" },
      { name: "org_id", type: "uuid" },
      { name: "created_by", type: "uuid" },
      { name: "planned_start_date", type: "date" },
      { name: "planned_end_date", type: "date" },
      { name: "actual_start_date", type: "date" },
      { name: "actual_end_date", type: "date" },
      { name: "contract_value", type: "numeric" },
      { name: "budget_value", type: "numeric" },
      { name: "is_project_phase", type: "boolean" },
      { name: "deleted_at", type: "timestamptz" },
      { name: "city", type: "text" },
      { name: "client_name", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ],
    forbidden: ["progress", "progress_pct", "status_obra"],
    derivedRules: ["Projetos arquivados têm deleted_at IS NOT NULL — sempre filtre."],
  },
  {
    table: "project_payments",
    businessName: "Pagamentos / Parcelas",
    domain: "financeiro",
    description: "Parcelas previstas e realizadas.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "installment_number", type: "int" },
      { name: "description", type: "text" },
      { name: "amount", type: "numeric" },
      { name: "due_date", type: "date" },
      { name: "paid_at", type: "timestamptz" },
      { name: "payment_method", type: "text" },
      { name: "boleto_code", type: "text" },
      { name: "boleto_path", type: "text" },
      { name: "pix_key", type: "text" },
      { name: "payment_proof_path", type: "text" },
      { name: "notification_sent_at", type: "timestamptz" },
    ],
    forbidden: ["status"],
    derivedRules: [
      "paid: paid_at IS NOT NULL",
      "overdue: paid_at IS NULL AND due_date < CURRENT_DATE",
      "pending: paid_at IS NULL AND (due_date IS NULL OR due_date >= CURRENT_DATE)",
    ],
    joinHints: ["LEFT JOIN projects p ON p.id = project_payments.project_id"],
  },
  {
    table: "project_purchases",
    businessName: "Compras (produtos e prestadores)",
    domain: "compras",
    description: "Itens comprados ou prestadores agendados.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "fornecedor_id", type: "uuid" },
      { name: "supplier_name", type: "text" },
      { name: "item_name", type: "text" },
      { name: "description", type: "text" },
      { name: "category", type: "text" },
      { name: "quantity", type: "numeric" },
      { name: "unit", type: "text" },
      { name: "estimated_cost", type: "numeric" },
      { name: "actual_cost", type: "numeric" },
      { name: "required_by_date", type: "date" },
      { name: "lead_time_days", type: "int" },
      { name: "purchase_type", type: "text", description: "produto | prestador" },
      { name: "status", type: "text", description: "pending | ordered | delivered | cancelled" },
      { name: "scheduled_start", type: "date" },
      { name: "scheduled_end", type: "date" },
      { name: "order_date", type: "date" },
      { name: "expected_delivery_date", type: "date" },
      { name: "actual_delivery_date", type: "date" },
      { name: "paid_at", type: "timestamptz" },
      { name: "payment_due_date", type: "date" },
    ],
    derivedRules: [
      "Atrasada: required_by_date < CURRENT_DATE AND status NOT IN ('delivered','cancelled')",
      "Sem fornecedor: fornecedor_id IS NULL",
    ],
  },
  {
    table: "fornecedores",
    businessName: "Fornecedores",
    domain: "fornecedores",
    description: "Cadastro de fornecedores.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "nome", type: "text" },
      { name: "categoria", type: "text" },
      { name: "supplier_type", type: "text", description: "prestadores | produtos" },
      { name: "status", type: "text" },
      { name: "nota_avaliacao", type: "numeric" },
      { name: "prazo_entrega_dias", type: "int" },
      { name: "telefone", type: "text" },
      { name: "email", type: "text" },
      { name: "estado", type: "text" },
    ],
  },
  {
    table: "project_activities",
    businessName: "Cronograma",
    domain: "cronograma",
    description: "Atividades planejadas/executadas. Origem do progresso da obra.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "description", type: "text" },
      { name: "etapa", type: "text" },
      { name: "planned_start", type: "date" },
      { name: "planned_end", type: "date" },
      { name: "actual_start", type: "date" },
      { name: "actual_end", type: "date" },
      { name: "weight", type: "numeric" },
      { name: "sort_order", type: "int" },
      { name: "responsible_user_id", type: "uuid" },
      { name: "fornecedor_id", type: "uuid" },
    ],
    forbidden: ["progress_pct", "responsavel_user_id"],
    derivedRules: [
      "Atrasada: planned_end < CURRENT_DATE AND actual_end IS NULL",
      "Concluída: actual_end IS NOT NULL",
    ],
  },
  {
    table: "non_conformities",
    businessName: "NCs",
    domain: "ncs",
    description: "Não-conformidades.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "title", type: "text" },
      { name: "description", type: "text" },
      { name: "status", type: "text", description: "open | in_treatment | pending_verification | pending_approval | closed | reopened" },
      { name: "severity", type: "text", description: "low | medium | high | critical" },
      { name: "category", type: "text" },
      { name: "deadline", type: "date" },
      { name: "responsible_user_id", type: "uuid" },
      { name: "estimated_cost", type: "numeric" },
      { name: "actual_cost", type: "numeric" },
      { name: "resolved_at", type: "timestamptz" },
      { name: "reopen_count", type: "int" },
      { name: "created_at", type: "timestamptz" },
    ],
    derivedRules: [
      "Aberta: status <> 'closed'",
      "Vencida: status <> 'closed' AND deadline < CURRENT_DATE",
    ],
  },
  {
    table: "pending_items",
    businessName: "Pendências do cliente",
    domain: "pendencias",
    description: "Pendências bloqueadoras.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "title", type: "text" },
      { name: "description", type: "text" },
      { name: "type", type: "text" },
      { name: "status", type: "text", description: "pending | completed" },
      { name: "due_date", type: "date" },
      { name: "amount", type: "numeric" },
      { name: "impact", type: "text" },
      { name: "resolved_at", type: "timestamptz" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    table: "cs_tickets",
    businessName: "Atendimento (CS)",
    domain: "cs",
    description: "Tickets de Customer Success.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "situation", type: "text" },
      { name: "description", type: "text" },
      { name: "status", type: "text" },
      { name: "severity", type: "text" },
      { name: "responsible_user_id", type: "uuid" },
      { name: "resolved_at", type: "timestamptz" },
      { name: "created_at", type: "timestamptz" },
      { name: "action_plan", type: "text" },
    ],
  },
  {
    table: "users_profile",
    businessName: "Perfis de usuários",
    domain: "outros",
    description: "Use apenas para juntar nome do responsável.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "nome", type: "text" },
      { name: "email", type: "text" },
      { name: "perfil", type: "text" },
      { name: "status", type: "text" },
    ],
  },
];

// ============================================================
// KPIs nomeados — abstrações de NEGÓCIO que viram CTEs prontas.
// O Planner pode referenciar pelo nome ("saldo da obra") em vez de
// reconstruir a fórmula a cada pergunta.
// ============================================================

export interface NamedKpi {
  name: string;
  description: string;
  formula_pseudo: string;
  /** SQL CTE pronto pra colar no WITH ... */
  cte_template: string;
}

export const NAMED_KPIS: NamedKpi[] = [
  {
    name: "saldo_obra",
    description: "Liquidez da obra: recebido do cliente menos pago a fornecedor.",
    formula_pseudo: "SUM(payments.amount WHERE paid) - SUM(purchases.actual_cost WHERE paid)",
    cte_template: `saldo_obra AS (
  SELECT
    p.id AS project_id,
    p.name AS obra,
    COALESCE(SUM(pp.amount) FILTER (WHERE pp.paid_at IS NOT NULL), 0) AS recebido,
    COALESCE(SUM(pc.actual_cost) FILTER (WHERE pc.paid_at IS NOT NULL), 0) AS pago,
    COALESCE(SUM(pp.amount) FILTER (WHERE pp.paid_at IS NOT NULL), 0)
      - COALESCE(SUM(pc.actual_cost) FILTER (WHERE pc.paid_at IS NOT NULL), 0) AS saldo
  FROM projects p
  LEFT JOIN project_payments pp ON pp.project_id = p.id
  LEFT JOIN project_purchases pc ON pc.project_id = p.id
  WHERE p.deleted_at IS NULL
  GROUP BY p.id, p.name
)`,
  },
  {
    name: "exposicao_contratual",
    description: "Quanto ainda falta o cliente pagar (contract_value − recebido).",
    formula_pseudo: "contract_value - SUM(payments.amount WHERE paid)",
    cte_template: `exposicao_contratual AS (
  SELECT
    p.id AS project_id,
    p.name AS obra,
    p.contract_value,
    COALESCE(SUM(pp.amount) FILTER (WHERE pp.paid_at IS NOT NULL), 0) AS recebido,
    p.contract_value - COALESCE(SUM(pp.amount) FILTER (WHERE pp.paid_at IS NOT NULL), 0) AS exposicao
  FROM projects p
  LEFT JOIN project_payments pp ON pp.project_id = p.id
  WHERE p.deleted_at IS NULL
  GROUP BY p.id, p.name, p.contract_value
)`,
  },
  {
    name: "estouro_orcamento",
    description: "Quanto a obra estourou o orçamento estimado em compras.",
    formula_pseudo: "SUM(GREATEST(actual - estimated, 0))",
    cte_template: `estouro_orcamento AS (
  SELECT
    pc.project_id,
    SUM(pc.estimated_cost) AS orcamento_estimado,
    SUM(GREATEST(pc.actual_cost - pc.estimated_cost, 0)) AS estouro_total,
    COUNT(*) FILTER (WHERE pc.actual_cost > pc.estimated_cost) AS itens_estouraram,
    ROUND(
      100.0 * SUM(GREATEST(pc.actual_cost - pc.estimated_cost, 0))
        / NULLIF(SUM(pc.estimated_cost), 0),
      1
    ) AS estouro_pct
  FROM project_purchases pc
  WHERE pc.actual_cost IS NOT NULL
  GROUP BY pc.project_id
)`,
  },
  {
    name: "margem_prevista",
    description: "Margem teórica = (contrato − soma estimada de compras) / contrato.",
    formula_pseudo: "(contract_value - SUM(estimated_cost)) / contract_value",
    cte_template: `margem_prevista AS (
  SELECT
    p.id AS project_id,
    p.name AS obra,
    p.contract_value,
    COALESCE(SUM(pc.estimated_cost), 0) AS custo_estimado,
    p.contract_value - COALESCE(SUM(pc.estimated_cost), 0) AS margem_abs,
    CASE WHEN p.contract_value > 0
      THEN ROUND(100.0 * (p.contract_value - COALESCE(SUM(pc.estimated_cost), 0)) / p.contract_value, 1)
      ELSE NULL
    END AS margem_pct
  FROM projects p
  LEFT JOIN project_purchases pc ON pc.project_id = p.id AND pc.status <> 'cancelled'
  WHERE p.deleted_at IS NULL
  GROUP BY p.id, p.name, p.contract_value
)`,
  },
  {
    name: "atraso_cronograma",
    description: "Atividades atrasadas por obra (planned_end < hoje sem actual_end).",
    formula_pseudo: "COUNT(*) WHERE planned_end < CURRENT_DATE AND actual_end IS NULL",
    cte_template: `atraso_cronograma AS (
  SELECT
    pa.project_id,
    COUNT(*) FILTER (WHERE pa.planned_end < CURRENT_DATE AND pa.actual_end IS NULL) AS atividades_atrasadas,
    SUM(pa.weight) FILTER (WHERE pa.planned_end < CURRENT_DATE AND pa.actual_end IS NULL) AS peso_atrasado,
    MAX(CURRENT_DATE - pa.planned_end) FILTER (WHERE pa.planned_end < CURRENT_DATE AND pa.actual_end IS NULL) AS pior_atraso_dias
  FROM project_activities pa
  GROUP BY pa.project_id
)`,
  },
];

function renderNamedKpis(): string {
  const lines: string[] = ["\n# KPIs NOMEADOS (use o nome no plano e cole o CTE no WITH)"];
  for (const k of NAMED_KPIS) {
    lines.push(`\n## ${k.name}\n${k.description}\nFórmula: ${k.formula_pseudo}\n\`\`\`sql\n${k.cte_template}\n\`\`\``);
  }
  return lines.join("\n");
}

export function renderCatalog(): string {
  const lines: string[] = ["# CATÁLOGO (apenas SELECT, RLS aplicada)"];
  for (const t of CATALOG) {
    lines.push(`\n## ${t.table} — ${t.businessName} [${t.domain}]\n${t.description}`);
    lines.push(
      "Colunas: " +
        t.columns.map((c) => `${c.name} ${c.type}${c.description ? ` (${c.description})` : ""}`).join(", "),
    );
    if (t.derivedRules?.length) lines.push("Regras: " + t.derivedRules.join(" | "));
    if (t.forbidden?.length) lines.push("NÃO existem (não invente): " + t.forbidden.join(", "));
    if (t.joinHints?.length) lines.push("Joins úteis: " + t.joinHints.join(" | "));
  }
  lines.push(renderNamedKpis());
  return lines.join("\n");
}
