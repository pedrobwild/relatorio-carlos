import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, corsResponse, jsonResponse } from '../_shared/cors.ts';
import { renderCatalog } from './_lib/catalog.ts';
import {
  analyzeDataQuality,
  generateInsights,
  recommendVisualizations,
  scoreConfidence,
  suggestFollowUps,
} from './_lib/analysis.ts';
import {
  SYSTEM_PROMPT,
  FORMATTER_SYSTEM_PROMPT,
  buildFormatterUserMessage,
} from './_lib/prompts.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

const SCHEMA_CATALOG = renderCatalog();

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
          enum: ['financeiro', 'compras', 'cronograma', 'ncs', 'pendencias', 'cs', 'obras', 'fornecedores', 'outros'],
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

function buildAnalysis(opts: {
  rows: Record<string, unknown>[];
  rowsReturned: number;
  domain: string;
  sql: string | null;
  status: string;
}) {
  const insights = generateInsights(opts.rows, opts.domain, opts.sql);
  const dataQuality = analyzeDataQuality(opts.rows);
  const visualizations = recommendVisualizations(opts.rows);
  const followUps = suggestFollowUps(opts.domain);
  const confidence = scoreConfidence({
    rowsReturned: opts.rowsReturned,
    hasSql: Boolean(opts.sql),
    domainKnown: opts.domain !== 'outros',
    dataQualityIssues: dataQuality.length,
  });
  const limitations: string[] = [];
  if (opts.rows.length === 0) limitations.push('Nenhum registro retornado.');
  if (opts.rows.length >= 200) limitations.push('Resultado truncado em 200 linhas.');
  if (dataQuality.length > 0) limitations.push('Inconsistências detectadas na qualidade dos dados.');
  return { insights, dataQuality, visualizations, followUps, confidence, limitations };
}

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
        } catch (_) { /* connection closed */ }
      };

      const startedAt = Date.now();
      let generatedSql: string | null = null;
      let domain: string = 'outros';
      let intent: string | null = null;
      let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' = 'success';
      let errorMessage: string | null = null;
      let rowsReturned = 0;
      let tokensIn = 0;
      let tokensOut = 0;
      let finalAnswer = '';
      let rows: Record<string, unknown>[] = [];
      let logId: string | null = null;
      let analysis: ReturnType<typeof buildAnalysis> | null = null;

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
        intent = (args.intent ?? null);

        send('sql', { sql: generatedSql, domain, intent });
        send('status', { phase: 'querying', message: 'Consultando banco de dados...' });

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

        if (status === 'success') {
          analysis = buildAnalysis({ rows, rowsReturned, domain, sql: generatedSql, status });
          send('analysis', {
            insights: analysis.insights,
            data_quality: analysis.dataQuality,
            visualizations: analysis.visualizations,
            suggested_questions: analysis.followUps,
            confidence: analysis.confidence,
            limitations: analysis.limitations,
          });
        }

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

          const formatterUserMessage = buildFormatterUserMessage({
            question,
            domain,
            intent,
            rows,
            rowsReturned,
            analysis: analysis
              ? {
                  confidence: analysis.confidence,
                  insights: analysis.insights,
                  dataQuality: analysis.dataQuality,
                  limitations: analysis.limitations,
                  visualizations: analysis.visualizations,
                }
              : null,
          });

          const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: MODEL,
              stream: true,
              messages: [
                { role: 'system', content: FORMATTER_SYSTEM_PROMPT },
                { role: 'user', content: formatterUserMessage },
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
            status,
            insights: analysis?.insights ?? null,
            data_quality: analysis?.dataQuality ?? null,
            visualizations: analysis?.visualizations ?? null,
            suggested_questions: analysis?.followUps ?? null,
            confidence: analysis?.confidence ?? null,
            limitations: analysis?.limitations ?? null,
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
          status,
          log_id: logId,
          latency_ms: Date.now() - startedAt,
          insights: analysis?.insights ?? null,
          data_quality: analysis?.dataQuality ?? null,
          visualizations: analysis?.visualizations ?? null,
          suggested_questions: analysis?.followUps ?? null,
          confidence: analysis?.confidence ?? null,
          limitations: analysis?.limitations ?? null,
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
  let domain: string = 'outros';
  let intent: string | null = null;
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
    intent = (args.intent ?? null);

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

    let analysis: ReturnType<typeof buildAnalysis> | null = null;
    if (status === 'success') {
      analysis = buildAnalysis({ rows, rowsReturned, domain, sql: generatedSql, status });
    }

    if (status !== 'success') {
      finalAnswer = 'Não consegui executar a consulta. Tente reformular.';
    } else {
      const formatterUserMessage = buildFormatterUserMessage({
        question,
        domain,
        intent,
        rows,
        rowsReturned,
        analysis: analysis
          ? {
              confidence: analysis.confidence,
              insights: analysis.insights,
              dataQuality: analysis.dataQuality,
              limitations: analysis.limitations,
              visualizations: analysis.visualizations,
            }
          : null,
      });

      const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: FORMATTER_SYSTEM_PROMPT },
            { role: 'user', content: formatterUserMessage },
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
      result_data: {
        rows: rows.slice(0, 50),
        rows_returned: rowsReturned,
        sql: generatedSql,
        domain,
        status,
        insights: analysis?.insights ?? null,
        data_quality: analysis?.dataQuality ?? null,
        visualizations: analysis?.visualizations ?? null,
        suggested_questions: analysis?.followUps ?? null,
        confidence: analysis?.confidence ?? null,
        limitations: analysis?.limitations ?? null,
      },
      log_id: logRow?.id ?? null,
    });

    await supabase.from('assistant_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);

    return jsonResponse({
      conversation_id: conversationId, answer: finalAnswer,
      rows: rows.slice(0, 50), rows_returned: rowsReturned,
      sql: generatedSql, domain, intent, status, log_id: logRow?.id ?? null,
      latency_ms: Date.now() - startedAt,
      insights: analysis?.insights ?? null,
      data_quality: analysis?.dataQuality ?? null,
      visualizations: analysis?.visualizations ?? null,
      suggested_questions: analysis?.followUps ?? null,
      confidence: analysis?.confidence ?? null,
      limitations: analysis?.limitations ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: message, status: 'other' }, 500);
  }
}
