/**
 * Performance Instrumentation Utilities (DEV only)
 *
 * Provides lightweight timing helpers for measuring critical user paths.
 * All logs are stripped in production builds.
 *
 * Usage:
 *   import { perf } from '@/lib/perf';
 *   perf.mark('load-start');
 *   // ... do work
 *   perf.measure('Page Load', 'load-start');
 */

const isDev = import.meta.env.DEV;

// Store for active marks
const marks = new Map<string, number>();

// Store for measurements history (for debugging)
const measurements: Array<{
  label: string;
  duration: number;
  timestamp: number;
}> = [];

/**
 * Create a performance mark
 */
function mark(name: string): void {
  if (!isDev) return;
  marks.set(name, performance.now());
}

/**
 * Measure time since a mark and log it
 * Returns duration in ms
 */
function measure(
  label: string,
  startMark: string,
  options?: { log?: boolean },
): number {
  if (!isDev) return 0;

  const startTime = marks.get(startMark);
  if (startTime === undefined) {
    console.warn(`[Perf] Mark "${startMark}" not found`);
    return 0;
  }

  const endTime = performance.now();
  const duration = Math.round(endTime - startTime);

  measurements.push({ label, duration, timestamp: Date.now() });

  // Keep only last 50 measurements
  if (measurements.length > 50) {
    measurements.shift();
  }

  if (options?.log !== false) {
    const emoji =
      duration < 100
        ? "⚡"
        : duration < 500
          ? "✓"
          : duration < 1000
            ? "⚠️"
            : "🐢";
    console.log(`[Perf] ${emoji} ${label}: ${duration}ms`);
  }

  // Clean up the mark
  marks.delete(startMark);

  return duration;
}

/**
 * Time a synchronous function
 */
function time<T>(label: string, fn: () => T): T {
  if (!isDev) return fn();

  const start = performance.now();
  const result = fn();
  const duration = Math.round(performance.now() - start);

  const emoji = duration < 100 ? "⚡" : duration < 500 ? "✓" : "⚠️";
  console.log(`[Perf] ${emoji} ${label}: ${duration}ms`);

  return result;
}

/**
 * Time an async function
 */
async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isDev) return fn();

  const start = performance.now();
  const result = await fn();
  const duration = Math.round(performance.now() - start);

  const emoji =
    duration < 100
      ? "⚡"
      : duration < 500
        ? "✓"
        : duration < 1000
          ? "⚠️"
          : "🐢";
  console.log(`[Perf] ${emoji} ${label}: ${duration}ms`);

  return result;
}

/**
 * Log performance data with grouping
 */
function logGroup(groupLabel: string, data: Record<string, unknown>): void {
  if (!isDev) return;

  console.groupCollapsed(`[Perf] ${groupLabel}`);
  Object.entries(data).forEach(([key, value]) => {
    console.log(`  ${key}:`, value);
  });
  console.groupEnd();
}

/**
 * Get all measurements for debugging
 */
function getMeasurements() {
  return [...measurements];
}

/**
 * Clear all marks and measurements
 */
function clear(): void {
  marks.clear();
  measurements.length = 0;
}

/**
 * Component render counter (for detecting excessive re-renders)
 */
const renderCounts = new Map<string, number>();

function trackRender(componentName: string): void {
  if (!isDev) return;

  const count = (renderCounts.get(componentName) || 0) + 1;
  renderCounts.set(componentName, count);

  // Warn if a component renders more than 10 times quickly
  if (count > 10 && count % 10 === 0) {
    console.warn(`[Perf] ⚠️ ${componentName} has rendered ${count} times`);
  }
}

function getRenderCounts() {
  return Object.fromEntries(renderCounts);
}

function resetRenderCounts(): void {
  renderCounts.clear();
}

export const perf = {
  mark,
  measure,
  time,
  timeAsync,
  logGroup,
  getMeasurements,
  clear,
  trackRender,
  getRenderCounts,
  resetRenderCounts,
} as const;

// Also export individual functions for tree-shaking
export { mark, measure, time, timeAsync, logGroup };
