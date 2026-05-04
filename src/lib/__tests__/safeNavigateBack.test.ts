import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeNavigateBack, createSafeBackHandler } from "../safeNavigateBack";

describe("safeNavigateBack", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset history mock
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "",
      configurable: true,
    });
  });

  it("should go back when history is available and referrer exists", () => {
    Object.defineProperty(window, "history", {
      value: { length: 3 },
      writable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "http://example.com",
      configurable: true,
    });

    safeNavigateBack(mockNavigate, { isStaff: false });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("should navigate to /minhas-obras when history is empty for customer", () => {
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
    });

    safeNavigateBack(mockNavigate, { isStaff: false });

    expect(mockNavigate).toHaveBeenCalledWith("/minhas-obras", {
      replace: true,
    });
  });

  it("should navigate to /gestao when history is empty for staff", () => {
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
    });

    safeNavigateBack(mockNavigate, { isStaff: true });

    expect(mockNavigate).toHaveBeenCalledWith("/gestao", { replace: true });
  });

  it("should use custom fallback when provided", () => {
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
    });

    safeNavigateBack(mockNavigate, { fallback: "/custom-fallback" });

    expect(mockNavigate).toHaveBeenCalledWith("/custom-fallback", {
      replace: true,
    });
  });

  it("should fallback when history exists but no referrer", () => {
    Object.defineProperty(window, "history", {
      value: { length: 5 },
      writable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "",
      configurable: true,
    });

    safeNavigateBack(mockNavigate, { isStaff: false });

    expect(mockNavigate).toHaveBeenCalledWith("/minhas-obras", {
      replace: true,
    });
  });
});

describe("createSafeBackHandler", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "",
      configurable: true,
    });
  });

  it("should return a callable function", () => {
    const handler = createSafeBackHandler(mockNavigate, { isStaff: true });

    expect(typeof handler).toBe("function");

    handler();

    expect(mockNavigate).toHaveBeenCalledWith("/gestao", { replace: true });
  });
});
