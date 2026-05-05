/**
 * Development Logger - Provides grouped, timestamped logs only in DEV mode
 *
 * Use for debugging critical flows:
 * - Document upload/approval
 * - Weekly report save
 * - Gantt date updates
 * - PDF export
 * - Auth/navigation events
 */
/* eslint-disable no-console */

const isDev = import.meta.env.DEV;

type LogLevel = "info" | "warn" | "error" | "success";

interface LogOptions {
  level?: LogLevel;
  duration?: number; // in ms
  data?: Record<string, unknown>;
}

const levelStyles = {
  info: "color: #3b82f6",
  warn: "color: #f59e0b",
  error: "color: #ef4444",
  success: "color: #22c55e",
};

const levelIcons = {
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
  success: "✅",
};

/**
 * Create a scoped logger for a specific feature/action
 */
export function createDevLogger(scope: string) {
  const startTimes = new Map<string, number>();

  return {
    /**
     * Start timing an operation
     */
    start(
      operationId: string,
      message: string,
      data?: Record<string, unknown>,
    ) {
      if (!isDev) return;

      const startTime = performance.now();
      startTimes.set(operationId, startTime);

      console.groupCollapsed(
        `%c[${scope}] ${message}`,
        "color: #8b5cf6; font-weight: bold",
      );
      console.log("🕐 Started at:", new Date().toISOString());
      if (data) {
        console.log("📦 Params:", data);
      }
    },

    /**
     * End timing and log duration
     */
    end(operationId: string, options?: LogOptions) {
      if (!isDev) return;

      const startTime = startTimes.get(operationId);
      const duration = startTime
        ? Math.round(performance.now() - startTime)
        : options?.duration;
      startTimes.delete(operationId);

      const level = options?.level || "success";

      if (duration !== undefined) {
        console.log(`⏱️ Duration: ${duration}ms`);
      }
      if (options?.data) {
        console.log(`${levelIcons[level]} Result:`, options.data);
      }
      console.groupEnd();
    },

    /**
     * Log an error and close the group
     */
    error(
      operationId: string,
      error: unknown,
      context?: Record<string, unknown>,
    ) {
      if (!isDev) return;

      const startTime = startTimes.get(operationId);
      const duration = startTime
        ? Math.round(performance.now() - startTime)
        : undefined;
      startTimes.delete(operationId);

      console.log(`%c${levelIcons.error} Error:`, levelStyles.error, error);
      if (context) {
        console.log("📋 Context:", context);
      }
      if (duration !== undefined) {
        console.log(`⏱️ Failed after: ${duration}ms`);
      }
      console.groupEnd();
    },

    /**
     * Simple log without timing
     */
    log(
      message: string,
      data?: Record<string, unknown>,
      level: LogLevel = "info",
    ) {
      if (!isDev) return;

      console.log(
        `%c[${scope}] ${levelIcons[level]} ${message}`,
        levelStyles[level],
        data ? data : "",
      );
    },

    /**
     * Log a warning
     */
    warn(message: string, data?: Record<string, unknown>) {
      if (!isDev) return;
      console.warn(`[${scope}] ${levelIcons.warn} ${message}`, data || "");
    },
  };
}

// Pre-configured loggers for critical features
export const documentLogger = createDevLogger("Documents");
export const reportLogger = createDevLogger("WeeklyReport");
export const ganttLogger = createDevLogger("Gantt");
export const pdfLogger = createDevLogger("PDFExport");
export const authLogger = createDevLogger("Auth");
