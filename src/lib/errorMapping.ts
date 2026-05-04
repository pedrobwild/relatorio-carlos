/**
 * errorMapping — traduz erros técnicos (Supabase/Postgres/network/HTTP) em
 * mensagens humanas e acionáveis em pt-BR.
 *
 * Use em qualquer ponto onde um erro vai virar UI: ErrorView, notify.error,
 * repository wrapper, ErrorBoundary global.
 *
 * Princípios:
 * 1. Nunca mencionar termos técnicos (RLS, JWT, Postgres, PGRST, policy).
 * 2. Voz BWild: curta, humana, sem juridiquês ou jargão.
 * 3. Sempre que possível sugerir uma ação concreta ou rota de saída.
 */

export type UserErrorKind =
  | "forbidden"
  | "auth"
  | "server"
  | "network"
  | "conflict"
  | "not_found"
  | "validation"
  | "rate_limit"
  | "storage"
  | "unknown";

export type SuggestedAction =
  | "retry"
  | "redirect_auth"
  | "contact_support"
  | "check_data"
  | "wait";

export interface UserError {
  /** Categoria do erro — direciona ícone/cor na UI. */
  kind: UserErrorKind;
  /** Mensagem para mostrar ao usuário (pt-BR, voz BWild). */
  userMessage: string;
  /** Detalhes técnicos preservados (NUNCA exibir ao usuário). */
  technicalDetails?: string;
  /** Ação sugerida — UI pode usar para decidir botão/efeito. */
  suggestedAction?: SuggestedAction;
  /** Código original quando disponível (para logs/correlação). */
  code?: string;
}

interface PatternRule {
  /** Regex aplicada (case-insensitive) sobre a string serializada do erro. */
  pattern: RegExp;
  kind: UserErrorKind;
  userMessage: string;
  suggestedAction?: SuggestedAction;
}

/**
 * Tabela de padrões — ordem importa: mais específico primeiro.
 */
const PATTERNS: PatternRule[] = [
  // --- Auth (precisa vir antes de RLS/forbidden, pois "JWT" pode aparecer junto) ---
  {
    pattern:
      /jwt\s*expired|invalid_token|session\s*expired|jwt\s*malformed|invalid\s*jwt/i,
    kind: "auth",
    userMessage: "Sua sessão expirou. Entre novamente para continuar.",
    suggestedAction: "redirect_auth",
  },
  {
    pattern: /not\s*authenticated|no\s*api\s*key/i,
    kind: "auth",
    userMessage: "Você precisa entrar na sua conta para fazer isso.",
    suggestedAction: "redirect_auth",
  },

  // --- Forbidden / RLS ---
  {
    pattern:
      /row[\s-]level\s*security|violates?\s*row|new\s*row\s*violates|\brls\b|policy/i,
    kind: "forbidden",
    userMessage:
      "Você não tem permissão para acessar este conteúdo. Fale com o gestor da obra.",
    suggestedAction: "contact_support",
  },
  {
    pattern: /permission\s*denied|unauthorized|forbidden|\b403\b/i,
    kind: "forbidden",
    userMessage: "Você não tem permissão para esta ação.",
    suggestedAction: "contact_support",
  },

  // --- Network / offline / timeout ---
  {
    pattern: /failed\s*to\s*fetch|network\s*error|networkerror|net::err/i,
    kind: "network",
    userMessage:
      "Não foi possível conectar ao servidor. Verifique sua internet.",
    suggestedAction: "retry",
  },
  {
    pattern: /timeout|timed\s*out|etimedout/i,
    kind: "network",
    userMessage: "A conexão está lenta. Tente de novo em alguns segundos.",
    suggestedAction: "retry",
  },
  {
    pattern: /offline|econnrefused|enotfound|abort(ed)?/i,
    kind: "network",
    userMessage: "Sem conexão. Quando voltar a internet, tente novamente.",
    suggestedAction: "wait",
  },

  // --- Rate limit ---
  {
    pattern: /rate\s*limit|too\s*many\s*requests|\b429\b/i,
    kind: "rate_limit",
    userMessage: "Muitas tentativas em pouco tempo. Aguarde alguns segundos.",
    suggestedAction: "wait",
  },

  // --- Validation / business constraints ---
  {
    pattern: /duplicate\s*key|unique\s*constraint|unique_violation|\b23505\b/i,
    kind: "conflict",
    userMessage: "Já existe um registro com esses dados.",
    suggestedAction: "check_data",
  },
  {
    pattern: /foreign\s*key|foreign_key_violation|\b23503\b/i,
    kind: "conflict",
    userMessage:
      "Esta operação não é permitida porque há dados relacionados em uso.",
    suggestedAction: "check_data",
  },
  {
    pattern: /check_violation|\b23514\b/i,
    kind: "validation",
    userMessage: "Os dados informados não estão no formato esperado.",
    suggestedAction: "check_data",
  },
  {
    pattern: /not_null_violation|\b23502\b|null\s*value/i,
    kind: "validation",
    userMessage: "Preencha todos os campos obrigatórios.",
    suggestedAction: "check_data",
  },

  // --- Not found / storage ---
  {
    pattern: /\b404\b|not\s*found|object\s*not\s*found/i,
    kind: "not_found",
    userMessage:
      "Não encontramos esse item. Talvez tenha sido movido ou removido.",
  },
  {
    pattern: /payload\s*too\s*large|\b413\b/i,
    kind: "storage",
    userMessage: "Arquivo muito grande. Reduza o tamanho e tente de novo.",
    suggestedAction: "check_data",
  },
  {
    pattern: /bucket\s*not\s*found|storage/i,
    kind: "storage",
    userMessage:
      "Não conseguimos acessar o armazenamento. Tente novamente em instantes.",
    suggestedAction: "retry",
  },

  // --- Server / 5xx ---
  {
    pattern:
      /\b5\d{2}\b|server\s*error|internal\s*error|service\s*unavailable|bad\s*gateway/i,
    kind: "server",
    userMessage:
      "Tivemos um problema no servidor. Estamos trabalhando para resolver.",
    suggestedAction: "retry",
  },

  // --- Generic Postgres / PGRST (vazamentos) ---
  {
    pattern: /pgrst|postgres|postgrest/i,
    kind: "server",
    userMessage:
      "Algo não funcionou como esperado. Tente novamente em instantes.",
    suggestedAction: "retry",
  },
];

