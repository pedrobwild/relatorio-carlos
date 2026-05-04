/**
 * Build Information Helper
 *
 * Provides access to build-time information like git commit, branch, and environment.
 * Values are injected at build time via Vite's define or env variables.
 */

export interface BuildInfo {
  commit: string;
  branch: string;
  buildDate: string;
  environment: "development" | "staging" | "production";
  baseUrl: string;
  version: string;
}

/**
 * Get the current environment based on URL and env vars
 */
function detectEnvironment(): BuildInfo["environment"] {
  // Check explicit env var first
  const envMode = import.meta.env.MODE;

  if (envMode === "production") {
    // Check if it's staging based on URL
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    if (hostname.includes("staging") || hostname.includes("preview")) {
      return "staging";
    }
    return "production";
  }

  return "development";
}

/**
 * Get build information
 */
export function getBuildInfo(): BuildInfo {
  return {
    commit: import.meta.env.VITE_GIT_COMMIT || "unknown",
    branch: import.meta.env.VITE_GIT_BRANCH || "unknown",
    buildDate: import.meta.env.VITE_BUILD_DATE || new Date().toISOString(),
    environment: detectEnvironment(),
    baseUrl: import.meta.env.VITE_SUPABASE_URL || "unknown",
    version: import.meta.env.VITE_APP_VERSION || "1.0.0-beta",
  };
}

/**
 * Get shortened commit hash for display
 */
export function getShortCommit(): string {
  const commit = import.meta.env.VITE_GIT_COMMIT || "unknown";
  return commit.substring(0, 7);
}

/**
 * Check if running in development mode
 */
export function isDev(): boolean {
  return import.meta.env.DEV;
}

/**
 * Check if running in production
 */
export function isProd(): boolean {
  return import.meta.env.PROD && !window.location.hostname.includes("preview");
}

/**
 * Get Sentry project URL if configured
 */
export function getSentryProjectUrl(): string | null {
  return import.meta.env.VITE_SENTRY_PROJECT_URL || null;
}
