import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureError,
  captureMessage,
  captureException,
  getErrorBuffer,
  clearErrorBuffer,
  createFeatureErrorCapture,
} from "@/lib/errorMonitoring";

describe("errorMonitoring", () => {
  beforeEach(() => {
    clearErrorBuffer();
  });

  describe("captureError", () => {
    it("captures error and adds to buffer", () => {
      const error = new Error("Test error");
      captureError(error, { feature: "documents" });

      const buffer = getErrorBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe("Test error");
      expect(buffer[0].context.feature).toBe("documents");
    });

    it("sanitizes sensitive fields", () => {
      const error = new Error("Auth failed");
      captureError(error, {
        feature: "auth",
        password: "secret123",
        token: "abc123",
      });

      const buffer = getErrorBuffer();
      expect(buffer[0].context.password).toBe("[REDACTED]");
      expect(buffer[0].context.token).toBe("[REDACTED]");
    });

    it("handles non-Error objects", () => {
      captureError("string error", { feature: "general" });

      const buffer = getErrorBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe("string error");
    });
  });

  describe("captureException", () => {
    it("captures exception with feature context", () => {
      captureException(new Error("Exception test"), {
        feature: "cronograma",
        action: "update_dates",
      });

      const buffer = getErrorBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].context.feature).toBe("cronograma");
      expect(buffer[0].context.action).toBe("update_dates");
    });
  });

  describe("captureMessage", () => {
    it("captures error level messages", () => {
      captureMessage("Critical failure", "error", { feature: "general" });

      const buffer = getErrorBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe("Critical failure");
    });
  });

  describe("createFeatureErrorCapture", () => {
    it("creates scoped capture function", () => {
      const docErrors = createFeatureErrorCapture("documents");
      docErrors.capture(new Error("Upload failed"), { action: "upload" });

      const buffer = getErrorBuffer();
      expect(buffer[0].context.feature).toBe("documents");
      expect(buffer[0].context.action).toBe("upload");
    });
  });

  describe("buffer management", () => {
    it("clears buffer", () => {
      captureError(new Error("Test"), {});
      expect(getErrorBuffer().length).toBe(1);

      clearErrorBuffer();
      expect(getErrorBuffer().length).toBe(0);
    });

    it("limits buffer size", () => {
      // Add more than MAX_BUFFER_SIZE errors
      for (let i = 0; i < 60; i++) {
        captureError(new Error(`Error ${i}`), {});
      }

      const buffer = getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(50);
    });
  });
});
