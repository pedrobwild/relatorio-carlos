// Sinônimos e mini-glossário de obra/finance, expandido para PT-BR coloquial
// brasileiro de canteiro. Injetado no prompt do Planner para reduzir
// ambiguidade. Ex: "tá apertando" → margem ou prazo; "secou" → saldo negativo.

export const GLOSSARY_BLOCK = `# GLOSSÁRIO COLOQUIAL (mapeie a fala do usuário para coluna correta)

## Financeiro
- "vence" / "venceu" / "tá pra vencer" → due_date / required_by_date
- "tá no vermelho" / "secou" / "no negativo" → saldo (recebido − pago) < 0
- "estourou" / "passou do alvo" / "passou do orçamento" → actual_cost > estimated_cost
- "tá sangrando" → estouro de compra OU pagamento atrasado de cliente
- "recebeu" / "caiu" / "entrou" → project_payments.paid_at IS NOT NULL
- "boletou" / "emitiu boleto" → boleto_code IS NOT NULL
- "PIX" / "transferiu" → payment_method ILIKE '%pix%'
- "comissão" / "repasse" → fora do escopo dessa base hoje (sinalize)

## Cronograma
- "tá em dia" / "no prazo" → actual_end IS NOT NULL E actual_end <= planned_end
- "atrasou" / "tá atrasado" / "ficou pra trás" → planned_end < hoje E actual_end IS NULL
- "tá voando" → atividade concluída antes do planned_end
- "travou" / "parou" → atividade sem actual_start mas planned_start já passou
- "vai estourar o prazo" → forecast (planned_end − atividades pendentes) > planned_end_date da obra
- "fase" / "etapa" → project_activities.etapa
- "diagnóstico", "projeto", "reforma", "entrega" → as 4 fases canônicas Bwild

## Compras / fornecedor
- "comprou" / "fechou" → status IN ('ordered','delivered')
- "chegou" / "entregou" → status='delivered' OU actual_delivery_date IS NOT NULL
- "atrasou a entrega" → actual_delivery_date > required_by_date
- "tá pendente de cotação" → status='pending' AND fornecedor_id IS NULL
- "fornecedor problemático" → fornecedor com nota_avaliacao < 3 OU muitas entregas atrasadas
- "PJ" / "empreiteiro" / "prestador" → fornecedores.supplier_type='prestadores'
- "produto" / "material" → fornecedores.supplier_type='produtos'

## NCs e qualidade
- "NC" / "não conformidade" / "defeito" / "problema de qualidade" → non_conformities
- "abriu NC" → non_conformities recém-criada
- "fechou NC" → status='closed' / resolved_at IS NOT NULL
- "voltou" / "reabriu" → reopen_count > 0
- "tá demorando pra resolver" → CURRENT_DATE - created_at::date > 7 e status<>'closed'

## Cliente / CS
- "cliente reclamou" → cs_tickets recém-criado
- "ticket aberto" → cs_tickets.resolved_at IS NULL
- "fora do contrato" → escopo extra; pode estar em pending_items ou cs_tickets

## Obras (entidade)
- "minha obra" / "a obra do João" → projects.client_name ILIKE '%João%'
- "obra do bairro X" → projects.city ILIKE '%X%'
- "obra ativa" / "rodando" → deleted_at IS NULL AND actual_end_date IS NULL
- "obra entregue" → actual_end_date IS NOT NULL
- "todas as obras" → deleted_at IS NULL (incluindo entregues)

## Tempo (sempre relativo)
- "agora" / "hoje" → CURRENT_DATE
- "ontem" → CURRENT_DATE - INTERVAL '1 day'
- "essa semana" → BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'
- "semana que vem" → BETWEEN CURRENT_DATE + 7 AND CURRENT_DATE + 13
- "esse mês" → date_trunc('month', CURRENT_DATE)
- "mês passado" → date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
- "trimestre" → últimos 90 dias OU date_trunc('quarter', ...)
- "no ano" → date_trunc('year', CURRENT_DATE)
- "últimos N dias" → CURRENT_DATE - INTERVAL 'N days'`;
