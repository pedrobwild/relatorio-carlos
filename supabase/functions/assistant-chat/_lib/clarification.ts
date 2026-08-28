// Clarificação inteligente (v5).
//
// Detecta perguntas verdadeiramente ambíguas — onde chutar a interpretação
// causaria resposta errada — e devolve 1-3 opções para o usuário escolher.
//
// Filosofia: 90% das perguntas vagas têm um chute óbvio (e o Planner
// resolve com `assumptions`). Só interrompemos para perguntar quando:
//   1. Existem >=2 interpretações válidas com resultados materialmente diferentes.
//   2. A pergunta cita entidade ambígua (nome de obra parcial que casa com várias).
//   3. Janela temporal indeterminada num tema sensível ("o quanto a gente faturou?" sem ano).

export interface ClarificationOption {
  label: string;
  /** Pergunta reescrita que o usuário escolheria. */
  resolved_question: string;
}

export interface ClarificationResult {
  needs_clarification: boolean;
  reason?: string;
  options?: ClarificationOption[];
}

const VAGUE_TIME_PATTERNS = [
  /quanto.*faturamos|faturei|recebi/i,
  /total.*pago|gasto/i,
  /qual.*margem/i,
];
const HAS_TIME_REF = /(hoje|ontem|amanh[ãa]|semana|m[êe]s|ano|trimestre|últimos?|desde|janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4})/i;

const AMBIGUOUS_TERMS: Array<{ term: RegExp; options: string[] }> = [
  {
    term: /\batrasada?s?\b/i,
    options: [
      "atrasada(s) em prazo de obra (cronograma)",
      "atrasada(s) em pagamento ao cliente",
      "atrasada(s) em compra/entrega",
    ],
  },
  {
    term: /\babertas?\b/i,
    options: [
      "obras ativas (não entregues)",
      "NCs / pendências em aberto",
      "tickets de CS em aberto",
    ],
  },
  {
    term: /\bmargem\b/i,
    options: [
      "margem prevista (contrato − estimado)",
      "margem realizada parcial (recebido − pago)",
    ],
  },
];

/**
 * Heurística leve, sem LLM. Devolve opções quando a pergunta é
 * inequivocamente ambígua. Em produção, pode ser estendida com chamada
 * dedicada ao LLM para casos sutis.
 */
export function detectClarification(question: string): ClarificationResult {
  const q = question.trim();
  if (q.length < 8) return { needs_clarification: false };

  // 1. Janela temporal indeterminada em tema sensível.
  const isVagueTime = VAGUE_TIME_PATTERNS.some((p) => p.test(q));
  if (isVagueTime && !HAS_TIME_REF.test(q)) {
    return {
      needs_clarification: true,
      reason: "Período não especificado em tema financeiro.",
      options: [
        { label: "Este mês", resolved_question: `${q} no mês corrente` },
        { label: "Últimos 30 dias", resolved_question: `${q} nos últimos 30 dias` },
        { label: "Este ano", resolved_question: `${q} no ano corrente` },
      ],
    };
  }

  // 2. Termos com múltiplas leituras.
  for (const { term, options } of AMBIGUOUS_TERMS) {
    if (term.test(q)) {
      // Só considera ambíguo se NÃO tem domínio claro no resto da frase.
      const hasDomainHint =
        /pagament|cobran[çc]a|boleto|recebi/i.test(q) ||
        /cronograma|atividade|etapa|prazo de obra/i.test(q) ||
        /compra|fornecedor|entrega|material/i.test(q) ||
        /\bnc\b|n[ãa]o[- ]?conformidade|defeito/i.test(q);
      if (!hasDomainHint) {
        return {
          needs_clarification: true,
          reason: `O termo é usado em múltiplos domínios.`,
          options: options.map((label) => ({
            label,
            resolved_question: `${q} (${label})`,
          })),
        };
      }
    }
  }

  return { needs_clarification: false };
}
