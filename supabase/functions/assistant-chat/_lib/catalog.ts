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
  return lines.join("\n");
}
