import type { InsightDomain } from "./insightTypes";

interface DomainClue {
  domain: InsightDomain;
  patterns: RegExp[];
  /** Per-clue weight. Defaults to 1. Use 2+ for unambiguous PT-BR keywords. */
  weight?: number;
}

/**
 * Lightweight, deterministic domain classifier. Used as a hint for the
 * planner and as a fallback when the LLM does not return a domain.
 * The matching is case-insensitive and accent-insensitive.
 */
const CLUES: DomainClue[] = [
  {
    domain: "financeiro",
    patterns: [
      /pag(amento|ar|os)/i,
      /receb(er|emos|ido|imento)/i,
      /\bboleto\b/i,
      /\bpix\b/i,
      /parcela/i,
      /financ/i,
      /\br\$/i,
      /caix/i,
      /faturamento/i,
      /inadimpl/i,
    ],
  },
  {
    domain: "compras",
    patterns: [
      /\bcompra/i,
      /pedido/i,
      /estimad/i,
      /forneced/i,
      /prestador/i,
      /entrega/i,
      /lead\s*time/i,
    ],
  },
  {
    domain: "fornecedores",
    patterns: [/\bfornecedor/i, /prestador/i, /supplier/i],
  },
  {
    domain: "cronograma",
    patterns: [
      /cronograma/i,
      /atividade/i,
      /\betap/i,
      /atras/i,
      /progresso/i,
      /baseline/i,
      /planned_(start|end)/i,
      /actual_(start|end)/i,
    ],
  },
  {
    domain: "ncs",
    patterns: [
      /\bnc\b/i,
      /n\.?c\.?s?\b/i,
      /n[aã]o[\s-]?conformidad/i,
      /qualidade/i,
      /defeito/i,
      /reincid/i,
    ],
  },
  {
    domain: "pendencias",
    patterns: [/pend[eê]ncia/i, /pending/i, /bloqueand/i, /aprovaç/i],
    weight: 3,
  },
  {
    domain: "cs",
    patterns: [
      /\bticket/i,
      /atendimento/i,
      /customer\s*success/i,
      /\bcs\b/i,
      /reclamaç/i,
      /chamado/i,
    ],
  },
  {
    domain: "obras",
    patterns: [/\bobra/i, /\bproject/i, /\bcanteiro/i],
  },
];

const EXECUTIVE_HINTS = [
  /preciso\s+priorizar/i,
  /resumo\s+executivo/i,
  /vis[aã]o\s+(geral|executiva)/i,
  /diagn[oó]stico/i,
  /panor[âa]ma/i,
  /o que.*olhar.*hoje/i,
];

export function classifyDomain(question: string): {
  domain: InsightDomain;
  scores: Record<InsightDomain, number>;
  isExecutive: boolean;
} {
  const scores = Object.fromEntries(CLUES.map((c) => [c.domain, 0])) as Record<
    InsightDomain,
    number
  >;
  scores.outros = 0;
  scores.formalizacoes = 0;
  scores.arquivos = 0;
  scores.auditoria = 0;

  for (const c of CLUES) {
    const w = c.weight ?? 1;
    for (const re of c.patterns) {
      if (re.test(question)) scores[c.domain] += w;
    }
  }

  const isExecutive = EXECUTIVE_HINTS.some((re) => re.test(question));

  let domain: InsightDomain = "outros";
  let max = 0;
  for (const [d, score] of Object.entries(scores) as [
    InsightDomain,
    number,
  ][]) {
    if (score > max) {
      max = score;
      domain = d;
    }
  }

  if (max === 0) domain = isExecutive ? "obras" : "outros";

  return { domain, scores, isExecutive };
}
