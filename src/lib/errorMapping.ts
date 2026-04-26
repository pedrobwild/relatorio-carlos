/**
 * errorMapping — converte erros técnicos (Supabase, fetch, etc.) em
 * mensagens humanas em pt-BR para o usuário final.
 *
 * Regra de ouro: nunca expor termos técnicos (RLS, JWT, Postgres, 5xx,
 * stack trace, IDs internos) ao usuário. O `technicalDetails` continua
 * disponível para logs/Sentry, mas só `userMessage` deve ir à UI.
 *
 * Uso:
 *   const ue = mapError(err);
 *   notify.error(ue.userMessage);
 *   captureError(err, { kind: ue.kind });
 */

export type UserErrorKind =
  | 'forbidden'
  | 'auth'
  | 'server'
  | 'network'
  | 'conflict'
  | 'notFound'
  | 'validation'
  | 'unknown';

export type SuggestedAction =
  | { type: 'retry' }
  | { type: 'redirect_to_auth' }
  | { type: 'contact_admin' }
  | { type: 'reload' }
  | { type: 'none' };

export interface UserError {
  kind: UserErrorKind;
  /** Mensagem curta, humana, em pt-BR. Pode ir direto na UI. */
  userMessage: string;
  /** Detalhes técnicos preservados para logs (NÃO mostrar ao usuário). */
  technicalDetails: string;
  /** Sugestão de ação (uso opcional pela UI). */
  suggestedAction?: SuggestedAction;
  /** Código original do erro, se houver. */
  code?: string | number;
}

interface RawErrorShape {
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  details?: unknown;
  hint?: unknown;
  error?: unknown;
  error_description?: unknown;
}

function extractMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message ?? '';
  if (typeof err === 'object') {
    const e = err as RawErrorShape;
    const parts: string[] = [];
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.error_description === 'string') parts.push(e.error_description);
    if (typeof e.error === 'string') parts.push(e.error);
    if (typeof e.details === 'string') parts.push(e.details);
    if (typeof e.hint === 'string') parts.push(e.hint);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as RawErrorShape;
  const raw = e.status ?? e.statusCode;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function extractCode(err: unknown): string | number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as RawErrorShape;
  if (typeof e.code === 'string' || typeof e.code === 'number') return e.code;
  return undefined;
}

const PATTERNS: Array<{
  test: (msg: string, status?: number, code?: string | number) => boolean;
  build: (raw: string) => UserError;
}> = [
  // Auth — sessão expirada / token inválido
  {
    test: (msg, status) =>
      status === 401 ||
      /\bjwt\b|invalid[_\s-]?token|session[_\s-]?expired|token[_\s-]?expired|not[_\s-]?authenticated|auth(?:entication)?[_\s-]?required/i.test(msg),
    build: (raw) => ({
      kind: 'auth',
      userMessage: 'Sua sessão expirou. Entre novamente para continuar.',
      technicalDetails: raw,
      suggestedAction: { type: 'redirect_to_auth' },
    }),
  },
  // Forbidden — RLS / policy / permission
  {
    test: (msg, status) =>
      status === 403 ||
      /row[_\s-]?level[_\s-]?security|\brls\b|policy|permission[_\s-]?denied|forbidden|not[_\s-]?allowed|insufficient[_\s-]?privilege/i.test(msg),
    build: (raw) => ({
      kind: 'forbidden',
      userMessage: 'Você não tem permissão para acessar este conteúdo. Fale com o gestor.',
      technicalDetails: raw,
      suggestedAction: { type: 'contact_admin' },
    }),
  },
  // Not found
  {
    test: (msg, status) =>
      status === 404 ||
      /\bnot[_\s-]?found\b|does[_\s-]?not[_\s-]?exist|no[_\s-]?rows[_\s-]?returned/i.test(msg),
    build: (raw) => ({
      kind: 'notFound',
      userMessage: 'Não encontramos esse item. Pode ter sido removido ou movido.',
      technicalDetails: raw,
      suggestedAction: { type: 'none' },
    }),
  },
  // Conflict — duplicado / unique constraint
  {
    test: (msg, status, code) =>
      status === 409 ||
      code === '23505' ||
      /duplicate|unique[_\s-]?(?:constraint|violation)|already[_\s-]?exists/i.test(msg),
    build: (raw) => ({
      kind: 'conflict',
      userMessage: 'Já existe um registro com esses dados.',
      technicalDetails: raw,
      suggestedAction: { type: 'none' },
    }),
  },
  // Validation
  {
    test: (msg, status, code) =>
      status === 400 ||
      status === 422 ||
      code === '23502' ||
      code === '23503' ||
      /validation|invalid[_\s-]?(?:input|value|format)|missing[_\s-]?required|null[_\s-]?value|foreign[_\s-]?key/i.test(msg),
    build: (raw) => ({
      kind: 'validation',
      userMessage: 'Verifique os dados informados — algo não está no formato esperado.',
      technicalDetails: raw,
      suggestedAction: { type: 'none' },
    }),
  },
  // Network — offline / timeout / fetch failed
  {
    test: (msg) =>
      /timeout|timed[_\s-]?out|network[_\s-]?error|failed[_\s-]?to[_\s-]?fetch|fetch[_\s-]?failed|offline|econnrefused|enotfound|network[_\s-]?request[_\s-]?failed|load[_\s-]?failed/i.test(msg),
    build: (raw) => ({
      kind: 'network',
      userMessage: 'A conexão está lenta ou indisponível. Tente de novo em alguns segundos.',
      technicalDetails: raw,
      suggestedAction: { type: 'retry' },
    }),
  },
  // Server — 5xx / internal / postgres-specific
  {
    test: (msg, status) =>
      (typeof status === 'number' && status >= 500 && status < 600) ||
      /\b5\d{2}\b|server[_\s-]?error|internal[_\s-]?error|service[_\s-]?unavailable|bad[_\s-]?gateway|gateway[_\s-]?timeout|postgres|database[_\s-]?error/i.test(msg),
    build: (raw) => ({
      kind: 'server',
      userMessage: 'Tivemos um problema no servidor. Estamos trabalhando para resolver — tente de novo em instantes.',
      technicalDetails: raw,
      suggestedAction: { type: 'retry' },
    }),
  },
];

const UNKNOWN_FALLBACK: UserError = {
  kind: 'unknown',
  userMessage: 'Algo não saiu como esperado. Tente de novo.',
  technicalDetails: '',
  suggestedAction: { type: 'retry' },
};

/**
 * Converte qualquer erro em uma `UserError` segura para exibir.
 * Sempre retorna um objeto — nunca lança.
 */
export function mapError(error: unknown): UserError {
  if (error == null) return { ...UNKNOWN_FALLBACK };

  const raw = extractMessage(error);
  const status = extractStatus(error);
  const code = extractCode(error);

  for (const pattern of PATTERNS) {
    if (pattern.test(raw, status, code)) {
      const ue = pattern.build(raw);
      if (code !== undefined) ue.code = code;
      return ue;
    }
  }

  return {
    ...UNKNOWN_FALLBACK,
    technicalDetails: raw,
    code,
  };
}

/**
 * Helper: o erro exige um redirect para a tela de auth?
 */
export function isAuthError(ue: UserError): boolean {
  return ue.kind === 'auth';
}
