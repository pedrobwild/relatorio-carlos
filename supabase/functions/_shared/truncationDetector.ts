/**
 * Heurística compartilhada para detectar respostas truncadas do assistente.
 *
 * Regras (ordem importa para `truncationReason`):
 *  1. finish_reason === 'length'  -> 'finish_reason=length'
 *  2. resposta com 1..39 chars     -> 'answer_too_short'
 *  3. número ímpar de ``` (code fence aberto) -> 'unclosed_code_fence'
 *  4. resposta > 60 chars sem pontuação terminal -> 'no_terminal_punctuation'
 *
 * Apenas avaliamos truncamento quando o status é 'success'.
 */
export interface TruncationInput {
  status: string;
  finalAnswer: string;
  finishReason: string | null | undefined;
}

export interface TruncationResult {
  truncated: boolean;
  truncationReason: string | null;
  answerLength: number;
}

const TERMINAL_CHARS = '.!?)`"\'>]}';

export function detectTruncation(input: TruncationInput): TruncationResult {
  const { status, finalAnswer, finishReason } = input;
  const answerLength = finalAnswer.length;

  if (status !== 'success') {
    return { truncated: false, truncationReason: null, answerLength };
  }

  if (typeof finishReason === 'string' && finishReason === 'length') {
    return { truncated: true, truncationReason: 'finish_reason=length', answerLength };
  }

  if (answerLength > 0 && answerLength < 40) {
    return { truncated: true, truncationReason: 'answer_too_short', answerLength };
  }

  const fenceCount = (finalAnswer.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    return { truncated: true, truncationReason: 'unclosed_code_fence', answerLength };
  }

  const tail = finalAnswer.trimEnd().slice(-1);
  if (answerLength > 60 && tail && !TERMINAL_CHARS.includes(tail)) {
    return { truncated: true, truncationReason: 'no_terminal_punctuation', answerLength };
  }

  return { truncated: false, truncationReason: null, answerLength };
}
