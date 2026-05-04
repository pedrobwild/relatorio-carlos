/**
 * Error Monitoring & Reporting
 *
 * Captures runtime errors with context for debugging.
 * In production, sends to external monitoring service.
 *
 * Usage:
 *   import { captureError, captureMessage } from '@/lib/errorMonitoring';
 *   captureError(error, { feature: 'documents', projectId: '...' });
 */

export interface ErrorContext {
  feature?:
    | "auth"
    | "documents"
    | "weekly-reports"
    | "cronograma"
    | "formalizacoes"
    | "export-pdf"
    | "diagnostics"
    | "general";
  projectId?: string;
  userId?: string;
  role?: string;
  route?: string;
  action?: string;
  [key: string]: unknown;
}

interface ErrorReport {
  timestamp: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context: ErrorContext;
  userAgent: string;
  url: string;
}

// In-memory error buffer for debugging
const errorBuffer: ErrorReport[] = [];
const MAX_BUFFER_SIZE = 50;

/**
 * Initialize error monitoring
 * Call this once at app startup
 */
export function initErrorMonitoring(): void {
  // Global error handler
  window.addEventListener("error", (event) => {
    captureError(event.error || new Error(event.message), {
      feature: "general",
      action: "uncaught_error",
    });
  });

  // Unhandled promise rejection handler
  window.addEventListener("unhandledrejection", (event) => {
    captureError(event.reason || new Error("Unhandled promise rejection"), {
      feature: "general",
      action: "unhandled_rejection",
    });
  });

  if (import.meta.env.DEV) {
    console.log(
      "[ErrorMonitoring] Initialized (DEV mode - errors logged to console)",
    );
  }
}

/**
 * Get current user context
 */
function getCurrentContext(): Partial<ErrorContext> {
  // Only use the route; user info is injected by callers via ErrorContext.
  // Avoids reading internal Supabase localStorage keys that may change.
  return {
    route: window.location.pathname,
  };
}

/**
 * Sanitize error context to remove sensitive data
 */
function sanitizeContext(context: ErrorContext): ErrorContext {
  const sanitized = { ...context };

  // Remove potential sensitive fields
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "key",
    "auth",
    "cookie",
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Create error report
 */
function createReport(
  error: Error | unknown,
  context: ErrorContext,
): ErrorReport {
  const err = error instanceof Error ? error : new Error(String(error));

  return {
    timestamp: new Date().toISOString(),
    message: err.message,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    context: sanitizeContext({
      ...getCurrentContext(),
      ...context,
    }),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
}

/**
 * Send report to monitoring service
 * In production, this would send to Sentry/DataDog/etc.
 */
async function sendReport(report: ErrorReport): Promise<void> {
  // Add to local buffer
  errorBuffer.push(report);
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.shift();
  }

  if (import.meta.env.DEV) {
    // In dev, just log to console with formatting
    console.groupCollapsed(
      `%c[Error] ${report.context.feature || "general"}: ${report.message}`,
      "color: #ff6b6b; font-weight: bold;",
    );
    console.log("Context:", report.context);
    console.log("Stack:", report.error?.stack);
    console.groupEnd();
    return;
  }

  // In production, would send to external service
  // Example Sentry integration:
  // Sentry.captureException(error, { extra: report.context, tags: { feature: report.context.feature } });

  // For now, we'll log critical errors to console in production too
  if (report.context.feature !== "general") {
    console.error("[Error]", report.message, report.context);
  }
}

/**
 * Capture an error with context
 */
export function captureError(
  error: Error | unknown,
  context: ErrorContext = {},
): void {
  const report = createReport(error, context);
  sendReport(report).catch(() => {
    // Silently fail if reporting fails
  });
}

/**
 * Alias for captureError for consistency with Sentry API
 */
export function captureException(
  error: Error | unknown,
  options: {
    feature?: ErrorContext["feature"];
    action?: string;
    extra?: Record<string, unknown>;
  } = {},
): void {
  captureError(error, {
    feature: options.feature || "general",
    action: options.action,
    ...options.extra,
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context: ErrorContext = {},
): void {
  if (import.meta.env.DEV) {
    const colors = {
      info: "color: #4dabf7",
      warning: "color: #ffc107",
      error: "color: #ff6b6b",
    };
    console.log(
      `%c[${level.toUpperCase()}] ${message}`,
      colors[level],
      context,
    );
  }

  if (level === "error") {
    captureError(new Error(message), context);
  }
}

/**
 * Get error buffer for debugging
 */
export function getErrorBuffer(): readonly ErrorReport[] {
  return [...errorBuffer];
}

/**
 * Clear error buffer
 */
export function clearErrorBuffer(): void {
  errorBuffer.length = 0;
}

/**
 * Create scoped error capture for a feature
 */
export function createFeatureErrorCapture(feature: ErrorContext["feature"]) {
  return {
    capture: (
      error: Error | unknown,
      context: Omit<ErrorContext, "feature"> = {},
    ) => captureError(error, { ...context, feature }),
    message: (
      message: string,
      level: "info" | "warning" | "error" = "info",
      context: Omit<ErrorContext, "feature"> = {},
    ) => captureMessage(message, level, { ...context, feature }),
  };
}

// Feature-specific error captures
export const authErrors = createFeatureErrorCapture("auth");
export const documentErrors = createFeatureErrorCapture("documents");
export const reportErrors = createFeatureErrorCapture("weekly-reports");
export const cronogramaErrors = createFeatureErrorCapture("cronograma");
export const formalizacoesErrors = createFeatureErrorCapture("formalizacoes");
export const pdfErrors = createFeatureErrorCapture("export-pdf");
export const diagnosticsErrors = createFeatureErrorCapture("diagnostics");
