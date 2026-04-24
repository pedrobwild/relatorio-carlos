import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, corsResponse, jsonResponse } from '../_shared/cors.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

// Catálogo curado: só o que o assistente pode "ver".
const SCHEMA_CATALOG = `
# CATÁLOGO DE TABELAS DISPONÍVEIS (apenas leitura, RLS aplicada automaticamente)

## projects (obras)
- id uuid, name text, status text, org_id uuid, created_by uuid
- start_date date, end_date date, budget_total numeric
- is_project_phase boolean

## project_payments (parcelas/pagamentos)
- id uuid, project_id uuid, installment_number int
- description text, amount numeric, due_date date, paid_at timestamptz
- payment_method text, boleto_code text, boleto_path text, pix_key text
- payment_proof_path text, notification_sent_at timestamptz
- IMPORTANTE: NÃO existe coluna 'status'. Derive o status assim:
    * 'paid' quando paid_at IS NOT NULL
    * 'overdue' quando paid_at IS NULL AND due_date < CURRENT_DATE
    * 'pending' quando paid_at IS NULL AND due_date >= CURRENT_DATE
  Exemplo: CASE WHEN paid_at IS NOT NULL THEN 'paid' WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END AS status

## project_purchases (compras de produtos e prestadores)
- id uuid, project_id uuid, item_name text, description text
- quantity numeric, unit text, estimated_cost numeric, actual_cost numeric
- category text, supplier_name text, fornecedor_id uuid
- required_by_date date, lead_time_days int
- status text  -- 'pending' | 'ordered' | 'delivered' | 'cancelled'
- purchase_type text  -- 'produto' | 'prestador'
- scheduled_start date, scheduled_end date

## fornecedores
- id uuid, nome text, categoria text, telefone text, email text
- supplier_type text  -- 'prestadores' | 'produtos'
- status text, nota_avaliacao numeric

## project_activities (cronograma)
- id uuid, project_id uuid, description text, etapa text
- planned_start date, planned_end date, actual_start date, actual_end date
- weight numeric, sort_order int, progress_pct numeric
- responsavel_user_id uuid

## non_conformities (NCs)
- id uuid, project_id uuid, title text, description text
- status text  -- 'open'|'in_treatment'|'pending_verification'|'pending_approval'|'closed'|'reopened'
- severity text, category text, deadline date
- responsible_user_id uuid, created_by uuid

## pending_items (pendências do cliente)
- id uuid, project_id uuid, title text, description text
- type text, status text  -- 'pending' | 'completed'
- due_date date, amount numeric

## cs_tickets (atendimento)
- id uuid, project_id uuid, situation text, description text
- status text, severity text, responsible_user_id uuid
- created_at timestamptz, resolved_at timestamptz

## users_profile
- id uuid, nome text, email text, perfil text, status text
`;

const SYSTEM_PROMPT = `Você é o Assistente BWild, um copiloto especializado no portal de gestão de obras.

OBJETIVO: responder perguntas sobre dados do sistema (financeiro, compras, cronograma, NCs, pendências, CS) gerando UMA consulta SQL PostgreSQL e interpretando o resultado em português claro.

REGRAS DE SQL (CRÍTICAS):
1. Apenas SELECT (ou WITH ... SELECT). Nunca INSERT/UPDATE/DELETE/DDL.
2. Apenas UMA instrução, sem ponto-e-vírgula no final.
3. Use somente tabelas e colunas listadas no CATÁLOGO. Nunca invente colunas.
4. Sempre filtre por datas/condições relevantes (ex: due_date = CURRENT_DATE).
5. Use LEFT JOIN com projects para mostrar o nome da obra quando útil.
6. Para "hoje" use CURRENT_DATE. Para "esta semana" use date_trunc('week', CURRENT_DATE).
7. Sempre ordene de forma lógica (vencimento ASC, criação DESC, etc.).
8. Limite implícito de 200 linhas é aplicado automaticamente — não adicione LIMIT manualmente a menos que o usuário peça top N.
9. Para somas/totais use SUM(), COUNT(). Para agrupar use GROUP BY.

REGRAS DE RESPOSTA:
- Responda em português brasileiro, tom profissional e direto.
- Comece com a resposta numérica/factual ("Hoje há 3 compras a pagar, totalizando R$ 12.450,00").
- Use markdown: tabelas para listas, **negrito** para destaques.
- Formate moeda como R$ 1.234,56 e datas como DD/MM/AAAA.
- Se o resultado vier vazio, diga isso claramente e sugira variações.
- Nunca invente dados; só relate o que veio do SQL.

A RLS do banco já filtra automaticamente o que o usuário pode ver — você não precisa adicionar filtros de permissão.

VOCÊ DEVE OBRIGATORIAMENTE chamar a função generate_query exatamente uma vez por pergunta.`;

const TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'generate_query',
    description: 'Gera a consulta SQL e o domínio para responder à pergunta do usuário.',
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Consulta SELECT/WITH em PostgreSQL. UMA instrução, sem ponto-e-vírgula.' },
        domain: {
          type: 'string',
          enum: ['financeiro', 'compras', 'cronograma', 'ncs', 'pendencias', 'cs', 'outros'],
          description: 'Domínio principal da pergunta.',
        },
        intent: { type: 'string', description: 'Resumo curto do que será consultado.' },
      },
      required: ['sql', 'domain', 'intent'],
      additionalProperties: false,
    },
  },
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // Preserva contrato: aceita JSON body
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

  // Fallback não-streaming: caminho legado (mantém compatibilidade com testes)
  if (!wantsStream) {
    return await runNonStreaming({ supabase, userId, question, conversationId });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(sseEvent(event, data)));
        } catch (_) { /* connection closed */ }
      };

      const startedAt = Date.now();
      let generatedSql: string | null = null;
      let domain: string | null = null;
      let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' = 'success';
      let errorMessage: string | null = null;
      let rowsReturned = 0;
      let tokensIn = 0;
      let tokensOut = 0;
      let finalAnswer = '';
      let rows: Record<string, unknown>[] = [];
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

        // Salva mensagem do usuário
        await supabase.from('assistant_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: question,
        });

        send('status', { phase: 'thinking', message: 'Interpretando pergunta...' });

        // Histórico
        const { data: history } = await supabase
          .from('assistant_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10);

        // 2) Tool call para gerar SQL (não-stream — precisamos do JSON completo)
        const llmMessages = [
          { role: 'system', content: SYSTEM_PROMPT + '\n\n' + SCHEMA_CATALOG },
          ...(history ?? []).map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        ];

        const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
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
          send('error', { message: 'Créditos do assistente esgotados. Adicione créditos na sua workspace.', status });
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

        send('sql', { sql: generatedSql, domain });
        send('status', { phase: 'querying', message: 'Consultando banco de dados...' });

        // 3) Executa SQL
        const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_assistant_query', {
          p_sql: generatedSql,
        });

        if (rpcErr) {
          const msg = (rpcErr.message || '').toLowerCase();
          if (msg.includes('proibido') || msg.includes('apenas') || msg.includes('multiplas') || msg.includes('blocos') || msg.includes('esquemas')) status = 'sql_blocked';
          else if (msg.includes('timeout') || msg.includes('canceling statement')) status = 'timeout';
          else status = 'sql_error';
          errorMessage = rpcErr.message;
        } else {
          rows = Array.isArray(rpcData) ? (rpcData as Record<string, unknown>[]) : [];
          rowsReturned = rows.length;
        }

        send('rows', { rows_returned: rowsReturned, preview: rows.slice(0, 50) });

        // 4) Streaming da resposta final
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
          send('status', { phase: 'formatting', message: 'Formatando resposta...' });

          const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: MODEL,
              stream: true,
              messages: [
                {
                  role: 'system',
                  content:
                    'Você é o Assistente BWild. Receba a pergunta original e os dados (JSON) retornados de uma consulta SQL. Responda em português brasileiro, com markdown, formatando moedas como R$ 1.234,56 e datas como DD/MM/AAAA. Comece pela resposta direta. Use tabela markdown se houver mais de uma linha. Se vier vazio, diga claramente. Nunca invente dados.',
                },
                {
                  role: 'user',
                  content: `Pergunta: ${question}\n\nDomínio: ${domain}\n\nDados (até 200 linhas):\n${JSON.stringify(
                    rows.slice(0, 50)
                  )}\n\nTotal de linhas retornadas: ${rowsReturned}`,
                },
              ],
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
                } catch (_) { /* ignore parse errors mid-buffer */ }
              }
            }
            if (!finalAnswer) finalAnswer = `Consulta retornou ${rowsReturned} linha(s).`;
          }
        }

        // 5) Persiste log e mensagem
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
          result_data: { rows: rows.slice(0, 50), rows_returned: rowsReturned, sql: generatedSql, domain, status },
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
          status,
          log_id: logId,
          latency_ms: Date.now() - startedAt,
        });
      } catch (e) {
        console.error('[assistant-chat stream] error:', e);
        const message = e instanceof Error ? e.message : String(e);
        send('error', { message, status: 'other' });
        // Tentativa de log
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
        } catch (_) { /* swallow */ }
      } finally {
        try { controller.close(); } catch (_) { /* ignore */ }
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
  let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' = 'success';
  let errorMessage: string | null = null;
  let rowsReturned = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let finalAnswer = '';
  let rows: Record<string, unknown>[] = [];

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
      conversation_id: conversationId, user_id: userId, role: 'user', content: question,
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
            role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content,
          })),
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: 'function', function: { name: 'generate_query' } },
      }),
    });

    if (!llmResp.ok) {
      const t = await llmResp.text();
      return jsonResponse({ error: `LLM ${llmResp.status}: ${t.slice(0, 200)}`, status: 'llm_error' }, 502);
    }
    const llmData = await llmResp.json();
    tokensIn += llmData?.usage?.prompt_tokens ?? 0;
    tokensOut += llmData?.usage?.completion_tokens ?? 0;
    const toolCall = llmData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error('Modelo não retornou consulta');
    const args = JSON.parse(toolCall.function.arguments);
    generatedSql = (args.sql ?? '').toString();
    domain = (args.domain ?? 'outros').toString();

    const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_assistant_query', { p_sql: generatedSql });
    if (rpcErr) {
      const msg = (rpcErr.message || '').toLowerCase();
      if (msg.includes('proibido') || msg.includes('apenas')) status = 'sql_blocked';
      else if (msg.includes('timeout')) status = 'timeout';
      else status = 'sql_error';
      errorMessage = rpcErr.message;
    } else {
      rows = Array.isArray(rpcData) ? (rpcData as Record<string, unknown>[]) : [];
      rowsReturned = rows.length;
    }

    if (status !== 'success') {
      finalAnswer = 'Não consegui executar a consulta. Tente reformular.';
    } else {
      const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: 'Responda em PT-BR markdown a partir do JSON.' },
            { role: 'user', content: `Pergunta: ${question}\nDados: ${JSON.stringify(rows.slice(0, 50))}` },
          ],
        }),
      });
      const fd = await formatResp.json();
      tokensIn += fd?.usage?.prompt_tokens ?? 0;
      tokensOut += fd?.usage?.completion_tokens ?? 0;
      finalAnswer = fd?.choices?.[0]?.message?.content ?? `Consulta retornou ${rowsReturned} linha(s).`;
    }

    const { data: logRow } = await supabase
      .from('assistant_logs')
      .insert({
        user_id: userId, conversation_id: conversationId, question,
        generated_sql: generatedSql, domain, rows_returned: rowsReturned,
        latency_ms: Date.now() - startedAt, tokens_input: tokensIn, tokens_output: tokensOut,
        model: MODEL, status, error_message: errorMessage, answer_summary: finalAnswer.slice(0, 280),
      })
      .select('id')
      .single();

    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId, user_id: userId, role: 'assistant',
      content: finalAnswer,
      result_data: { rows: rows.slice(0, 50), rows_returned: rowsReturned, sql: generatedSql, domain, status },
      log_id: logRow?.id ?? null,
    });

    await supabase.from('assistant_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);

    return jsonResponse({
      conversation_id: conversationId, answer: finalAnswer,
      rows: rows.slice(0, 50), rows_returned: rowsReturned,
      sql: generatedSql, domain, status, log_id: logRow?.id ?? null,
      latency_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: message, status: 'other' }, 500);
  }
}
