import { describe, it, expect } from "vitest";
import {
  can,
  canAny,
  canAll,
  getFeaturesForRole,
  type Feature,
} from "../permissions";

describe("permissions", () => {
  describe("can()", () => {
    it("returns false for null role", () => {
      expect(can(null, "documents:view")).toBe(false);
    });

    it("allows customer to view documents", () => {
      expect(can("customer", "documents:view")).toBe(true);
    });

    it("denies customer from uploading documents", () => {
      expect(can("customer", "documents:upload")).toBe(false);
    });

    it("allows engineer to upload documents", () => {
      expect(can("engineer", "documents:upload")).toBe(true);
    });

    it("allows admin all features", () => {
      expect(can("admin", "documents:delete")).toBe(true);
      expect(can("admin", "users:delete")).toBe(true);
      expect(can("admin", "admin:manage_system")).toBe(true);
    });

    it("allows engineer to delete documents", () => {
      expect(can("engineer", "documents:delete")).toBe(true);
    });

    it("allows manager to view audit", () => {
      expect(can("manager", "admin:view_audit")).toBe(true);
    });

    it("allows engineer to view audit", () => {
      expect(can("engineer", "admin:view_audit")).toBe(true);
    });
  });

  describe("canAny()", () => {
    it("returns true if any role has permission", () => {
      expect(canAny(["customer", "engineer"], "schedule:edit")).toBe(true);
    });

    it("returns false if no role has permission", () => {
      expect(canAny(["customer"], "documents:upload")).toBe(false);
    });

    it("handles empty roles array", () => {
      expect(canAny([], "documents:view")).toBe(false);
    });
  });

  describe("canAll()", () => {
    it("returns true if roles have all features", () => {
      expect(
        canAll(
          ["admin"],
          ["documents:view", "documents:upload", "documents:delete"],
        ),
      ).toBe(true);
    });

    it("returns false if roles missing any feature", () => {
      expect(canAll(["customer"], ["documents:view", "documents:upload"])).toBe(
        false,
      );
    });

    it("handles multi-role users", () => {
      expect(
        canAll(["customer", "engineer"], ["documents:view", "schedule:edit"]),
      ).toBe(true);
    });
  });

  describe("getFeaturesForRole()", () => {
    it("returns features for customer", () => {
      const features = getFeaturesForRole("customer");
      expect(features).toContain("documents:view");
      expect(features).toContain("formalizations:sign");
      expect(features).not.toContain("documents:upload");
    });

    it("returns features for admin", () => {
      const features = getFeaturesForRole("admin");
      expect(features).toContain("admin:manage_system");
      expect(features).toContain("users:delete");
    });
  });

  describe("role hierarchy", () => {
    it("engineer has more permissions than customer", () => {
      const customerFeatures = getFeaturesForRole("customer");
      const engineerFeatures = getFeaturesForRole("engineer");

      expect(engineerFeatures.length).toBeGreaterThan(customerFeatures.length);
    });

    it("manager has at least as many permissions as engineer", () => {
      const engineerFeatures = getFeaturesForRole("engineer");
      const managerFeatures = getFeaturesForRole("manager");

      // Current matrix grants engineer/manager/admin the same broad scope.
      // This invariant only requires manager >= engineer; tighten if the
      // matrix later differentiates them.
      expect(managerFeatures.length).toBeGreaterThanOrEqual(
        engineerFeatures.length,
      );
    });

    it("admin has all permissions", () => {
      const adminFeatures = getFeaturesForRole("admin");
      const managerFeatures = getFeaturesForRole("manager");

      expect(adminFeatures.length).toBeGreaterThanOrEqual(
        managerFeatures.length,
      );
    });
  });

  describe("specific feature checks", () => {
    const testCases: Array<{
      role: "customer" | "engineer" | "manager" | "admin";
      feature: Feature;
      expected: boolean;
    }> = [
      // Customer permissions
      { role: "customer", feature: "formalizations:sign", expected: true },
      { role: "customer", feature: "formalizations:create", expected: false },
      { role: "customer", feature: "journey:complete_todos", expected: true },
      { role: "customer", feature: "journey:edit_stages", expected: false },

      // Engineer permissions (currently equal scope to manager/admin)
      { role: "engineer", feature: "formalizations:create", expected: true },
      { role: "engineer", feature: "schedule:edit", expected: true },
      { role: "engineer", feature: "projects:delete", expected: true },

      // Manager permissions (currently equal scope to engineer/admin)
      { role: "manager", feature: "purchases:delete", expected: true },
      { role: "manager", feature: "admin:view_audit", expected: true },
      { role: "manager", feature: "admin:manage_system", expected: true },

      // Admin permissions
      { role: "admin", feature: "admin:manage_system", expected: true },
      { role: "admin", feature: "projects:delete", expected: true },
    ];

    testCases.forEach(({ role, feature, expected }) => {
      it(`${role} ${expected ? "can" : "cannot"} ${feature}`, () => {
        expect(can(role, feature)).toBe(expected);
      });
    });
  });
});
