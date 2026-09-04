/**
 * Structured Error Logger
 *
 * Centralized error logging with correlation IDs and context.
 * In production, this could be extended to send to external services.
 */
/* eslint-disable no-console */

export interface ErrorContext {
  userId?: string;
  route?: string;
  component?: string;
  action?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  context: ErrorContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Generate a correlation ID for tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get or create a correlation ID for the current session
 */
let sessionCorrelationId: string | null = null;

export function getSessionCorrelationId(): string {
  if (!sessionCorrelationId) {
    sessionCorrelationId = generateCorrelationId();
  }
  return sessionCorrelationId;
}

/**
 * Format error for logging
 */
function formatError(error: unknown): LogEntry["error"] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogEntry["level"],
  message: string,
  context: ErrorContext = {},
  error?: unknown,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: {
      correlationId: context.correlationId || getSessionCorrelationId(),
      route:
        typeof window !== "undefined" ? window.location.pathname : undefined,
      ...context,
    },
    error: formatError(error),
  };
}

/**
 * Log an info message
 */
export function logInfo(message: string, context: ErrorContext = {}): void {
  const entry = createLogEntry("info", message, context);

  if (import.meta.env.DEV) {
    console.log("[INFO]", entry.message, entry.context);
  }

  // In production, could send to external logging service
}

/**
 * Log a warning
 */
export function logWarn(message: string, context: ErrorContext = {}): void {
  const entry = createLogEntry("warn", message, context);

  console.warn("[WARN]", entry.message, entry.context);

  // In production, could send to external logging service
}

/**
 * Log an error with full context
 */
export function logError(
  message: string,
  error: unknown,
  context: ErrorContext = {},
): void {
  const entry = createLogEntry("error", message, context, error);

  console.error("[ERROR]", entry.message, {
    ...entry.context,
    error: entry.error,
  });

  // Persiste no servidor. Sem isto um erro pontual num único usuário fica só
  // no console dele: quando o relato chega, não há como confirmar nem
  // descartar nada — foi exatamente o que aconteceu em 04/09/2026.
  //
  // Import dinâmico de propósito: o logger é importado por praticamente todo
  // módulo, inclusive pelo authRecovery, e uma dependência estática do cliente
  // Supabase aqui criaria um ciclo de importação.
  void import("@/infra/repositories/clientErrors.repository")
    .then(({ recordClientError }) =>
      recordClientError({
        context: typeof entry.context.component === "string"
          ? entry.context.component
          : undefined,
        message: entry.error
          ? `${entry.message} — ${entry.error.message}`
          : entry.message,
        errorCode:
          typeof entry.context.errorCode === "string"
            ? entry.context.errorCode
            : undefined,
        httpStatus:
          typeof entry.context.httpStatus === "number"
            ? entry.context.httpStatus
            : undefined,
        extra: sanitizeExtra(entry.context),
      }),
    )
    // Nunca deixar o registro de um erro virar um erro.
    .catch(() => undefined);
}

/** Campos já promovidos a coluna, ou grandes demais, não vão para `extra`. */
const EXTRA_OMITIR = new Set([
  "component",
  "errorCode",
  "httpStatus",
  "route",
  "correlationId",
]);

function sanitizeExtra(context: ErrorContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(context)) {
    if (EXTRA_OMITIR.has(chave)) continue;
    // Só primitivos: objeto aninhado pode arrastar dado que não queremos.
    if (
      typeof valor === "string" ||
      typeof valor === "number" ||
      typeof valor === "boolean"
    ) {
      out[chave] = typeof valor === "string" ? valor.slice(0, 200) : valor;
    }
  }
  return out;
}

/**
 * Create a scoped logger for a component/hook
 */
export function createLogger(component: string) {
  return {
    info: (message: string, context: ErrorContext = {}) =>
      logInfo(message, { ...context, component }),
    warn: (message: string, context: ErrorContext = {}) =>
      logWarn(message, { ...context, component }),
    error: (message: string, error: unknown, context: ErrorContext = {}) =>
      logError(message, error, { ...context, component }),
  };
}

/**
 * Wrap async function with error logging
 */
export function withErrorLogging<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, context: ErrorContext = {}): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError("Async operation failed", error, context);
      throw error;
    }
  }) as T;
}
