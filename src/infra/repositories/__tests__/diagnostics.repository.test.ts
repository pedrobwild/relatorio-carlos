/**
 * Diagnostics Repository Tests
 *
 * Unit tests for the health-check diagnostics helpers.
 */

import { describe, it, expect, vi } from "vitest";
import { deriveRlsStatus, type RlsCheckResult } from "../diagnostics.repository";

// The repository module imports the Supabase client at load time; mock it so
// importing the pure helper doesn't require real env / network.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

const mk = (passed: boolean[]): RlsCheckResult["checks"] =>
  passed.map((p, i) => ({ name: `check-${i}`, passed: p, details: "" }));

describe("deriveRlsStatus", () => {
  it("returns 'ok' when every check passed", () => {
    expect(deriveRlsStatus(mk([true, true, true, true]))).toBe("ok");
  });

  it("returns 'fail' when every check failed", () => {
    expect(deriveRlsStatus(mk([false, false, false, false]))).toBe("fail");
  });

  it("returns 'warn' when checks are mixed (regression: 'fail' used to shadow this)", () => {
    expect(deriveRlsStatus(mk([true, false, true, true]))).toBe("warn");
    expect(deriveRlsStatus(mk([false, true, false, false]))).toBe("warn");
  });

  it("returns 'warn' for an empty check list", () => {
    expect(deriveRlsStatus([])).toBe("warn");
  });

  it("reaches every possible status (no unreachable branch)", () => {
    const statuses = new Set([
      deriveRlsStatus(mk([true, true])),
      deriveRlsStatus(mk([false, false])),
      deriveRlsStatus(mk([true, false])),
    ]);
    expect(statuses).toEqual(new Set(["ok", "fail", "warn"]));
  });
});
