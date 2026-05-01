import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, corsResponse, jsonResponse } from '../_shared/cors.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

// =============================================================================
// CATÁLOGO DE DADOS (curado: somente o que o assistente "enxerga")
// =============================================================================
const SCHEMA_CATALOG = `
# CATÁLOGO DE TABELAS DISPONÍVEIS (apenas leitura, RLS aplicada automaticamente)

## projects (obras / projetos)
- id uuid, name text, status text, org_id uuid, created_by uuid
- start_date date, end_date date, budget_total numeric
- is_project_phase boolean  -- true = fase do projeto (anterior à obra)
- Relacionamentos: 1→N project_payments, project_purchases, project_activities,
  non_conformities, pending_items, cs_tickets, inspections, weekly_reports, formalizations

## project_payments (parcelas / pagamentos do cliente)
- id uuid, project_id uuid, installment_number int
- description text, amount numeric, due_date date, paid_at timestamptz
- payment_method text, boleto_code text, boleto_path text, pix_key text
- payment_proof_path text, notification_sent_at timestamptz
- IMPORTANTE: NÃO existe coluna 'status'. Derive o status assim:
    * 'paid' quando paid_at IS NOT NULL
    * 'overdue' quando paid_at IS NULL AND due_date < CURRENT_DATE
    * 'pending' quando paid_at IS NULL AND due_date >= CURRENT_DATE
  Padrão: CASE WHEN paid_at IS NOT NULL THEN 'paid'
               WHEN due_date < CURRENT_DATE THEN 'overdue'
               ELSE 'pending' END AS status

## project_purchases (compras de produtos e prestadores de serviço)
- id uuid, project_id uuid, item_name text, description text
- quantity numeric, unit text, estimated_cost numeric, actual_cost numeric
- category text, supplier_name text, fornecedor_id uuid
- required_by_date date, lead_time_days int
- status text  -- 'pending' | 'ordered' | 'delivered' | 'cancelled'
- purchase_type text  -- 'produto' | 'prestador'
- scheduled_start date, scheduled_end date
- payment_terms text, payment_method text
- Variação financeira: actual_cost - estimated_cost (positivo = estouro orçamentário)

## fornecedores (cadastro mestre de fornecedores e prestadores)
- id uuid, nome text, categoria text, telefone text, email text, cnpj text
- supplier_type text  -- 'prestadores' | 'produtos'
- status text  -- 'ativo' | 'inativo'
- nota_avaliacao numeric  -- 0-10, média de avaliações
- prazo_pagamento_dias int

## project_activities (cronograma físico da obra)
- id uuid, project_id uuid, description text, etapa text
- planned_start date, planned_end date, actual_start date, actual_end date
- weight numeric, sort_order int, progress_pct numeric  -- 0-100
- responsavel_user_id uuid
- Atrasada: planned_end < CURRENT_DATE AND (actual_end IS NULL OR progress_pct < 100)
- No prazo: progress_pct >= 100 OR planned_end >= CURRENT_DATE

## non_conformities (NCs - não-conformidades / desvios de qualidade/segurança)
- id uuid, project_id uuid, title text, description text
- status text  -- 'open'|'in_treatment'|'pending_verification'|'pending_approval'|'closed'|'reopened'
- severity text  -- 'low'|'medium'|'high'|'critical'
- category text, deadline date
- responsible_user_id uuid, created_by uuid
- created_at, updated_at timestamptz, closed_at timestamptz
- Em aberto: status NOT IN ('closed')
- Atrasada: deadline < CURRENT_DATE AND status NOT IN ('closed')

## pending_items (pendências do cliente — ex: documentos, decisões)
- id uuid, project_id uuid, title text, description text
- type text, status text  -- 'pending' | 'completed'
- due_date date, amount numeric
- completed_at timestamptz, created_at timestamptz

## cs_tickets (Customer Success — atendimentos pós-venda)
- id uuid, project_id uuid, situation text, description text
- status text  -- 'aberto' | 'em_andamento' | 'concluido'
- severity text  -- 'baixa' | 'media' | 'alta' | 'critica'
- action_plan text, responsible_user_id uuid
- created_at timestamptz, resolved_at timestamptz
- Tempo de resolução: EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 (horas)

## inspections (vistorias na obra)
- id uuid, project_id uuid, title text, status text
- scheduled_at timestamptz, performed_at timestamptz
- inspector_user_id uuid, score numeric
- created_at timestamptz

## inspection_items (itens checados em uma vistoria)
- id uuid, inspection_id uuid, description text
- result text  -- 'ok' | 'nc' | 'na'
- severity text, observation text

## obra_tasks (tarefas operacionais da obra)
- id uuid, project_id uuid, title text, description text
- status text  -- 'todo' | 'doing' | 'done' | 'blocked'
- priority text  -- 'low' | 'medium' | 'high' | 'urgent'
- due_date date, assignee_user_id uuid
- created_at, completed_at timestamptz

## weekly_reports (relatórios semanais consolidados — JSON)
- id uuid, project_id uuid
- week_number int, week_start date, week_end date
- available_at timestamptz, data jsonb  -- estrutura semanal congelada
- created_by uuid, created_at, updated_at timestamptz

## formalizations (formalizações / contratos / aditivos)
- id uuid, project_id uuid, title text, type text
- status text, signed_at timestamptz
- value numeric, created_at timestamptz

## project_members (equipe/atribuições no projeto)
- id uuid, project_id uuid, user_id uuid, role text
- created_at timestamptz

## users_profile (perfis dos usuários)
- id uuid, nome text, email text, telefone text, empresa text, cargo text
- perfil text  -- 'admin' | 'engineer' | 'csm' | 'customer' | etc
- status text  -- 'ativo' | 'inativo'

## notifications (notificações do sistema)
- id uuid, user_id uuid, project_id uuid
- type text, title text, message text
- read_at timestamptz, created_at timestamptz

## domain_events (auditoria/eventos de domínio)
- id uuid, aggregate_type text, aggregate_id uuid, event_type text
- payload jsonb, user_id uuid, project_id uuid, created_at timestamptz

## orcamentos (orçamentos das obras / propostas)
- id uuid, project_id uuid, total numeric, status text, created_at timestamptz

# RECEITAS DE CONSULTAS COMUNS

- "Compras vencendo hoje":
    SELECT p.name AS obra, pp.item_name, pp.estimated_cost, pp.required_by_date
    FROM project_purchases pp LEFT JOIN projects p ON p.id = pp.project_id
    WHERE pp.required_by_date = CURRENT_DATE AND pp.status = 'pending'
    ORDER BY pp.estimated_cost DESC NULLS LAST

- "Pagamentos atrasados (overdue) por obra":
    SELECT p.name AS obra, COUNT(*) AS qtd, SUM(pmt.amount) AS total
    FROM project_payments pmt LEFT JOIN projects p ON p.id = pmt.project_id
    WHERE pmt.paid_at IS NULL AND pmt.due_date < CURRENT_DATE
    GROUP BY p.name ORDER BY total DESC NULLS LAST

- "NCs por severidade":
    SELECT severity, COUNT(*) AS qtd
    FROM non_conformities WHERE status NOT IN ('closed')
    GROUP BY severity
    ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                          WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END

- "Aderência ao cronograma (progresso planejado vs real)":
    SELECT p.name AS obra,
           AVG(pa.progress_pct) AS progresso_medio,
           SUM(CASE WHEN pa.planned_end < CURRENT_DATE
                     AND (pa.actual_end IS NULL OR pa.progress_pct < 100)
                    THEN 1 ELSE 0 END) AS atividades_atrasadas
    FROM project_activities pa LEFT JOIN projects p ON p.id = pa.project_id
    GROUP BY p.name ORDER BY progresso_medio ASC

- "Top 5 obras com maior custo extra em compras":
    SELECT p.name AS obra,
           SUM(COALESCE(pp.actual_cost, 0) - COALESCE(pp.estimated_cost, 0)) AS extra
    FROM project_purchases pp LEFT JOIN projects p ON p.id = pp.project_id
    WHERE pp.actual_cost IS NOT NULL
    GROUP BY p.name ORDER BY extra DESC NULLS LAST LIMIT 5

- "Tendência mensal de pagamentos recebidos":
    SELECT date_trunc('month', paid_at) AS mes, SUM(amount) AS total
    FROM project_payments WHERE paid_at IS NOT NULL
      AND paid_at >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY 1 ORDER BY 1
`;

