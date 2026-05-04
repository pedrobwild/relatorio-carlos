/**
 * Telemetry module for tracking critical user events
 *
 * Events are logged to console and optionally persisted to database.
 * This provides visibility into user behavior and helps debug issues.
 */

import { supabase } from "@/integrations/supabase/client";
import { logInfo, logError } from "./errorLogger";

export type TelemetryEvent =
  | "export_pdf"
  | "upload_file"
  | "approve_document"
  | "update_activity_dates"
  | "create_formalizacao"
  | "sign_formalizacao"
  | "void_formalizacao"
  | "save_schedule"
  | "import_schedule"
  | "save_baseline"
  | "create_purchase"
  | "mark_payment_paid"
  | "upload_boleto"
  | "complete_onboarding_step"
  | "book_meeting_slot"
  | "create_project"
  | "duplicate_project"
  | "delete_project"
  | "login"
  | "logout"
  | "page_view"
  // New foundation events
  | "search_used"
  | "filter_changed"
  | "bulk_action_used"
  | "role_changed"
  | "invitation_sent"
  | "invitation_resent"
  | "invitation_revoked"
  | "feature_flag_toggled"
  | "permission_override_set";

export interface TelemetryPayload {
  /** Event-specific properties */
  [key: string]: unknown;
}

interface TrackOptions {
  /** Persist to database (default: false - only console log) */
  persist?: boolean;
  /** Project ID for context */
  projectId?: string;
  /** Entity type for audit trail */
  entityType?: string;
  /** Entity ID for audit trail */
  entityId?: string;
}

// Cache user ID to avoid async lookups on every event
let cachedUserId: string | null = null;

async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  cachedUserId = user?.id ?? null;
  return cachedUserId;
}

// Clear cache on auth state change
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    cachedUserId = null;
  }
});

/**
 * Track a telemetry event
 *
 * @param event - The event name
 * @param payload - Event-specific properties
 * @param options - Tracking options
 */
export async function track(
  event: TelemetryEvent,
  payload: TelemetryPayload = {},
  options: TrackOptions = {},
): Promise<void> {
  const timestamp = new Date().toISOString();
  const userId = await getUserId();

  const eventData = {
    event,
    timestamp,
    userId: userId ?? undefined,
    projectId: options.projectId,
    ...payload,
  };

  // Always log to console in development
  if (import.meta.env.DEV) {
    console.log("[Telemetry]", event, eventData);
  }

  // Log to structured logger
  logInfo(`Telemetry: ${event}`, {
    component: "telemetry",
    ...eventData,
  });

  // Optionally persist to database via auditoria table
  if (options.persist && options.entityType && options.entityId) {
    try {
      // Map telemetry events to audit actions
      const actionMap: Record<string, string> = {
        create_formalizacao: "create",
        approve_document: "update",
        upload_file: "create",
        sign_formalizacao: "update",
        void_formalizacao: "update",
        update_activity_dates: "update",
        save_schedule: "update",
        create_purchase: "create",
        mark_payment_paid: "update",
        create_project: "create",
        duplicate_project: "create",
        delete_project: "delete",
      };

      const acao = actionMap[event];

      if (acao && userId) {
        // Convert payload to JSON-compatible format
        const diffData = JSON.parse(JSON.stringify(payload));

        const { error } = await supabase.from("auditoria").insert([
          {
            acao: acao as "create" | "update" | "delete",
            entidade: options.entityType,
            entidade_id: options.entityId,
            obra_id: options.projectId ?? null,
            por_user_id: userId,
            diff: diffData,
          },
        ]);

        if (error) {
          logError("Failed to persist telemetry event", error, {
            component: "telemetry",
            event,
          });
        }
      }
    } catch (err) {
      logError("Error persisting telemetry", err, {
        component: "telemetry",
        event,
      });
    }
  }
}

/**
 * Track a page view
 */
export function trackPageView(path: string, projectId?: string): void {
  track("page_view", { path }, { projectId });
}

/**
 * Create a scoped tracker for a specific project
 */
export function createProjectTracker(projectId: string) {
  return {
    track: (
      event: TelemetryEvent,
      payload: TelemetryPayload = {},
      options: Omit<TrackOptions, "projectId"> = {},
    ) => track(event, payload, { ...options, projectId }),
  };
}
