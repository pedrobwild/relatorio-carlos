/**
 * Granular permission types for module-level and project-scoped access control.
 *
 * These types complement the existing Feature-based matrix in config/permissions.ts
 * by adding support for project-scoped overrides stored in the DB.
 */

/** Module-level permissions (global scope) */
export type ModulePermission =
  | "users:read"
  | "users:write"
  | "users:delete"
  | "works:read"
  | "works:write"
  | "works:delete"
  | "templates:read"
  | "templates:write"
  | "templates:delete"
  | "system:admin";

/** Project-scoped permissions (per-obra) */
export type ProjectPermission =
  | "obra:read"
  | "obra:write"
  | "obra:manage_members"
  | "obra:manage_documents"
  | "obra:manage_schedule"
  | "obra:manage_finances"
  | "obra:manage_formalizations";

/** Union of all permission strings */
export type Permission = ModulePermission | ProjectPermission;

/** Invitation entity */
export interface Invitation {
  id: string;
  email: string;
  role: string;
  project_id: string | null;
  project_role: string | null;
  invited_by: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Feature flag entity */
export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Known feature flag keys (type-safe access) */
export type FeatureFlagKey =
  | "enableListViewWorks"
  | "enableBulkActions"
  | "enableInvitations"
  | "enableAdvancedFilters"
  | "enableDocumentReviews";

/** Project member permission override */
export interface ProjectMemberPermission {
  id: string;
  project_id: string;
  user_id: string;
  permission: string;
  granted: boolean;
  granted_by: string | null;
  created_at: string;
}

/** Audit log entry (normalized interface) */
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  projectId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
}