// =============================================================================
// SYSTEM PROMPT — instruções de raciocínio e estilo
// =============================================================================
const SYSTEM_PROMPT = `Você é o **Assistente BWild**, copiloto de inteligência analítica do portal de gestão de obras.

OBJETIVO PRINCIPAL: responder perguntas sobre dados do sistema (financeiro, compras, cronograma, NCs, pendências, CS, vistorias, equipe) gerando UMA consulta SQL PostgreSQL e interpretando o resultado em português claro, com insights acionáveis.

# RACIOCÍNIO (siga internamente, não exponha)
1. Identifique a INTENÇÃO da pergunta: listar, agregar, comparar, ranquear, distribuir, tendência temporal ou KPI único.
2. Identifique as ENTIDADES (obras, pagamentos, compras, NCs, etc.) e o intervalo de tempo (hoje, semana, mês, intervalo customizado).
3. Escolha a forma analítica mais informativa:
   - Pergunta vaga → traga um agregado + agrupamento por obra ou categoria.
   - Pergunta sobre "atrasos / pendências" → mostre o que está vencido E o quanto.
   - Pergunta de tendência → agrupe por date_trunc('month', ...) ou ('week', ...).
   - Pergunta de comparação → use CASE/SUM ou window functions (RANK/ROW_NUMBER).
4. Sempre que houver valor monetário, traga SUM e quantidade.
5. Sempre que houver "atrasado", traga o número de dias de atraso (CURRENT_DATE - due_date).
6. Sempre faça LEFT JOIN com projects para mostrar o nome da obra quando relevante.

# REGRAS DE SQL (CRÍTICAS — falhar aqui invalida a resposta)
1. Apenas SELECT (ou WITH ... SELECT). Nunca INSERT/UPDATE/DELETE/DDL.
2. Apenas UMA instrução. SEM ponto-e-vírgula final.
3. Use somente tabelas e colunas listadas no CATÁLOGO. Nunca invente colunas.
4. CTEs (WITH) são bem-vindas para análises comparativas e tendências.
5. Para "hoje" use CURRENT_DATE; "esta semana": date_trunc('week', CURRENT_DATE);
   "este mês": date_trunc('month', CURRENT_DATE); "últimos 30 dias": CURRENT_DATE - INTERVAL '30 days'.
6. Para somas/totais use SUM/COUNT/AVG/MIN/MAX. Para agrupar use GROUP BY explícito.
7. Para top-N (top 5, top 10) use ORDER BY + LIMIT. Sem LIMIT manual em outros casos — o sistema aplica 200 linhas automaticamente.
8. Use COALESCE() para lidar com NULL em somas e diferenças.
9. Use NULLS LAST em ORDER BY DESC quando houver colunas potencialmente nulas.
10. RLS já filtra por permissão — NÃO adicione filtros de auth.uid() nem org_id.

# REGRAS DA RESPOSTA (formatador)
- Responda em português brasileiro, tom profissional e direto.
- Comece com a CONCLUSÃO numérica/factual em **negrito** (ex: "**Hoje há 3 compras a pagar, totalizando R$ 12.450,00.**").
- Use tabelas markdown para listas com mais de uma linha.
- Formate moeda como R$ 1.234,56 e datas como DD/MM/AAAA. Percentuais com 1 casa.
- Se o resultado vier vazio, diga isso claramente e sugira variações de pergunta.
- Nunca invente dados; só relate o que veio do SQL.
- INSIGHTS: sempre que possível, destaque concentração ("Obra X representa 62% do total"),
  variação ("aumento de 18% vs mês anterior") ou anomalia ("3 NCs críticas vencem em 7 dias").
- SUGESTÕES DE FOLLOW-UP: ao final, sugira 2-3 perguntas relacionadas naturalmente.

VOCÊ DEVE OBRIGATORIAMENTE chamar a função generate_query exatamente uma vez por pergunta.`;

