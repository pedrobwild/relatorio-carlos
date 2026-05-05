// Few-shot canônico de SQL para o Planner. Cada exemplo é uma pergunta real
// que apareceu (ou tende a aparecer) em produção, com o SQL "ouro" — aquele
// que o time validou. Reduz drasticamente alucinação de coluna e padroniza
// o estilo (CTEs, alias semântico em PT-BR, ORDER BY útil).
//
// Importante: NÃO inclua exemplos longos demais. O LLM aprende mais com 8
// exemplos curtos e variados do que com 3 exemplos enormes.

export interface SqlExample {
  pergunta: string;
  intent: string;
  domain: string;
  sql: string;
}

export const SQL_EXAMPLES: SqlExample[] = [
  {
    pergunta: 'Quanto vence essa semana?',
    intent: 'Pagamentos do cliente vencendo de hoje até domingo, agrupados por obra.',
    domain: 'financeiro',
    sql: `SELECT
  p.name AS obra,
  COUNT(*) AS qtd_parcelas,
  SUM(pp.amount) AS valor_total,
  MIN(pp.due_date) AS proximo_vencimento
FROM project_payments pp
LEFT JOIN projects p ON p.id = pp.project_id
WHERE pp.paid_at IS NULL
  AND pp.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
  AND p.deleted_at IS NULL
GROUP BY p.name
ORDER BY proximo_vencimento ASC`,
  },
  {
    pergunta: 'Qual o saldo de cada obra?',
    intent: 'Saldo = recebido − pago, por obra ativa, do mais positivo ao mais negativo.',
    domain: 'financeiro',
    sql: `WITH recebido AS (
  SELECT project_id, COALESCE(SUM(amount), 0) AS total_recebido
  FROM project_payments
  WHERE paid_at IS NOT NULL
  GROUP BY project_id
),
pago AS (
  SELECT project_id, COALESCE(SUM(actual_cost), 0) AS total_pago
  FROM project_purchases
  WHERE paid_at IS NOT NULL
  GROUP BY project_id
)
SELECT
  p.id AS project_id,
  p.name AS obra,
  COALESCE(r.total_recebido, 0) AS recebido,
  COALESCE(pg.total_pago, 0) AS pago,
  COALESCE(r.total_recebido, 0) - COALESCE(pg.total_pago, 0) AS saldo
FROM projects p
LEFT JOIN recebido r ON r.project_id = p.id
LEFT JOIN pago pg ON pg.project_id = p.id
WHERE p.deleted_at IS NULL
  AND (p.actual_end_date IS NULL OR p.actual_end_date > CURRENT_DATE - INTERVAL '30 days')
ORDER BY saldo DESC`,
  },
  {
    pergunta: 'Quais obras estão fugindo do orçamento?',
    intent: 'Estouro = soma(actual − estimated) por obra, só onde estourou; ordenado pelo pior.',
    domain: 'compras',
    sql: `SELECT
  p.name AS obra,
  COUNT(pc.id) FILTER (WHERE pc.actual_cost > pc.estimated_cost) AS itens_estouraram,
  SUM(GREATEST(pc.actual_cost - pc.estimated_cost, 0)) AS estouro_total,
  SUM(pc.estimated_cost) AS orcamento_estimado,
  ROUND(
    100.0 * SUM(GREATEST(pc.actual_cost - pc.estimated_cost, 0))
      / NULLIF(SUM(pc.estimated_cost), 0),
    1
  ) AS estouro_pct
FROM project_purchases pc
LEFT JOIN projects p ON p.id = pc.project_id
WHERE p.deleted_at IS NULL
  AND pc.actual_cost IS NOT NULL
GROUP BY p.name
HAVING SUM(GREATEST(pc.actual_cost - pc.estimated_cost, 0)) > 0
ORDER BY estouro_total DESC`,
  },
  {
    pergunta: 'Quais NCs críticas estão abertas e há quanto tempo?',
    intent: 'NCs com severity=critical, status≠closed, idade em dias, mais antigas primeiro.',
    domain: 'ncs',
    sql: `SELECT
  p.name AS obra,
  nc.title,
  nc.category,
  nc.deadline,
  CURRENT_DATE - nc.created_at::date AS dias_aberta,
  CASE
    WHEN nc.deadline < CURRENT_DATE THEN CURRENT_DATE - nc.deadline
    ELSE 0
  END AS dias_em_atraso,
  nc.reopen_count
FROM non_conformities nc
LEFT JOIN projects p ON p.id = nc.project_id
WHERE nc.severity = 'critical'
  AND nc.status <> 'closed'
  AND p.deleted_at IS NULL
ORDER BY dias_aberta DESC`,
  },
  {
    pergunta: 'O que eu preciso priorizar hoje?',
    intent: 'União ranqueada de itens críticos: NCs críticas vencidas, pagamentos atrasados, compras atrasadas.',
    domain: 'pendencias',
    sql: `WITH itens AS (
  SELECT
    'NC crítica vencida' AS tipo,
    nc.title AS descricao,
    p.name AS obra,
    nc.deadline AS data_referencia,
    CURRENT_DATE - nc.deadline AS dias_em_atraso,
    nc.estimated_cost AS valor_em_jogo,
    100 AS peso
  FROM non_conformities nc
  LEFT JOIN projects p ON p.id = nc.project_id
  WHERE nc.severity = 'critical' AND nc.status <> 'closed'
    AND nc.deadline < CURRENT_DATE AND p.deleted_at IS NULL

  UNION ALL

  SELECT
    'Pagamento atrasado',
    pp.description,
    p.name,
    pp.due_date,
    CURRENT_DATE - pp.due_date,
    pp.amount,
    80
  FROM project_payments pp
  LEFT JOIN projects p ON p.id = pp.project_id
  WHERE pp.paid_at IS NULL AND pp.due_date < CURRENT_DATE
    AND p.deleted_at IS NULL

  UNION ALL

  SELECT
    'Compra atrasada',
    pc.item_name,
    p.name,
    pc.required_by_date,
    CURRENT_DATE - pc.required_by_date,
    pc.estimated_cost,
    60
  FROM project_purchases pc
  LEFT JOIN projects p ON p.id = pc.project_id
  WHERE pc.required_by_date < CURRENT_DATE
    AND pc.status NOT IN ('delivered', 'cancelled')
    AND p.deleted_at IS NULL
)
SELECT * FROM itens
ORDER BY peso DESC, dias_em_atraso DESC`,
  },
  {
    pergunta: 'Comparar gasto deste mês vs mês passado',
    intent: 'Compras pagas, agregadas por mês corrente e anterior; mostra delta absoluto e %.',
    domain: 'compras',
    sql: `WITH base AS (
  SELECT
    date_trunc('month', paid_at) AS mes,
    SUM(actual_cost) AS gasto
  FROM project_purchases
  WHERE paid_at IS NOT NULL
    AND paid_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
  GROUP BY 1
)
SELECT
  to_char(mes, 'MM/YYYY') AS mes,
  gasto,
  gasto - LAG(gasto) OVER (ORDER BY mes) AS delta_abs,
  ROUND(
    100.0 * (gasto - LAG(gasto) OVER (ORDER BY mes))
      / NULLIF(LAG(gasto) OVER (ORDER BY mes), 0),
    1
  ) AS delta_pct
FROM base
ORDER BY mes`,
  },
  {
    pergunta: 'Quais fornecedores entregaram com atraso nos últimos 90 dias?',
    intent: 'Fornecedor × atraso médio em dias × qtd de itens entregues atrasados.',
    domain: 'fornecedores',
    sql: `SELECT
  COALESCE(pc.supplier_name, f.nome, '(sem fornecedor)') AS fornecedor,
  COUNT(*) AS itens_entregues,
  COUNT(*) FILTER (
    WHERE pc.actual_delivery_date > pc.required_by_date
  ) AS itens_atrasados,
  ROUND(
    AVG(EXTRACT(DAY FROM pc.actual_delivery_date - pc.required_by_date))
      FILTER (WHERE pc.actual_delivery_date > pc.required_by_date),
    1
  ) AS dias_atraso_medio
FROM project_purchases pc
LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
WHERE pc.actual_delivery_date IS NOT NULL
  AND pc.actual_delivery_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1
HAVING COUNT(*) FILTER (WHERE pc.actual_delivery_date > pc.required_by_date) > 0
ORDER BY dias_atraso_medio DESC NULLS LAST`,
  },
  {
    pergunta: 'Cronograma — quais atividades atrasam a obra X?',
    intent: 'Atividades com planned_end < hoje sem actual_end, ordenadas pela data planejada.',
    domain: 'cronograma',
    sql: `SELECT
  p.name AS obra,
  pa.etapa,
  pa.description AS atividade,
  pa.planned_end,
  CURRENT_DATE - pa.planned_end AS dias_em_atraso,
  pa.weight
FROM project_activities pa
LEFT JOIN projects p ON p.id = pa.project_id
WHERE pa.planned_end < CURRENT_DATE
  AND pa.actual_end IS NULL
  AND p.deleted_at IS NULL
ORDER BY pa.planned_end ASC`,
  },
];

export function renderSqlExamples(): string {
  const lines: string[] = ['# EXEMPLOS DE SQL CANÔNICO (estude o estilo)'];
  for (const ex of SQL_EXAMPLES) {
    lines.push(`\n## "${ex.pergunta}" [${ex.domain}]`);
    lines.push(`Intent: ${ex.intent}`);
    lines.push('```sql');
    lines.push(ex.sql);
    lines.push('```');
  }
  lines.push(
    '\nUse o MESMO estilo: CTEs nomeadas, alias PT-BR, COALESCE em SUM, JOIN em projects com filtro deleted_at, ORDER BY que faça sentido para a decisão.',
  );
  return lines.join('\n');
}