/**
 * Serializa o erro em uma única string para fazer matching seguro.
 * Aceita Error, PostgrestError, AuthError, Response, string, objeto qualquer.
 */
function serializeError(error: unknown): {
  text: string;
  code?: string;
  status?: number;
} {
  if (!error) return { text: "" };

  if (typeof error === "string") return { text: error };

  if (typeof error === "object") {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string | number;
      name?: string;
      status?: number;
      statusCode?: number;
      error?: { message?: string; code?: string };
    };

    const parts = [
      err.message,
      err.details,
      err.hint,
      err.error?.message,
      err.name,
      err.code != null ? String(err.code) : undefined,
      err.status != null ? String(err.status) : undefined,
      err.statusCode != null ? String(err.statusCode) : undefined,
    ].filter(Boolean);

    return {
      text: parts.join(" | "),
      code: err.code != null ? String(err.code) : err.error?.code,
      status: err.status ?? err.statusCode,
    };
  }

  return { text: String(error) };
}

/**
 * Mapeia um erro arbitrário em um UserError com mensagem humana.
 */
export function mapError(error: unknown): UserError {
  const { text, code, status } = serializeError(error);

  // HTTP status code (numérico) tem prioridade quando explícito
  if (status != null) {
    if (status === 401) {
      return {
        kind: "auth",
        userMessage: "Sua sessão expirou. Entre novamente para continuar.",
        technicalDetails: text,
        suggestedAction: "redirect_auth",
        code,
      };
    }
    if (status === 403) {
      return {
        kind: "forbidden",
        userMessage: "Você não tem permissão para esta ação.",
        technicalDetails: text,
        suggestedAction: "contact_support",
        code,
      };
    }
    if (status === 404) {
      return {
        kind: "not_found",
        userMessage:
          "Não encontramos esse item. Talvez tenha sido movido ou removido.",
        technicalDetails: text,
        code,
      };
    }
    if (status === 413) {
      return {
        kind: "storage",
        userMessage: "Arquivo muito grande. Reduza o tamanho e tente de novo.",
        technicalDetails: text,
        suggestedAction: "check_data",
        code,
      };
    }
    if (status === 429) {
      return {
        kind: "rate_limit",
        userMessage:
          "Muitas tentativas em pouco tempo. Aguarde alguns segundos.",
        technicalDetails: text,
        suggestedAction: "wait",
        code,
      };
    }
    if (status >= 500 && status <= 599) {
      return {
        kind: "server",
        userMessage:
          "Tivemos um problema no servidor. Estamos trabalhando para resolver.",
        technicalDetails: text,
        suggestedAction: "retry",
        code,
      };
    }
  }

  for (const rule of PATTERNS) {
    if (rule.pattern.test(text)) {
      return {
        kind: rule.kind,
        userMessage: rule.userMessage,
        technicalDetails: text,
        suggestedAction: rule.suggestedAction,
        code,
      };
    }
  }

  return {
    kind: "unknown",
    userMessage: "Algo não saiu como esperado. Tente de novo em instantes.",
    technicalDetails: text || undefined,
    suggestedAction: "retry",
    code,
  };
}

/**
 * Atalho: extrai apenas a mensagem humana de qualquer erro.
 * Útil quando você só precisa do texto para um toast/inline.
 */
export function getUserMessage(error: unknown): string {
  return mapError(error).userMessage;
}

/**
 * Sentinelas para detectar tipos especiais sem expor implementação.
 */
export function isAuthError(error: unknown): boolean {
  return mapError(error).kind === "auth";
}

export function isForbiddenError(error: unknown): boolean {
  return mapError(error).kind === "forbidden";
}

export function isNetworkError(error: unknown): boolean {
  return mapError(error).kind === "network";
}