// =============================================================================
// TOOL SCHEMA — captura mais semântica para o pipeline de análise
// =============================================================================
const TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'generate_query',
    description:
      'Gera a consulta SQL e os metadados analíticos para responder à pergunta do usuário.',
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Consulta SELECT/WITH em PostgreSQL. UMA instrução, sem ponto-e-vírgula.',
        },
        domain: {
          type: 'string',
          enum: [
            'financeiro',
            'compras',
            'cronograma',
            'ncs',
            'pendencias',
            'cs',
            'vistorias',
            'equipe',
            'formalizacoes',
            'outros',
          ],
          description: 'Domínio principal da pergunta.',
        },
        intent: {
          type: 'string',
          description:
            'Resumo curto (1 frase) do que será consultado, em pt-BR. Ex: "Total de pagamentos atrasados por obra".',
        },
        analysis_type: {
          type: 'string',
          enum: ['list', 'aggregate', 'kpi', 'trend', 'comparison', 'distribution', 'ranking'],
          description:
            'Forma analítica esperada. Determina a melhor visualização do resultado.',
        },
        chart_hint: {
          type: 'string',
          enum: ['none', 'bar', 'line', 'pie', 'kpi'],
          description:
            'Sugestão de visualização: bar para comparações/ranking, line para tendência, pie para distribuição, kpi para um único número, none para listas detalhadas.',
        },
        key_columns: {
          type: 'object',
          description:
            'Colunas que o front pode usar para visualização: { label: nome, value: nome, secondary?: nome }.',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
            secondary: { type: 'string' },
          },
        },
      },
      required: ['sql', 'domain', 'intent', 'analysis_type', 'chart_hint'],
      additionalProperties: false,
    },
  },
};

