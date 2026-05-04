/**
 * Tests for Query Keys
 */

import { describe, it, expect } from "vitest";
import { queryKeys } from "../queryKeys";

describe("queryKeys", () => {
  describe("projects", () => {
    it("should return correct base key", () => {
      expect(queryKeys.projects.all).toEqual(["projects"]);
    });

    it("should return correct list key", () => {
      expect(queryKeys.projects.lists()).toEqual(["projects", "list"]);
    });

    it("should return correct list key with filters", () => {
      const result = queryKeys.projects.list({ status: "active" });
      expect(result).toEqual(["projects", "list", { status: "active" }]);
    });

    it("should return correct detail key", () => {
      const projectId = "test-project-id";
      expect(queryKeys.projects.detail(projectId)).toEqual([
        "projects",
        "detail",
        projectId,
      ]);
    });

    it("should handle undefined project id", () => {
      expect(queryKeys.projects.detail(undefined)).toEqual([
        "projects",
        "detail",
        undefined,
      ]);
    });
  });

  describe("documents", () => {
    it("should return correct base key", () => {
      expect(queryKeys.documents.all).toEqual(["documents"]);
    });

    it("should return correct list key with project id", () => {
      const projectId = "project-123";
      expect(queryKeys.documents.list(projectId)).toEqual([
        "documents",
        "list",
        projectId,
      ]);
    });

    it("should return correct category key", () => {
      const projectId = "project-123";
      const category = "contrato";
      expect(queryKeys.documents.byCategory(projectId, category)).toEqual([
        "documents",
        "list",
        projectId,
        "category",
        category,
      ]);
    });

    it("should return correct versions key", () => {
      const docId = "doc-123";
      expect(queryKeys.documents.versions(docId)).toEqual([
        "documents",
        "versions",
        docId,
      ]);
    });
  });

  describe("activities", () => {
    it("should return correct list key", () => {
      const projectId = "project-123";
      expect(queryKeys.activities.list(projectId)).toEqual([
        "activities",
        "list",
        projectId,
      ]);
    });

    it("should return correct baseline key", () => {
      const projectId = "project-123";
      expect(queryKeys.activities.baseline(projectId)).toEqual([
        "activities",
        "baseline",
        projectId,
      ]);
    });
  });

  describe("formalizacoes", () => {
    it("should return correct base key", () => {
      expect(queryKeys.formalizacoes.all).toEqual(["formalizacoes"]);
    });

    it("should return correct list key with filters", () => {
      const filters = { projectId: "p1", status: "draft" };
      expect(queryKeys.formalizacoes.list(filters)).toEqual([
        "formalizacoes",
        "list",
        filters,
      ]);
    });

    it("should return correct detail key", () => {
      const id = "form-123";
      expect(queryKeys.formalizacoes.detail(id)).toEqual([
        "formalizacoes",
        "detail",
        id,
      ]);
    });

    it("should return correct parties key", () => {
      const id = "form-123";
      expect(queryKeys.formalizacoes.parties(id)).toEqual([
        "formalizacoes",
        "parties",
        id,
      ]);
    });
  });

  describe("payments", () => {
    it("should return correct base key matching existing hook", () => {
      // The existing hook uses 'project-payments' as the base key
      expect(queryKeys.payments.all).toEqual(["project-payments"]);
    });

    it("should return correct list key", () => {
      const projectId = "project-123";
      expect(queryKeys.payments.list(projectId)).toEqual([
        "project-payments",
        "list",
        projectId,
      ]);
    });
  });

  describe("pendingItems", () => {
    it("should return correct base key matching existing hook", () => {
      // The existing hook uses 'pending-items' as the base key
      expect(queryKeys.pendingItems.all).toEqual(["pending-items"]);
    });

    it("should return correct list key with options", () => {
      expect(queryKeys.pendingItems.list("project-1", true)).toEqual([
        "pending-items",
        "list",
        "project-1",
        true,
      ]);
    });

    it("should return correct stats key", () => {
      expect(queryKeys.pendingItems.stats("project-1")).toEqual([
        "pending-items",
        "stats",
        "project-1",
      ]);
    });
  });

  describe("auditoria", () => {
    it("should return correct entity trail key", () => {
      expect(queryKeys.auditoria.entityTrail("documents", "doc-123")).toEqual([
        "audits",
        "entity-trail",
        "documents",
        "doc-123",
      ]);
    });

    it("should return correct entity types key", () => {
      expect(queryKeys.auditoria.entityTypes()).toEqual([
        "audits",
        "entity-types",
      ]);
    });
  });

  describe("users", () => {
    it("should return correct profile key", () => {
      const userId = "user-123";
      expect(queryKeys.users.profile(userId)).toEqual([
        "users",
        "profile",
        userId,
      ]);
    });

    it("should return correct role key", () => {
      const userId = "user-123";
      expect(queryKeys.users.role(userId)).toEqual(["users", "role", userId]);
    });

    it("should return correct current user key", () => {
      expect(queryKeys.users.current()).toEqual(["users", "current"]);
    });
  });

  describe("journey", () => {
    it("should return correct config key", () => {
      const projectId = "project-123";
      expect(queryKeys.journey.config(projectId)).toEqual([
        "journey",
        "config",
        projectId,
      ]);
    });

    it("should return correct slots key", () => {
      const stageId = "stage-123";
      expect(queryKeys.journey.slots(stageId)).toEqual([
        "journey",
        "slots",
        stageId,
      ]);
    });
  });

  describe("key hierarchy for invalidation", () => {
    it("should allow invalidating all documents when only base key is used", () => {
      // When we invalidate ['documents'], all these should be affected:
      const baseKey = queryKeys.documents.all;
      const listKey = queryKeys.documents.list("p1");
      const detailKey = queryKeys.documents.detail("d1");

      // All derived keys should start with the base key
      expect(listKey.slice(0, baseKey.length)).toEqual(baseKey);
      expect(detailKey.slice(0, baseKey.length)).toEqual(baseKey);
    });

    it("should allow invalidating project-specific documents", () => {
      // When we invalidate ['documents', 'list', 'project-1'], only that project's list is affected
      const projectKey = queryKeys.documents.list("project-1");
      const otherProjectKey = queryKeys.documents.list("project-2");

      expect(projectKey).not.toEqual(otherProjectKey);
      expect(projectKey[2]).toBe("project-1");
      expect(otherProjectKey[2]).toBe("project-2");
    });
  });
});
