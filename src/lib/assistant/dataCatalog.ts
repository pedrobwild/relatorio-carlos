import type { InsightDomain } from "./insightTypes";

export interface CatalogColumn {
  name: string;
  type: "text" | "number" | "date" | "uuid" | "json" | "boolean" | "enum";
  nullable?: boolean;
  description?: string;
  enumValues?: string[];
}

export interface CatalogRelationship {
  column: string;
  table: string;
  referencedColumn: string;
  description?: string;
}

export interface CatalogTable {
  table: string;
  businessName: string;
  domain: InsightDomain;
  description: string;
  columns: CatalogColumn[];
  relationships: CatalogRelationship[];
  metrics: string[];
  dimensions: string[];
  commonFilters: string[];
  sampleQuestions: string[];
  interpretationRisks: string[];
  derivedStatusRules?: string[];
  forbiddenColumns?: string[];
  confidence: number;
}

/**
 * Curated schema catalog. Only the tables/columns listed here are visible to
 * the assistant. They were verified against `src/integrations/supabase/types.ts`
 * — never invent columns or tables.
 */
export const DATA_CATALOG: CatalogTable[] = [
  {
    table: "projects",
    businessName: "Obras / Projetos",
    domain: "obras",
    description: "Cadastro principal de obras. Cada obra agrega cronograma, financeiro, compras, NCs e atendimento.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "name", type: "text", description: "Nome da obra" },
      { name: "status", type: "text", description: "Status livre (ex: active, completed, paused)" },
      { name: "org_id", type: "uuid", nullable: true },
      { name: "created_by", type: "uuid" },
      { name: "planned_start_date", type: "date", nullable: true },
      { name: "planned_end_date", type: "date", nullable: true },
      { name: "actual_start_date", type: "date", nullable: true },
      { name: "actual_end_date", type: "date", nullable: true },
      { name: "contract_value", type: "number", nullable: true, description: "Valor do contrato em R$" },
      { name: "budget_value", type: "number", nullable: true, description: "Orçamento previsto em R$" },
      { name: "is_project_phase", type: "boolean" },
      { name: "deleted_at", type: "date", nullable: true, description: "Quando preenchida, registro foi soft-deleted." },
      { name: "city", type: "text", nullable: true },
      { name: "client_name", type: "text", nullable: true },
      { name: "created_at", type: "date" },
    ],
    relationships: [],
    metrics: [
      "count",
      "sum(contract_value)",
      "sum(budget_value)",
      "avg(contract_value)",
    ],
    dimensions: ["status", "city", "is_project_phase"],
    commonFilters: ["deleted_at IS NULL", "status = 'active'"],
    sampleQuestions: [
      "Quantas obras estão ativas?",
      "Liste obras com maior valor de contrato.",
      "Quais obras foram entregues no último trimestre?",
    ],
    interpretationRisks: [
      "Não existe coluna 'progress' aqui — progresso vem de project_activities.",
      "Filtre `deleted_at IS NULL` para evitar projetos arquivados.",
    ],
    forbiddenColumns: ["progress", "progress_pct"],
    confidence: 0.95,
  },
  {
    table: "project_payments",
    businessName: "Pagamentos / Parcelas",
    domain: "financeiro",
    description: "Parcelas previstas e realizadas de cada obra. Não há coluna `status`; ele é derivado.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "installment_number", type: "number" },
      { name: "description", type: "text" },
      { name: "amount", type: "number", description: "Valor em R$" },
      { name: "due_date", type: "date", nullable: true },
      { name: "paid_at", type: "date", nullable: true, description: "Quando preenchida, parcela foi quitada." },
      { name: "payment_method", type: "text", nullable: true },
      { name: "boleto_code", type: "text", nullable: true },
      { name: "boleto_path", type: "text", nullable: true },
      { name: "pix_key", type: "text", nullable: true },
      { name: "payment_proof_path", type: "text", nullable: true },
      { name: "notification_sent_at", type: "date", nullable: true },
      { name: "created_at", type: "date" },
    ],
    relationships: [
      { column: "project_id", table: "projects", referencedColumn: "id" },
    ],
    metrics: [
      "count",
      "sum(amount)",
      "avg(amount)",
      "sum(amount) FILTER (WHERE paid_at IS NOT NULL)",
      "sum(amount) FILTER (WHERE paid_at IS NULL AND due_date < CURRENT_DATE)",
    ],
    dimensions: ["project_id", "payment_method", "due_date", "paid_at"],
    commonFilters: [
      "paid_at IS NULL",
      "paid_at IS NOT NULL",
      "due_date < CURRENT_DATE",
      "due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7",
    ],
    sampleQuestions: [
      "Quais pagamentos vencem hoje?",
      "Quanto há em atraso por obra?",
      "Quanto foi recebido no mês?",
    ],
    interpretationRisks: [
      "Não invente coluna `status`. Use a derivação documentada.",
      "Datas nulas (due_date) significam parcelas sem vencimento definido.",
    ],
    derivedStatusRules: [
      "paid: paid_at IS NOT NULL",
      "overdue: paid_at IS NULL AND due_date < CURRENT_DATE",
      "pending: paid_at IS NULL AND (due_date IS NULL OR due_date >= CURRENT_DATE)",
    ],
    forbiddenColumns: ["status"],
    confidence: 0.97,
  },
  {
    table: "project_purchases",
    businessName: "Compras (produtos e prestadores)",
    domain: "compras",
    description: "Itens comprados ou prestadores agendados. Cobre tanto produtos quanto serviços.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "fornecedor_id", type: "uuid", nullable: true },
      { name: "supplier_name", type: "text", nullable: true },
      { name: "item_name", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "category", type: "text", nullable: true },
      { name: "quantity", type: "number" },
      { name: "unit", type: "text" },
      { name: "estimated_cost", type: "number", nullable: true },
      { name: "actual_cost", type: "number", nullable: true },
      { name: "required_by_date", type: "date" },
      { name: "lead_time_days", type: "number" },
      { name: "purchase_type", type: "text", nullable: true, enumValues: ["produto", "prestador"] },
      { name: "status", type: "text", description: "pending | ordered | delivered | cancelled" },
      { name: "scheduled_start", type: "date", nullable: true },
      { name: "scheduled_end", type: "date", nullable: true },
      { name: "order_date", type: "date", nullable: true },
      { name: "expected_delivery_date", type: "date", nullable: true },
      { name: "actual_delivery_date", type: "date", nullable: true },
      { name: "paid_at", type: "date", nullable: true },
      { name: "payment_due_date", type: "date", nullable: true },
      { name: "created_at", type: "date" },
    ],
    relationships: [
      { column: "project_id", table: "projects", referencedColumn: "id" },
      { column: "fornecedor_id", table: "fornecedores", referencedColumn: "id" },
    ],
    metrics: [
      "count",
      "sum(estimated_cost)",
      "sum(actual_cost)",
      "sum(actual_cost - estimated_cost)",
    ],
    dimensions: ["status", "purchase_type", "category", "fornecedor_id", "supplier_name"],
    commonFilters: [
      "status = 'pending'",
      "status = 'ordered'",
      "required_by_date < CURRENT_DATE",
      "purchase_type = 'prestador'",
    ],
    sampleQuestions: [
      "Quais compras estão atrasadas?",
      "Quais fornecedores aparecem mais nas compras?",
      "Onde o custo real ultrapassou o estimado?",
    ],
    interpretationRisks: [
      "Para identificar itens sem fornecedor: fornecedor_id IS NULL OR supplier_name IS NULL.",
      "Atraso = required_by_date < CURRENT_DATE AND status NOT IN ('delivered','cancelled').",
    ],
    confidence: 0.94,
  },
  {
    table: "fornecedores",
    businessName: "Fornecedores / Prestadores",
    domain: "fornecedores",
    description: "Cadastro de fornecedores e prestadores.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "nome", type: "text" },
      { name: "categoria", type: "enum", description: "Tipo do fornecedor (enum supplier_category)" },
      { name: "supplier_type", type: "text", nullable: true, enumValues: ["prestadores", "produtos"] },
      { name: "telefone", type: "text", nullable: true },
      { name: "email", type: "text", nullable: true },
      { name: "status", type: "text" },
      { name: "nota_avaliacao", type: "number", nullable: true },
      { name: "prazo_entrega_dias", type: "number", nullable: true },
      { name: "cidade", type: "text", nullable: true },
      { name: "estado", type: "text", nullable: true },
      { name: "created_at", type: "date" },
    ],
    relationships: [],
    metrics: ["count", "avg(nota_avaliacao)", "avg(prazo_entrega_dias)"],
    dimensions: ["categoria", "supplier_type", "status", "estado"],
    commonFilters: ["status = 'ativo'", "supplier_type = 'prestadores'"],
    sampleQuestions: [
      "Quais os fornecedores melhor avaliados?",
      "Quantos fornecedores estão inativos?",
    ],
    interpretationRisks: [
      "nota_avaliacao pode estar nula em fornecedores não avaliados.",
    ],
    confidence: 0.92,
  },
  {
    table: "project_activities",
    businessName: "Cronograma (atividades)",
    domain: "cronograma",
    description: "Atividades planejadas/executadas. Origem do progresso da obra.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "description", type: "text" },
      { name: "etapa", type: "text", nullable: true },
      { name: "planned_start", type: "date" },
      { name: "planned_end", type: "date" },
      { name: "actual_start", type: "date", nullable: true },
      { name: "actual_end", type: "date", nullable: true },
      { name: "weight", type: "number", description: "Peso da atividade no cronograma" },
      { name: "sort_order", type: "number" },
      { name: "responsible_user_id", type: "uuid", nullable: true },
      { name: "fornecedor_id", type: "uuid", nullable: true },
      { name: "baseline_start", type: "date", nullable: true },
      { name: "baseline_end", type: "date", nullable: true },
      { name: "created_at", type: "date" },
    ],
    relationships: [
      { column: "project_id", table: "projects", referencedColumn: "id" },
      { column: "responsible_user_id", table: "users_profile", referencedColumn: "id" },
      { column: "fornecedor_id", table: "fornecedores", referencedColumn: "id" },
    ],
    metrics: [
      "count",
      "count(*) FILTER (WHERE actual_end IS NULL AND planned_end < CURRENT_DATE)",
      "sum(weight)",
    ],
    dimensions: ["etapa", "responsible_user_id", "project_id"],
    commonFilters: [
      "actual_end IS NULL AND planned_end < CURRENT_DATE",
      "planned_start BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'",
    ],
    sampleQuestions: [
      "Quais atividades estão atrasadas?",
      "Qual o progresso médio por obra?",
    ],
    interpretationRisks: [
      "Atrasada: actual_end IS NULL AND planned_end < CURRENT_DATE.",
      "Não existe coluna `progress_pct` na tabela; progresso é derivado de actual_end vs planned_end.",
    ],
    forbiddenColumns: ["progress_pct"],
    confidence: 0.93,
  },
  {
    table: "non_conformities",
    businessName: "Não-conformidades (NCs)",
    domain: "ncs",
    description: "Registros de qualidade. Status enum nc_status; severidade enum nc_severity.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "title", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "status", type: "enum", description: "open | in_treatment | pending_verification | pending_approval | closed | reopened" },
      { name: "severity", type: "enum", description: "low | medium | high | critical (enum nc_severity)" },
      { name: "category", type: "text", nullable: true },
      { name: "deadline", type: "date", nullable: true },
      { name: "responsible_user_id", type: "uuid", nullable: true },
      { name: "created_by", type: "uuid" },
      { name: "estimated_cost", type: "number", nullable: true },
      { name: "actual_cost", type: "number", nullable: true },
      { name: "resolved_at", type: "date", nullable: true },
      { name: "reopen_count", type: "number" },
      { name: "created_at", type: "date" },
    ],
    relationships: [
      { column: "project_id", table: "projects", referencedColumn: "id" },
      { column: "responsible_user_id", table: "users_profile", referencedColumn: "id" },
    ],
    metrics: [
      "count",
      "count(*) FILTER (WHERE status <> 'closed')",
      "count(*) FILTER (WHERE severity = 'critical')",
      "sum(actual_cost)",
    ],
    dimensions: ["status", "severity", "category", "responsible_user_id"],
    commonFilters: [
      "status <> 'closed'",
      "deadline < CURRENT_DATE AND status <> 'closed'",
    ],
    sampleQuestions: [
      "Quais NCs críticas estão abertas?",
      "Quais obras concentram mais NCs?",
    ],
    interpretationRisks: [
      "NCs abertas = status <> 'closed'.",
      "Reincidência = reopen_count > 0.",
    ],
    confidence: 0.93,
  },
  {
    table: "pending_items",
    businessName: "Pendências do cliente",
    domain: "pendencias",
    description: "Pendências bloqueadoras enviadas ao cliente. Pode ter valor financeiro associado.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "title", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "type", type: "enum", description: "enum pending_item_type" },
      { name: "status", type: "enum", description: "enum pending_item_status (pending | completed)" },
      { name: "due_date", type: "date", nullable: true },
      { name: "amount", type: "number", nullable: true },
      { name: "impact", type: "text", nullable: true },
      { name: "resolved_at", type: "date", nullable: true },
      { name: "resolved_by", type: "uuid", nullable: true },
      { name: "created_at", type: "date" },
    ],
    relationships: [
      { column: "project_id", table: "projects", referencedColumn: "id" },
    ],
    metrics: ["count", "sum(amount)", "count(*) FILTER (WHERE status = 'pending')"],
    dimensions: ["type", "status", "project_id"],
    commonFilters: [
      "status = 'pending'",
      "due_date < CURRENT_DATE AND status = 'pending'",
    ],
    sampleQuestions: [
      "Quais pendências do cliente vencem nos próximos 7 dias?",
      "Quais pendências estão bloqueando obras?",
    ],
    interpretationRisks: [
      "Pendência atrasada = due_date < CURRENT_DATE AND status = 'pending'.",
    ],
    confidence: 0.9,
  },
  {
    table: "cs_tickets",
    businessName: "Atendimento (CS)",
    domain: "cs",
    description: "Tickets de Customer Success ligados a obras.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "situation", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "status", type: "enum", description: "enum cs_ticket_status" },
      { name: "severity", type: "enum", description: "enum cs_ticket_severity" },
      { name: "responsible_user_id", type: "uuid", nullable: true },
      { name: "created_by", type: "uuid" },
      { name: "created_at", type: "date" },
      { name: "resolved_at", type: "date", nullable: true },
      { name: "action_plan", type: "text", nullable: true },
    ],
    relationships: [
      { column: "project_id", table: "projects", referencedColumn: "id" },
      { column: "responsible_user_id", table: "users_profile", referencedColumn: "id" },
    ],
    metrics: [
      "count",
      "count(*) FILTER (WHERE resolved_at IS NULL)",
      "avg(EXTRACT(EPOCH FROM (resolved_at - created_at))/86400)",
    ],
    dimensions: ["status", "severity", "project_id", "responsible_user_id"],
    commonFilters: ["resolved_at IS NULL", "severity IN ('high','critical')"],
    sampleQuestions: [
      "Quais tickets críticos estão abertos?",
      "Qual a evolução de tickets desta semana?",
    ],
    interpretationRisks: [
      "Tickets em aberto = resolved_at IS NULL.",
    ],
    confidence: 0.9,
  },
  {
    table: "users_profile",
    businessName: "Usuários do sistema",
    domain: "outros",
    description: "Perfis. Use apenas para juntar nome do responsável.",
    columns: [
      { name: "id", type: "uuid" },
      { name: "nome", type: "text" },
      { name: "email", type: "text" },
      { name: "perfil", type: "enum" },
      { name: "status", type: "enum" },
      { name: "cargo", type: "text", nullable: true },
      { name: "empresa", type: "text", nullable: true },
    ],
    relationships: [],
    metrics: ["count"],
    dimensions: ["perfil", "status"],
    commonFilters: ["status = 'active'"],
    sampleQuestions: ["Quantos usuários estão ativos?"],
    interpretationRisks: ["Nunca exponha email a clientes externos."],
    confidence: 0.85,
  },
];

