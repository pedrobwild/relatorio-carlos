import { describe, it, expect } from "vitest";
import {
  hasModulePermission,
  hasAllModulePermissions,
  hasProjectPermission,
  checkPermission,
} from "@/lib/permissionGuard";

describe("permissionGuard", () => {
  // ── Module permissions ──────────────────────────────────────────────────

  describe("hasModulePermission", () => {
    it("admin has system:admin", () => {
      expect(hasModulePermission(["admin"], "system:admin")).toBe(true);
    });

    it("customer does NOT have users:write", () => {
      expect(hasModulePermission(["customer"], "users:write")).toBe(false);
    });

    it("engineer has works:read", () => {
      expect(hasModulePermission(["engineer"], "works:read")).toBe(true);
    });

    it("manager has works:delete", () => {
      expect(hasModulePermission(["manager"], "works:delete")).toBe(true);
    });

    it("multi-role checks any", () => {
      expect(hasModulePermission(["customer", "engineer"], "works:write")).toBe(
        true,
      );
    });

    it("empty roles returns false", () => {
      expect(hasModulePermission([], "works:read")).toBe(false);
    });
  });

  describe("hasAllModulePermissions", () => {
    it("admin has all permissions", () => {
      expect(
        hasAllModulePermissions(
          ["admin"],
          ["users:read", "users:write", "system:admin"],
        ),
      ).toBe(true);
    });

    it("manager lacks users:delete (engineer/manager are intentionally different here)", () => {
      // engineer/admin/cs/gestor have users:delete; manager does not.
      expect(
        hasAllModulePermissions(["manager"], ["users:read", "users:delete"]),
      ).toBe(false);
    });
  });

  // ── Project permissions ─────────────────────────────────────────────────

  describe("hasProjectPermission", () => {
    it("owner has obra:manage_members", () => {
      expect(hasProjectPermission("owner", "obra:manage_members")).toBe(true);
    });

    it("viewer only has obra:read", () => {
      expect(hasProjectPermission("viewer", "obra:read")).toBe(true);
      expect(hasProjectPermission("viewer", "obra:write")).toBe(false);
    });

    it("null role returns false", () => {
      expect(hasProjectPermission(null, "obra:read")).toBe(false);
    });

    it("DB override grants permission not in role default", () => {
      expect(
        hasProjectPermission("viewer", "obra:write", { "obra:write": true }),
      ).toBe(true);
    });

    it("DB override revokes permission from role default", () => {
      expect(
        hasProjectPermission("owner", "obra:write", { "obra:write": false }),
      ).toBe(false);
    });
  });

  // ── Unified guard ───────────────────────────────────────────────────────

  describe("checkPermission", () => {
    it("admin bypasses all checks", () => {
      expect(checkPermission({ roles: ["admin"] }, "users:delete")).toBe(true);
      expect(
        checkPermission(
          { roles: ["admin"], projectRole: "viewer" },
          "obra:write",
        ),
      ).toBe(true);
    });

    it("customer cannot write works", () => {
      expect(checkPermission({ roles: ["customer"] }, "works:write")).toBe(
        false,
      );
    });

    it("engineer with project role can write obra", () => {
      expect(
        checkPermission(
          { roles: ["engineer"], projectRole: "engineer" },
          "obra:write",
        ),
      ).toBe(true);
    });
  });
});
