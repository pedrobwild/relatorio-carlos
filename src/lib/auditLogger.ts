/**
 * Structured audit logging utility.
 *
 * Wraps inserts into the existing `auditoria` and `domain_events` tables
 * with a type-safe, ergonomic API.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logError, logInfo } from "./errorLogger";

export interface AuditEntry {
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  projectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Log an audit event to the `auditoria` table.
 * Silently swallows errors to never break the calling flow.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const diff =
      entry.before && entry.after
        ? { old: entry.before, new: entry.after }
        : (entry.after ?? entry.before ?? null);

    const { error } = await supabase.from("auditoria").insert([
      {
        acao: entry.action as "create" | "update" | "delete",
        entidade: entry.entityType,
        entidade_id: entry.entityId,
        obra_id: entry.projectId ?? null,
        por_user_id: user.id,
        diff: diff as Json | null,
      },
    ]);

    if (error) {
      logError("Failed to write audit log", error, {
        component: "auditLogger",
      });
    } else {
      logInfo("Audit logged", { component: "auditLogger", ...entry });
    }
  } catch (err) {
    logError("Unexpected error in auditLogger", err, {
      component: "auditLogger",
    });
  }
}

/**
 * Critical audit events that should always be logged.
 * Provides semantic wrappers for common operations.
 */
export const audit = {
  roleChanged: (userId: string, before: string[], after: string[]) =>
    logAudit({
      action: "update",
      entityType: "user_roles",
      entityId: userId,
      before: { roles: before },
      after: { roles: after },
    }),

  userCreated: (userId: string, email: string, role: string) =>
    logAudit({
      action: "create",
      entityType: "user",
      entityId: userId,
      after: { email, role },
    }),

  userDeleted: (userId: string, email: string) =>
    logAudit({
      action: "delete",
      entityType: "user",
      entityId: userId,
      before: { email },
    }),

  projectStatusChanged: (projectId: string, before: string, after: string) =>
    logAudit({
      action: "update",
      entityType: "project",
      entityId: projectId,
      projectId,
      before: { status: before },
      after: { status: after },
    }),

  membershipChanged: (
    projectId: string,
    userId: string,
    action: "create" | "delete",
    role?: string,
  ) =>
    logAudit({
      action,
      entityType: "project_member",
      entityId: userId,
      projectId,
      after: action === "create" ? { role } : undefined,
    }),

  invitationSent: (invitationId: string, email: string, role: string) =>
    logAudit({
      action: "create",
      entityType: "invitation",
      entityId: invitationId,
      after: { email, role },
    }),

  featureFlagToggled: (key: string, enabled: boolean) =>
    logAudit({
      action: "update",
      entityType: "feature_flag",
      entityId: key,
      after: { enabled },
    }),
};
