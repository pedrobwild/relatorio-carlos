/**
 * Debug utilities for authentication and navigation issues.
 * Enable by setting localStorage.debug_auth = "1" in browser console.
 *
 * Usage: localStorage.setItem('debug_auth', '1')
 * Disable: localStorage.removeItem('debug_auth')
 */
/* eslint-disable no-console */

const PREFIX_AUTH = "[DBG-AUTH]";
const PREFIX_NAV = "[DBG-NAV]";
const PREFIX_VISIBILITY = "[DBG-VIS]";

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("debug_auth") === "1";
  } catch {
    return false;
  }
}

export function debugAuth(event: string, payload?: unknown): void {
  if (!isDebugEnabled()) return;
  console.log(PREFIX_AUTH, event, payload ?? "");
}

export function debugNav(event: string, payload?: unknown): void {
  if (!isDebugEnabled()) return;
  console.log(PREFIX_NAV, event, payload ?? "");
}

export function debugVisibility(event: string, payload?: unknown): void {
  if (!isDebugEnabled()) return;
  console.log(PREFIX_VISIBILITY, event, payload ?? "");
}

/**
 * Logs current auth debugging state
 */
export function logAuthState(state: {
  isAuthenticated: boolean;
  loading: boolean;
  userId?: string | null;
  event?: string;
}): void {
  if (!isDebugEnabled()) return;
  console.log(PREFIX_AUTH, "State:", {
    ...state,
    timestamp: new Date().toISOString(),
    pathname:
      typeof window !== "undefined" ? window.location.pathname : "unknown",
  });
}

/**
 * Setup visibility change listener for debugging
 * Call this once at app startup if debugging is needed
 */
export function setupVisibilityDebug(): () => void {
  if (typeof document === "undefined") return () => {};

  const handler = () => {
    debugVisibility("visibilitychange", {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      timestamp: new Date().toISOString(),
    });
  };

  document.addEventListener("visibilitychange", handler);

  // Also track focus/blur
  const focusHandler = () => debugVisibility("window.focus");
  const blurHandler = () => debugVisibility("window.blur");

  window.addEventListener("focus", focusHandler);
  window.addEventListener("blur", blurHandler);

  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("focus", focusHandler);
    window.removeEventListener("blur", blurHandler);
  };
}