/** Convenience map by table name. */
export const CATALOG_BY_TABLE: Record<string, CatalogTable> = Object.fromEntries(
  DATA_CATALOG.map((t) => [t.table, t]),
);

/** Convenience map by domain. */
export function tablesByDomain(domain: InsightDomain): CatalogTable[] {
  return DATA_CATALOG.filter((t) => t.domain === domain);
}

/** Render catalog as markdown summary, used in LLM prompt building. */
export function renderCatalogPrompt(catalog: CatalogTable[] = DATA_CATALOG): string {
  const blocks: string[] = ["# CATÁLOGO DE TABELAS DISPONÍVEIS (apenas SELECT, RLS aplicada)"];
  for (const t of catalog) {
    const cols = t.columns
      .map((c) => `${c.name} ${c.type}${c.nullable ? "?" : ""}${c.description ? ` -- ${c.description}` : ""}`)
      .join(", ");
    const rels = t.relationships.length
      ? `\n  Joins seguros: ${t.relationships.map((r) => `${r.column} → ${r.table}.${r.referencedColumn}`).join(", ")}`
      : "";
    const derived = t.derivedStatusRules?.length
      ? `\n  Status derivado: ${t.derivedStatusRules.join(" | ")}`
      : "";
    const forbidden = t.forbiddenColumns?.length
      ? `\n  NÃO existem (não invente): ${t.forbiddenColumns.join(", ")}`
      : "";
    blocks.push(
      `## ${t.table} — ${t.businessName} [${t.domain}]\n  ${t.description}\n  Colunas: ${cols}${rels}${derived}${forbidden}`,
    );
  }
  return blocks.join("\n\n");
}
