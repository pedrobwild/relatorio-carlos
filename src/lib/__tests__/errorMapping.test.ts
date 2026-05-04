import { describe, it, expect } from "vitest";
import {
  mapError,
  getUserMessage,
  isAuthError,
  isForbiddenError,
  isNetworkError,
} from "../errorMapping";

describe("mapError", () => {
  describe("forbidden / RLS", () => {
    it('detects "row level security" message', () => {
      const result = mapError({
        message:
          'new row violates row-level security policy for table "documents"',
      });
      expect(result.kind).toBe("forbidden");
      expect(result.userMessage).not.toMatch(/RLS|policy|row[- ]level/i);
      expect(result.userMessage).toMatch(/permissão/i);
    });

    it('detects bare "RLS" mention', () => {
      expect(mapError("RLS denied").kind).toBe("forbidden");
    });

    it('detects "permission denied"', () => {
      expect(
        mapError({ message: "permission denied for table foo" }).kind,
      ).toBe("forbidden");
    });

    it("detects HTTP 403 status", () => {
      expect(mapError({ status: 403 }).kind).toBe("forbidden");
    });
  });

  describe("auth", () => {
    it("detects JWT expired", () => {
      const r = mapError({ message: "JWT expired" });
      expect(r.kind).toBe("auth");
      expect(r.suggestedAction).toBe("redirect_auth");
      expect(r.userMessage).not.toMatch(/JWT/i);
      expect(r.userMessage).toMatch(/sessão expirou/i);
    });

    it('detects "session expired" wording', () => {
      expect(
        mapError({ message: "Session expired, please re-authenticate" }).kind,
      ).toBe("auth");
    });

    it("detects HTTP 401", () => {
      expect(mapError({ status: 401 }).kind).toBe("auth");
    });

    it('detects "invalid_token"', () => {
      expect(mapError({ message: "invalid_token" }).kind).toBe("auth");
    });
  });

  describe("server / 5xx", () => {
    it("detects HTTP 500", () => {
      expect(mapError({ status: 500 }).kind).toBe("server");
    });

    it('detects "internal server error"', () => {
      expect(mapError({ message: "Internal Server Error" }).kind).toBe(
        "server",
      );
    });

    it('detects "service unavailable"', () => {
      expect(mapError({ message: "Service Unavailable" }).kind).toBe("server");
    });

    it('does not leak "Postgres" or "PGRST" to user message', () => {
      const r = mapError({ message: "PGRST500: postgres internal" });
      expect(r.userMessage).not.toMatch(/postgres|pgrst/i);
    });
  });

  describe("network / offline", () => {
    it('detects "Failed to fetch"', () => {
      const r = mapError({ message: "Failed to fetch" });
      expect(r.kind).toBe("network");
      expect(r.suggestedAction).toBe("retry");
    });

    it('detects "timeout"', () => {
      expect(mapError({ message: "Request timeout" }).kind).toBe("network");
    });

    it('detects "NetworkError"', () => {
      expect(
        mapError({ message: "NetworkError when attempting to fetch resource." })
          .kind,
      ).toBe("network");
    });

    it('detects "offline" keyword', () => {
      expect(mapError({ message: "browser is offline" }).kind).toBe("network");
    });
  });

  describe("conflict / validation", () => {
    it("detects unique constraint (23505)", () => {
      const r = mapError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });
      expect(r.kind).toBe("conflict");
      expect(r.userMessage).toMatch(/já existe/i);
    });

    it("detects foreign key (23503)", () => {
      expect(
        mapError({ code: "23503", message: "foreign key violation" }).kind,
      ).toBe("conflict");
    });

    it("detects not_null_violation (23502)", () => {
      expect(
        mapError({ code: "23502", message: "null value in column" }).kind,
      ).toBe("validation");
    });

    it("detects check_violation (23514)", () => {
      expect(mapError({ code: "23514" }).kind).toBe("validation");
    });
  });

  describe("not_found / storage", () => {
    it("detects HTTP 404", () => {
      expect(mapError({ status: 404 }).kind).toBe("not_found");
    });

    it('detects "object not found"', () => {
      expect(mapError({ message: "Object not found" }).kind).toBe("not_found");
    });

    it("detects HTTP 413", () => {
      expect(mapError({ status: 413 }).kind).toBe("storage");
    });

    it('detects "payload too large"', () => {
      expect(mapError({ message: "Payload too large" }).kind).toBe("storage");
    });
  });

  describe("rate_limit", () => {
    it("detects 429", () => {
      expect(mapError({ status: 429 }).kind).toBe("rate_limit");
    });

    it('detects "too many requests"', () => {
      expect(mapError({ message: "Too Many Requests" }).kind).toBe(
        "rate_limit",
      );
    });
  });

  describe("unknown / fallback", () => {
    it('returns "unknown" for unrecognized errors', () => {
      const r = mapError({ message: "something completely unexpected" });
      expect(r.kind).toBe("unknown");
      expect(r.userMessage).toMatch(/algo não saiu/i);
    });

    it("handles null/undefined gracefully", () => {
      expect(mapError(null).kind).toBe("unknown");
      expect(mapError(undefined).kind).toBe("unknown");
    });

    it("handles plain string input", () => {
      expect(mapError("JWT expired").kind).toBe("auth");
    });

    it("handles Error instances", () => {
      const e = new Error("Failed to fetch");
      expect(mapError(e).kind).toBe("network");
    });
  });

  describe("user-facing messages — no technical leakage", () => {
    const banned = /\b(RLS|JWT|Postgres|PGRST|policy|row[- ]level)\b/i;

    const cases: Array<[string, unknown]> = [
      ["rls", { message: "new row violates row-level security policy" }],
      ["jwt", { message: "JWT expired" }],
      ["postgres", { message: "postgres connection failed" }],
      ["pgrst", { message: "PGRST116 no rows" }],
      ["policy", { message: "policy violation" }],
      ["500", { status: 500, message: "Internal Server Error" }],
      ["network", { message: "Failed to fetch" }],
      ["unique", { code: "23505", message: "duplicate key" }],
    ];

    it.each(cases)(
      "does not leak technical jargon for case: %s",
      (_, error) => {
        const message = getUserMessage(error);
        expect(message).not.toMatch(banned);
      },
    );
  });

  describe("preserves technical details", () => {
    it("keeps original message in technicalDetails", () => {
      const r = mapError({ message: "JWT expired at 2026-01-01" });
      expect(r.technicalDetails).toContain("JWT expired");
    });
  });

  describe("code preservation", () => {
    it("preserves Postgres error code", () => {
      const r = mapError({ code: "23505", message: "duplicate key" });
      expect(r.code).toBe("23505");
    });
  });

  describe("helper sentinels", () => {
    it("isAuthError", () => {
      expect(isAuthError({ message: "JWT expired" })).toBe(true);
      expect(isAuthError({ message: "Failed to fetch" })).toBe(false);
    });

    it("isForbiddenError", () => {
      expect(
        isForbiddenError({ message: "row-level security violation" }),
      ).toBe(true);
      expect(isForbiddenError({ message: "Failed to fetch" })).toBe(false);
    });

    it("isNetworkError", () => {
      expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
      expect(isNetworkError({ message: "JWT expired" })).toBe(false);
    });
  });
});
