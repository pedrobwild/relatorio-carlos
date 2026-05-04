import { describe, it, expect } from "vitest";
import {
  parseLocalDate,
  getTodayLocal,
  computeEffectiveStatus,
  validateDateRange,
  validateProgress,
} from "../activityStatus";

describe("parseLocalDate", () => {
  it("should parse YYYY-MM-DD to Date at midnight local time", () => {
    const date = parseLocalDate("2025-07-15");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(6); // July (0-indexed)
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("should not shift day due to timezone", () => {
    // This was a common bug: new Date('2025-07-15') could become July 14 in some timezones
    const date = parseLocalDate("2025-01-01");
    expect(date.getDate()).toBe(1);
  });
});

describe("computeEffectiveStatus", () => {
  // Fixed reference date for testing: 2025-07-20
  const referenceDate = new Date(2025, 6, 20); // July 20, 2025

  describe("COMPLETED status", () => {
    it("should return completed when actualEnd is set", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-01",
          plannedEnd: "2025-07-10",
          actualStart: "2025-07-01",
          actualEnd: "2025-07-10",
        },
        referenceDate,
      );

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
      expect(result.isDelayedAuto).toBe(false);
    });

    it("should calculate delay days for late completion", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-01",
          plannedEnd: "2025-07-10",
          actualStart: "2025-07-01",
          actualEnd: "2025-07-15", // 5 days late
        },
        referenceDate,
      );

      expect(result.status).toBe("completed");
      expect(result.delayDays).toBe(5);
    });

    it("should not report delay for early completion", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-01",
          plannedEnd: "2025-07-10",
          actualStart: "2025-07-01",
          actualEnd: "2025-07-08", // 2 days early
        },
        referenceDate,
      );

      expect(result.status).toBe("completed");
      expect(result.delayDays).toBe(0);
    });
  });

  describe("IN-PROGRESS status", () => {
    it("should return in-progress when started but not finished", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-15",
          plannedEnd: "2025-07-25",
          actualStart: "2025-07-15",
          actualEnd: null,
        },
        referenceDate,
      );

      expect(result.status).toBe("in-progress");
      expect(result.progress).toBeGreaterThan(0);
      expect(result.progress).toBeLessThan(100);
    });

    it("should become delayed if past planned end date", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-01",
          plannedEnd: "2025-07-15", // Past the reference date
          actualStart: "2025-07-01",
          actualEnd: null,
        },
        referenceDate,
      );

      expect(result.status).toBe("delayed");
      expect(result.isDelayedAuto).toBe(true);
      expect(result.delayDays).toBe(5); // 5 days past plannedEnd
    });
  });

  describe("PENDING status", () => {
    it("should return pending when not started and future", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-25", // Future date
          plannedEnd: "2025-07-30",
          actualStart: null,
          actualEnd: null,
        },
        referenceDate,
      );

      expect(result.status).toBe("pending");
      expect(result.progress).toBe(0);
      expect(result.isDelayedAuto).toBe(false);
    });

    it("should become delayed if should have started", () => {
      const result = computeEffectiveStatus(
        {
          plannedStart: "2025-07-10", // Past the reference date
          plannedEnd: "2025-07-25",
          actualStart: null,
          actualEnd: null,
        },
        referenceDate,
      );

      expect(result.status).toBe("delayed");
      expect(result.isDelayedAuto).toBe(true);
      expect(result.delayDays).toBe(10); // 10 days since plannedStart
    });
  });
});

describe("validateDateRange", () => {
  it("should return true for valid range", () => {
    expect(validateDateRange("2025-07-01", "2025-07-10")).toBe(true);
  });

  it("should return true for same start and end", () => {
    expect(validateDateRange("2025-07-01", "2025-07-01")).toBe(true);
  });

  it("should return false for invalid range", () => {
    expect(validateDateRange("2025-07-10", "2025-07-01")).toBe(false);
  });

  it("should return true for empty dates", () => {
    expect(validateDateRange("", "")).toBe(true);
    expect(validateDateRange("2025-07-01", "")).toBe(true);
  });
});

describe("validateProgress", () => {
  it("should return true for valid progress", () => {
    expect(validateProgress(0)).toBe(true);
    expect(validateProgress(50)).toBe(true);
    expect(validateProgress(100)).toBe(true);
  });

  it("should return false for invalid progress", () => {
    expect(validateProgress(-1)).toBe(false);
    expect(validateProgress(101)).toBe(false);
  });
});