// =============================================================================
// FERRAMENTAS DE ANÁLISE NUMÉRICA (server-side, sem LLM)
// =============================================================================
type Row = Record<string, unknown>;

interface NumericStats {
  column: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

interface DataSummary {
  total_rows: number;
  numeric: NumericStats[];
  top_categories?: { column: string; values: { key: string; count: number; pct: number }[] };
  date_range?: { column: string; from: string; to: string };
}

function looksNumeric(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) && v.trim() !== '';
  }
  return false;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looksDate(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  // Aceita ISO date ou timestamp
  return /^\d{4}-\d{2}-\d{2}/.test(v);
}

/**
 * Resume os dados retornados antes do formatador. Identifica colunas numéricas,
 * top categorias para colunas string e amplitude de datas. Permite que o LLM
 * receba contexto agregado sem precisar reler todas as linhas.
 */
function summarizeRows(rows: Row[]): DataSummary {
  const summary: DataSummary = {
    total_rows: rows.length,
    numeric: [],
  };
  if (rows.length === 0) return summary;

  const sample = rows[0];
  const columns = Object.keys(sample);

  for (const col of columns) {
    let allNumeric = true;
    let allDate = true;
    let stringCount = 0;
    const numericValues: number[] = [];
    const dateValues: string[] = [];
    const stringFreq: Map<string, number> = new Map();

    for (const r of rows) {
      const v = r[col];
      if (v === null || v === undefined) continue;
      if (looksNumeric(v)) {
        numericValues.push(asNumber(v) as number);
      } else {
        allNumeric = false;
      }
      if (looksDate(v)) {
        dateValues.push(v as string);
      } else {
        allDate = false;
      }
      if (typeof v === 'string') {
        stringCount += 1;
        stringFreq.set(v, (stringFreq.get(v) ?? 0) + 1);
      }
    }

    // Coluna numérica relevante: ignora ids parecendo uuid/inteiros sequenciais com
    // nomes terminando em _id
    const isIdLike =
      /(^id$|_id$|number$|sort_order)/.test(col) ||
      (numericValues.length && numericValues.every((n) => Number.isInteger(n) && n < 1000 && col.includes('order')));
    if (allNumeric && numericValues.length > 0 && !isIdLike) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      summary.numeric.push({
        column: col,
        count: numericValues.length,
        sum,
        avg: sum / numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
      });
    }

    if (allDate && dateValues.length > 0 && !summary.date_range) {
      dateValues.sort();
      summary.date_range = {
        column: col,
        from: dateValues[0],
        to: dateValues[dateValues.length - 1],
      };
    }

    // Top categorias para a primeira coluna textual com baixa cardinalidade
    if (
      !summary.top_categories &&
      stringCount > 0 &&
      stringFreq.size <= Math.max(10, Math.ceil(rows.length / 3)) &&
      stringFreq.size > 1
    ) {
      const entries = Array.from(stringFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      summary.top_categories = {
        column: col,
        values: entries.map(([key, count]) => ({
          key,
          count,
          pct: Math.round((count / rows.length) * 1000) / 10,
        })),
      };
    }
  }
  return summary;
}

