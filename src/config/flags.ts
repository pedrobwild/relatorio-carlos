import { env } from "./env";

/**
 * Feature flag for demo mode.
 * When true, the app will use seed/mock data as fallback.
 * When false (production), empty states are shown instead.
 */
export const isDemoMode = env.demoMode;
