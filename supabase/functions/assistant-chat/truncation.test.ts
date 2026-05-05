/**
 * Testes de integração para a detecção de truncamento usada pelo
 * `assistant-chat`. Simulam streams SSE incompletos (mesmo loop que o handler
 * real usa para consumir o LLM) e validam que:
 *  - `detectTruncation` produz `truncated` + `truncation_reason` corretos;
 *  - os campos persistidos em `assistant_logs` (`answer_length`,
 *    `finish_reason`, `truncated`, `truncation_reason`) refletem o conteúdo
 *    efetivamente acumulado a partir do stream incompleto.
 */
import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { detectTruncation } from '../_shared/truncationDetector.ts';

// ---------------------------------------------------------------------------
// Helper: replica o loop de parsing do handler (linhas ~693-748 de index.ts)
// para alimentar finalAnswer/finishReason a partir de chunks arbitrários.
// ---------------------------------------------------------------------------
function makeOpenAIChunk(delta: string, finish?: string): string {
  return `data: ${JSON.stringify({
    choices: [{ delta: delta ? { content: delta } : {}, finish_reason: finish ?? null }],
  })}\n\n`;
}

async function consumeStream(chunks: string[]): Promise<{
  finalAnswer: string;
  finishReason: string | null;
}> {
  let finalAnswer = '';
  let finishReason: string | null = null;
  let buffer = '';

  const processLine = (line: string) => {
    let trimmed = line;
    if (trimmed.endsWith('\r')) trimmed = trimmed.slice(0, -1);
    trimmed = trimmed.trim();
    if (!trimmed || trimmed.startsWith(':')) return;
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const json = JSON.parse(payload);
      const delta = json?.choices?.[0]?.delta?.content;
      if (delta) finalAnswer += delta;
      const fr = json?.choices?.[0]?.finish_reason;
      if (fr) finishReason = fr;
    } catch { /* ignora */ }
  };

  // Cria um ReadableStream a partir dos chunks (cada chunk pode quebrar SSE no meio)
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIdx: number;
    while ((nlIdx = buffer.indexOf('\n')) !== -1) {
      processLine(buffer.slice(0, nlIdx));
      buffer = buffer.slice(nlIdx + 1);
    }
  }
  // Final flush — exatamente como o handler faz
  buffer += decoder.decode();
  if (buffer.length > 0) {
    const tail = buffer.trim();
    if (tail.startsWith('data:') || tail.includes('\ndata:')) {
      for (const line of buffer.split('\n')) processLine(line);
    }
  }

  return { finalAnswer, finishReason };
}

// Simula a montagem do payload que vai pro `assistant_logs.insert(...)`
function buildLogPayload(args: { status: string; finalAnswer: string; finishReason: string | null }) {
  const det = detectTruncation(args);
  return {
    answer_length: det.answerLength,
    finish_reason: args.finishReason,
    truncated: det.truncated,
    truncation_reason: det.truncationReason,
    answer_summary: args.finalAnswer.slice(0, 280),
  };
}

// ===========================================================================
// 1. finish_reason='length' vindo do LLM marca truncated=true
// ===========================================================================
Deno.test('integration: stream com finish_reason=length é detectado como truncado', async () => {
  const chunks = [
    makeOpenAIChunk('Aqui está uma análise detalhada das obras ativas no portfólio'),
    makeOpenAIChunk(' incluindo prazos, custos e responsáveis técnicos atribuídos a cada uma'),
    makeOpenAIChunk('', 'length'),
  ];
  const { finalAnswer, finishReason } = await consumeStream(chunks);
  const payload = buildLogPayload({ status: 'success', finalAnswer, finishReason });

  assertEquals(finishReason, 'length');
  assertEquals(payload.truncated, true);
  assertEquals(payload.truncation_reason, 'finish_reason=length');
  assertEquals(payload.answer_length, finalAnswer.length);
  assert(payload.answer_length > 60);
});