// =============================================================================
// SSE helpers
// =============================================================================
const sseHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// =============================================================================
// Formatter prompts
// =============================================================================
function buildFormatterMessages(opts: {
  question: string;
  domain: string | null;
  intent: string | null;
  analysisType: string | null;
  chartHint: string | null;
  rows: Row[];
  rowsReturned: number;
  summary: DataSummary;
}) {
  const {
    question,
    domain,
    intent,
    analysisType,
    chartHint,
    rows,
    rowsReturned,
    summary,
  } = opts;

  const sample = rows.slice(0, 50);

  const system = `Você é o formatador analítico do Assistente BWild. Receba uma pergunta, dados (JSON) de uma consulta SQL e um resumo numérico pré-calculado. Produza uma resposta em PT-BR markdown com a seguinte estrutura:

1. **Conclusão direta** (primeira linha em negrito, com o número/fato principal).
2. **Detalhes**: tabela markdown se houver mais de uma linha; lista curta caso contrário.
3. **Insights** (seção "**Insights**"): 1 a 3 bullets que destaquem concentração, variação, anomalias ou recomendações. Use os dados do resumo numérico.
4. **Sugestões** (seção "**Perguntas relacionadas**"): exatamente 3 sugestões de follow-up plausíveis em formato de bullet. Devem ser perguntas curtas, naturais e específicas ao domínio.

Regras:
- Formate moeda como R$ 1.234,56 e datas como DD/MM/AAAA.
- Percentuais com 1 casa decimal.
- NUNCA invente dados; só use o que está no JSON ou no resumo.
- Se vier vazio, diga isso e proponha 3 variações da pergunta como sugestões.`;

  const user = `Pergunta original: ${question}

Domínio: ${domain ?? 'outros'}
Intenção interpretada: ${intent ?? '-'}
Tipo de análise: ${analysisType ?? '-'}
Visualização sugerida: ${chartHint ?? '-'}

Resumo numérico calculado pelo sistema:
${JSON.stringify(summary, null, 2)}

Total de linhas retornadas: ${rowsReturned}
Amostra (até 50 linhas):
${JSON.stringify(sample)}

Produza a resposta final.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// =============================================================================
// Handler
// =============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  let body: { question?: string; conversation_id?: string | null; stream?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body JSON inválido' }, 400);
  }

  const wantsStream = body.stream !== false; // default ON
  const question = (body.question ?? '').toString().trim();
  let conversationId: string | null = body.conversation_id ?? null;

  if (!question) return jsonResponse({ error: 'Pergunta vazia' }, 400);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  if (!LOVABLE_API_KEY) {
    return jsonResponse({ error: 'LOVABLE_API_KEY não configurada' }, 500);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: 'Não autenticado' }, 401);
  }
  const userId = userData.user.id;

  if (!wantsStream) {
    return await runNonStreaming({ supabase, userId, question, conversationId });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(sseEvent(event, data)));
        } catch (_) {
          /* connection closed */
        }
      };

      const startedAt = Date.now();
      let generatedSql: string | null = null;
      let domain: string | null = null;
      let intent: string | null = null;
      let analysisType: string | null = null;
      let chartHint: string | null = null;
      let keyColumns: Record<string, string> | null = null;
      let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' =
        'success';
      let errorMessage: string | null = null;
      let rowsReturned = 0;
      let tokensIn = 0;
      let tokensOut = 0;
      let finalAnswer = '';
      let rows: Row[] = [];
      let summary: DataSummary = { total_rows: 0, numeric: [] };
      let logId: string | null = null;

      try {
        // 1) Cria conversa se nova
        if (!conversationId) {
          const { data: conv, error: convErr } = await supabase
            .from('assistant_conversations')
            .insert({ user_id: userId, title: question.slice(0, 60) })
            .select('id')
            .single();
          if (convErr) throw new Error('Falha ao criar conversa: ' + convErr.message);
          conversationId = conv.id;
        }
        send('conversation', { conversation_id: conversationId });

        await supabase.from('assistant_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: question,
        });

        send('status', { phase: 'thinking', message: 'Interpretando pergunta...' });

        const { data: history } = await supabase
          .from('assistant_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10);

        const llmMessages = [
          { role: 'system', content: SYSTEM_PROMPT + '\n\n' + SCHEMA_CATALOG },
          ...(history ?? []).map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        ];

        const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: llmMessages,
            tools: [TOOL_SCHEMA],
            tool_choice: { type: 'function', function: { name: 'generate_query' } },
          }),
        });

        if (llmResp.status === 429) {
          status = 'llm_error';
          errorMessage = 'Limite de requisições atingido';
          send('error', { message: 'Muitas requisições. Tente novamente em instantes.', status });
          return;
        }
        if (llmResp.status === 402) {
          status = 'llm_error';
          errorMessage = 'Créditos esgotados';
          send('error', {
            message: 'Créditos do assistente esgotados. Adicione créditos na sua workspace.',
            status,
          });
          return;
        }
        if (!llmResp.ok) {
          status = 'llm_error';
          const t = await llmResp.text();
          errorMessage = `LLM ${llmResp.status}: ${t.slice(0, 200)}`;
          send('error', { message: errorMessage, status });
          return;
        }

        const llmData = await llmResp.json();
        tokensIn += llmData?.usage?.prompt_tokens ?? 0;
        tokensOut += llmData?.usage?.completion_tokens ?? 0;

        const toolCall = llmData?.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          status = 'llm_error';
          errorMessage = 'Modelo não retornou consulta';
          send('error', { message: errorMessage, status });
          return;
        }
        const args = JSON.parse(toolCall.function.arguments);
        generatedSql = (args.sql ?? '').toString();
        domain = (args.domain ?? 'outros').toString();
        intent = (args.intent ?? null)?.toString() ?? null;
        analysisType = (args.analysis_type ?? null)?.toString() ?? null;
        chartHint = (args.chart_hint ?? null)?.toString() ?? null;
        keyColumns =
          args.key_columns && typeof args.key_columns === 'object' ? args.key_columns : null;

        send('sql', {
          sql: generatedSql,
          domain,
          intent,
          analysis_type: analysisType,
          chart_hint: chartHint,
          key_columns: keyColumns,
        });
        send('status', { phase: 'querying', message: 'Consultando banco de dados...' });

        // 2) Executa SQL
        const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_assistant_query', {
          p_sql: generatedSql,
        });

        if (rpcErr) {
          const msg = (rpcErr.message || '').toLowerCase();
          if (
            msg.includes('proibido') ||
            msg.includes('apenas') ||
            msg.includes('multiplas') ||
            msg.includes('blocos') ||
            msg.includes('esquemas')
          )
            status = 'sql_blocked';
          else if (msg.includes('timeout') || msg.includes('canceling statement'))
            status = 'timeout';
          else status = 'sql_error';
          errorMessage = rpcErr.message;
        } else {
          rows = Array.isArray(rpcData) ? (rpcData as Row[]) : [];
          rowsReturned = rows.length;
          summary = summarizeRows(rows);
        }

        send('rows', {
          rows_returned: rowsReturned,
          preview: rows.slice(0, 50),
          summary,
        });

        // 3) Streaming da resposta final
        if (status !== 'success') {
          finalAnswer = `Não consegui executar a consulta. ${
            status === 'sql_blocked'
              ? 'A pergunta foi traduzida em uma operação não permitida.'
              : status === 'timeout'
              ? 'A consulta demorou demais. Tente refinar com filtros (ex: período).'
              : 'Tente reformular a pergunta de outra maneira.'
          }`;
          send('delta', { content: finalAnswer });
        } else {
          send('status', { phase: 'analyzing', message: 'Analisando resultados...' });

          const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: MODEL,
              stream: true,
              messages: buildFormatterMessages({
                question,
                domain,
                intent,
                analysisType,
                chartHint,
                rows,
                rowsReturned,
                summary,
              }),
            }),
          });

          if (!formatResp.ok || !formatResp.body) {
            const t = await formatResp.text().catch(() => '');
            finalAnswer = `Encontrei ${rowsReturned} resultado(s), mas falhei ao formatar: ${t.slice(0, 100)}`;
            send('delta', { content: finalAnswer });
          } else {
            const reader = formatResp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n');
              buffer = parts.pop() ?? '';
              for (const line of parts) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                  const json = JSON.parse(payload);
                  const delta = json?.choices?.[0]?.delta?.content;
                  if (delta) {
                    finalAnswer += delta;
                    send('delta', { content: delta });
                  }
                  const usage = json?.usage;
                  if (usage) {
                    tokensIn += usage.prompt_tokens ?? 0;
                    tokensOut += usage.completion_tokens ?? 0;
                  }
                } catch (_) {
                  /* ignore parse errors mid-buffer */
                }
              }
            }
            if (!finalAnswer) finalAnswer = `Consulta retornou ${rowsReturned} linha(s).`;
          }
        }

        // 4) Persiste log e mensagem
        const { data: logRow } = await supabase
          .from('assistant_logs')
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            question,
            generated_sql: generatedSql,
            domain,
            rows_returned: rowsReturned,
            latency_ms: Date.now() - startedAt,
            tokens_input: tokensIn,
            tokens_output: tokensOut,
            model: MODEL,
            status,
            error_message: errorMessage,
            answer_summary: finalAnswer.slice(0, 280),
          })
          .select('id')
          .single();
        logId = logRow?.id ?? null;

        await supabase.from('assistant_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: finalAnswer,
          result_data: {
            rows: rows.slice(0, 50),
            rows_returned: rowsReturned,
            sql: generatedSql,
            domain,
            intent,
            analysis_type: analysisType,
            chart_hint: chartHint,
            key_columns: keyColumns,
            summary,
            status,
          },
          log_id: logId,
        });

        await supabase
          .from('assistant_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        send('done', {
          conversation_id: conversationId,
          answer: finalAnswer,
          rows: rows.slice(0, 50),
          rows_returned: rowsReturned,
          sql: generatedSql,
          domain,
          intent,
          analysis_type: analysisType,
          chart_hint: chartHint,
          key_columns: keyColumns,
          summary,
          status,
          log_id: logId,
          latency_ms: Date.now() - startedAt,
        });
      } catch (e) {
        console.error('[assistant-chat stream] error:', e);
        const message = e instanceof Error ? e.message : String(e);
        send('error', { message, status: 'other' });
        try {
          await supabase.from('assistant_logs').insert({
            user_id: userId,
            conversation_id: conversationId,
            question,
            generated_sql: generatedSql,
            domain,
            rows_returned: 0,
            latency_ms: Date.now() - startedAt,
            tokens_input: tokensIn,
            tokens_output: tokensOut,
            model: MODEL,
            status: 'other',
            error_message: message,
          });
        } catch (_) {
          /* swallow */
        }
      } finally {
        try {
          controller.close();
        } catch (_) {
          /* ignore */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
});

// ============================================================
// Modo legado não-streaming (mantém compatibilidade com testes)
// ============================================================
async function runNonStreaming(opts: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  question: string;
  conversationId: string | null;
}): Promise<Response> {
  const { supabase, userId, question } = opts;
  let { conversationId } = opts;
  const startedAt = Date.now();
  let generatedSql: string | null = null;
  let domain: string | null = null;
  let intent: string | null = null;
  let analysisType: string | null = null;
  let chartHint: string | null = null;
  let keyColumns: Record<string, string> | null = null;
  let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' =
    'success';
  let errorMessage: string | null = null;
  let rowsReturned = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let finalAnswer = '';
  let rows: Row[] = [];
  let summary: DataSummary = { total_rows: 0, numeric: [] };

  try {
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabase
        .from('assistant_conversations')
        .insert({ user_id: userId, title: question.slice(0, 60) })
        .select('id')
        .single();
      if (convErr) throw new Error('Falha ao criar conversa: ' + convErr.message);
      conversationId = conv.id;
    }

    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: question,
    });

    const { data: history } = await supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + '\n\n' + SCHEMA_CATALOG },
          ...(history ?? []).map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: 'function', function: { name: 'generate_query' } },
      }),
    });

    if (!llmResp.ok) {
      const t = await llmResp.text();
      return jsonResponse(
        { error: `LLM ${llmResp.status}: ${t.slice(0, 200)}`, status: 'llm_error' },
        502,
      );
    }
    const llmData = await llmResp.json();
    tokensIn += llmData?.usage?.prompt_tokens ?? 0;
    tokensOut += llmData?.usage?.completion_tokens ?? 0;
    const toolCall = llmData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error('Modelo não retornou consulta');
    const args = JSON.parse(toolCall.function.arguments);
    generatedSql = (args.sql ?? '').toString();
    domain = (args.domain ?? 'outros').toString();
    intent = (args.intent ?? null)?.toString() ?? null;
    analysisType = (args.analysis_type ?? null)?.toString() ?? null;
    chartHint = (args.chart_hint ?? null)?.toString() ?? null;
    keyColumns = args.key_columns && typeof args.key_columns === 'object' ? args.key_columns : null;

    const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_assistant_query', {
      p_sql: generatedSql,
    });
    if (rpcErr) {
      const msg = (rpcErr.message || '').toLowerCase();
      if (msg.includes('proibido') || msg.includes('apenas')) status = 'sql_blocked';
      else if (msg.includes('timeout')) status = 'timeout';
      else status = 'sql_error';
      errorMessage = rpcErr.message;
    } else {
      rows = Array.isArray(rpcData) ? (rpcData as Row[]) : [];
      rowsReturned = rows.length;
      summary = summarizeRows(rows);
    }

    if (status !== 'success') {
      finalAnswer = 'Não consegui executar a consulta. Tente reformular.';
    } else {
      const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: buildFormatterMessages({
            question,
            domain,
            intent,
            analysisType,
            chartHint,
            rows,
            rowsReturned,
            summary,
          }),
        }),
      });
      const fd = await formatResp.json();
      tokensIn += fd?.usage?.prompt_tokens ?? 0;
      tokensOut += fd?.usage?.completion_tokens ?? 0;
      finalAnswer =
        fd?.choices?.[0]?.message?.content ?? `Consulta retornou ${rowsReturned} linha(s).`;
    }

    const { data: logRow } = await supabase
      .from('assistant_logs')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        question,
        generated_sql: generatedSql,
        domain,
        rows_returned: rowsReturned,
        latency_ms: Date.now() - startedAt,
        tokens_input: tokensIn,
        tokens_output: tokensOut,
        model: MODEL,
        status,
        error_message: errorMessage,
        answer_summary: finalAnswer.slice(0, 280),
      })
      .select('id')
      .single();

    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content: finalAnswer,
      result_data: {
        rows: rows.slice(0, 50),
        rows_returned: rowsReturned,
        sql: generatedSql,
        domain,
        intent,
        analysis_type: analysisType,
        chart_hint: chartHint,
        key_columns: keyColumns,
        summary,
        status,
      },
      log_id: logRow?.id ?? null,
    });

    await supabase
      .from('assistant_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return jsonResponse({
      conversation_id: conversationId,
      answer: finalAnswer,
      rows: rows.slice(0, 50),
      rows_returned: rowsReturned,
      sql: generatedSql,
      domain,
      intent,
      analysis_type: analysisType,
      chart_hint: chartHint,
      key_columns: keyColumns,
      summary,
      status,
      log_id: logRow?.id ?? null,
      latency_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: message, status: 'other' }, 500);
  }
}
