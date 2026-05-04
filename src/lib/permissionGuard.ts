/**
 * Centralised permission guard utilities.
 *
 * These are pure functions that operate on role arrays and permission maps
 * so they can be used in hooks, components, and tests without side-effects.
 */

import type { AppRole } from "@/hooks/useUserRole";
import type { ModulePermission, ProjectPermission } from "@/types/permissions";

// ── Module-level permission matrix ──────────────────────────────────────────

const MODULE_PERMISSIONS: Record<AppRole, ModulePermission[]> = {
  customer: ["works:read"],
  engineer: [
    "users:read",
    "users:write",
    "users:delete",
    "works:read",
    "works:write",
    "works:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "system:admin",
  ],
  manager: [
    "users:read",
    "users:write",
    "works:read",
    "works:write",
    "works:delete",
    "templates:read",
    "templates:write",
  ],
  admin: [
    "users:read",
    "users:write",
    "users:delete",
    "works:read",
    "works:write",
    "works:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "system:admin",
  ],
  gestor: [
    "users:read",
    "users:write",
    "users:delete",
    "works:read",
    "works:write",
    "works:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "system:admin",
  ],
  suprimentos: ["works:read", "works:write"],
  financeiro: ["works:read"],
  cs: [
    "users:read",
    "users:write",
    "users:delete",
    "works:read",
    "works:write",
    "works:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "system:admin",
  ],
  arquitetura: [
    "users:read",
    "users:write",
    "works:read",
    "works:write",
    "works:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "system:admin",
  ],
};

/**
 * Check if any of the given roles grants a module-level permission.
 */
export function hasModulePermission(
  roles: AppRole[],
  permission: ModulePermission,
): boolean {
  return roles.some((role) => MODULE_PERMISSIONS[role]?.includes(permission));
}

/**
 * Check if any of the given roles grants ALL listed module permissions.
 */
export function hasAllModulePermissions(
  roles: AppRole[],
  permissions: ModulePermission[],
): boolean {
  return permissions.every((p) => hasModulePermission(roles, p));
}

// ── Project-scoped permission helpers (use with DB overrides) ───────────────

/**
 * Default project permissions by project role.
 * These are granted automatically via project_members.role.
 */
const DEFAULT_PROJECT_PERMISSIONS: Record<string, ProjectPermission[]> = {
  owner: [
    "obra:read",
    "obra:write",
    "obra:manage_members",
    "obra:manage_documents",
    "obra:manage_schedule",
    "obra:manage_finances",
    "obra:manage_formalizations",
  ],
  engineer: [
    "obra:read",
    "obra:write",
    "obra:manage_documents",
    "obra:manage_schedule",
    "obra:manage_finances",
    "obra:manage_formalizations",
  ],
  viewer: ["obra:read"],
};

/**
 * Check project-scoped permission considering role defaults and DB overrides.
 *
 * @param projectRole  - The user's role on the project (from project_members)
 * @param permission   - The permission to check
 * @param overrides    - Explicit DB overrides (from project_member_permissions)
 */
export function hasProjectPermission(
  projectRole: string | null,
  permission: ProjectPermission,
  overrides: Record<string, boolean> = {},
): boolean {
  // Explicit override takes priority
  if (permission in overrides) {
    return overrides[permission];
  }

  // Fall back to role defaults
  if (!projectRole) return false;
  return (
    DEFAULT_PROJECT_PERMISSIONS[projectRole]?.includes(permission) ?? false
  );
}

// ── Guards for use in route / component level ───────────────────────────────

export interface PermissionContext {
  roles: AppRole[];
  projectRole?: string | null;
  projectOverrides?: Record<string, boolean>;
}

/**
 * Unified guard: checks module permission OR project-scoped permission.
 * Admin role always passes.
 */
export function checkPermission(
  ctx: PermissionContext,
  permission: ModulePermission | ProjectPermission,
): boolean {
  // Admin bypass
  if (ctx.roles.includes("admin")) return true;

  // Try module permission first
  if (isModulePermission(permission)) {
    return hasModulePermission(ctx.roles, permission);
  }

  // Project permission
  return hasProjectPermission(
    ctx.projectRole ?? null,
    permission as ProjectPermission,
    ctx.projectOverrides,
  );
}

function isModulePermission(p: string): p is ModulePermission {
  return (
    p.startsWith("users:") ||
    p.startsWith("works:") ||
    p.startsWith("templates:") ||
    p === "system:admin"
  );
}
