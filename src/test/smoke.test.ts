/**
 * Smoke Tests
 *
 * Basic tests that verify the app can:
 * 1. Import critical modules without errors
 * 2. Render key components
 * 3. Execute core utilities
 */

import { describe, it, expect, vi } from "vitest";

// Mock Supabase before imports
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe("Module Imports (Smoke)", () => {
  it("imports error logger successfully", async () => {
    const logger = await import("@/lib/errorLogger");
    expect(logger.logError).toBeDefined();
    expect(logger.logInfo).toBeDefined();
    expect(logger.createLogger).toBeDefined();
  });

  it("imports validation schemas successfully", async () => {
    const schemas = await import("@/lib/schemas");
    expect(schemas.emailSchema).toBeDefined();
    expect(schemas.loginSchema).toBeDefined();
    expect(schemas.createProjectSchema).toBeDefined();
    expect(schemas.validateFileUpload).toBeDefined();
  });

  it("imports queryClient successfully", async () => {
    const { queryClient } = await import("@/lib/queryClient");
    expect(queryClient).toBeDefined();
    expect(queryClient.getQueryCache).toBeDefined();
    expect(queryClient.getMutationCache).toBeDefined();
  });

  it("imports utils successfully", async () => {
    const utils = await import("@/lib/utils");
    expect(utils.cn).toBeDefined();
  });
});

describe("Error Logger (Smoke)", () => {
  it("generates correlation IDs", async () => {
    const { generateCorrelationId } = await import("@/lib/errorLogger");

    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("creates scoped loggers", async () => {
    const { createLogger } = await import("@/lib/errorLogger");

    const logger = createLogger("TestComponent");
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it("logs errors without throwing", async () => {
    const { logError } = await import("@/lib/errorLogger");

    // Should not throw
    expect(() => {
      logError("Test error", new Error("Test"), { component: "Test" });
    }).not.toThrow();
  });
});

describe("Activity Status (Smoke)", () => {
  it("imports and calculates status correctly", async () => {
    const { computeEffectiveStatus } = await import("@/lib/activityStatus");

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Test future activity
    const futureActivity = {
      plannedStart: tomorrow.toISOString().split("T")[0],
      plannedEnd: tomorrow.toISOString().split("T")[0],
      actualStart: null,
      actualEnd: null,
    };

    const result = computeEffectiveStatus(futureActivity);
    expect(result.status).toBe("pending");
  });
});

describe("Environment Config (Smoke)", () => {
  it("validates environment configuration", async () => {
    // This should not throw in test environment with mocked env
    const envModule = await import("@/config/env");
    expect(envModule.env).toBeDefined();
  });
});

describe("QueryClient Error Handling (Smoke)", () => {
  it("has configured query and mutation caches", async () => {
    const { queryClient } = await import("@/lib/queryClient");

    const queryCache = queryClient.getQueryCache();
    const mutationCache = queryClient.getMutationCache();

    expect(queryCache).toBeDefined();
    expect(mutationCache).toBeDefined();
  });

  it("has default options configured", async () => {
    const { queryClient } = await import("@/lib/queryClient");

    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries).toBeDefined();
    expect(defaultOptions.mutations).toBeDefined();
  });
});