// ===========================================================================
// 2. Stream cortado no meio (sem \n\n final) com code fence aberto
// ===========================================================================
Deno.test('integration: stream incompleto com code fence aberto -> unclosed_code_fence', async () => {
  // Último chunk SEM \n\n final (simula conexão caindo) e SEM finish_reason
  const partial =
    'data: ' +
    JSON.stringify({ choices: [{ delta: { content: 'Veja o SQL gerado:\n```sql\nSELECT * FROM projects' }, finish_reason: null }] });
  const chunks = [
    makeOpenAIChunk('Aqui vai o resultado completo da consulta solicitada pelo usuário. '),
    partial, // termina sem \n\n => exercita o final-flush do parser
  ];
  const { finalAnswer, finishReason } = await consumeStream(chunks);
  const payload = buildLogPayload({ status: 'success', finalAnswer, finishReason });

  assertEquals(finishReason, null);
  assert(finalAnswer.includes('```sql'), 'final flush deve ter recuperado o último data:');
  assertEquals(payload.truncated, true);
  assertEquals(payload.truncation_reason, 'unclosed_code_fence');
  assertEquals(payload.answer_length, finalAnswer.length);
});

// ===========================================================================
// 3. Stream cortado sem pontuação terminal -> no_terminal_punctuation
// ===========================================================================
Deno.test('integration: stream longo sem pontuação final -> no_terminal_punctuation', async () => {
  const chunks = [
    makeOpenAIChunk('Encontrei dezenas de obras ativas no portfólio com prazos variando entre'),
    // chunk final sem \n\n e sem finish_reason
    'data: ' + JSON.stringify({ choices: [{ delta: { content: ' 30 e 180 dias úteis dependendo da etapa atual' }, finish_reason: null }] }),
  ];
  const { finalAnswer, finishReason } = await consumeStream(chunks);
  const payload = buildLogPayload({ status: 'success', finalAnswer, finishReason });

  assert(payload.answer_length > 60);
  assertEquals(payload.truncated, true);
  assertEquals(payload.truncation_reason, 'no_terminal_punctuation');
});

// ===========================================================================
// 4. Resposta muito curta -> answer_too_short
// ===========================================================================
Deno.test('integration: resposta muito curta é marcada como truncada', async () => {
  const chunks = [makeOpenAIChunk('OK.', 'stop')];
  const { finalAnswer, finishReason } = await consumeStream(chunks);
  const payload = buildLogPayload({ status: 'success', finalAnswer, finishReason });

  assertEquals(payload.answer_length, 3);
  assertEquals(payload.truncated, true);
  assertEquals(payload.truncation_reason, 'answer_too_short');
});

// ===========================================================================
// 5. Resposta normal completa (não-truncada)
// ===========================================================================
Deno.test('integration: resposta completa com pontuação final NÃO é marcada como truncada', async () => {
  const chunks = [
    makeOpenAIChunk('Existem 12 obras ativas no portfólio neste momento, distribuídas entre 4 gerentes responsáveis.'),
    makeOpenAIChunk('', 'stop'),
  ];
  const { finalAnswer, finishReason } = await consumeStream(chunks);
  const payload = buildLogPayload({ status: 'success', finalAnswer, finishReason });

  assertEquals(finishReason, 'stop');
  assertEquals(payload.truncated, false);
  assertEquals(payload.truncation_reason, null);
  assert(payload.answer_length > 60);
});

// ===========================================================================
// 6. Status != success NUNCA é marcado truncado (ex.: sql_error)
// ===========================================================================
Deno.test('integration: status sql_error não dispara detecção de truncamento', () => {
  const payload = buildLogPayload({
    status: 'sql_error',
    finalAnswer: 'erro',
    finishReason: 'length',
  });
  assertEquals(payload.truncated, false);
  assertEquals(payload.truncation_reason, null);
  assertEquals(payload.answer_length, 4);
});
