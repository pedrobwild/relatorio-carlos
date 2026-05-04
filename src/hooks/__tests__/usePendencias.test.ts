import { describe, it, expect } from "vitest";
import { getStatus, getDaysOverdue, getDaysRemaining } from "../usePendencias";

describe("usePendencias - date handling", () => {
  describe("getStatus", () => {
    it('should return "pendente" for empty string dueDate', () => {
      expect(getStatus("")).toBe("pendente");
    });

    it('should return "pendente" for invalid date string', () => {
      expect(getStatus("not-a-date")).toBe("pendente");
    });

    it('should return "atrasado" for past dates', () => {
      const pastDate = "2020-01-01";
      expect(getStatus(pastDate)).toBe("atrasado");
    });

    it('should return "urgente" for dates within 2 days', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      expect(getStatus(tomorrowStr)).toBe("urgente");
    });

    it('should return "pendente" for dates more than 2 days away', () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 10);
      const futureStr = future.toISOString().split("T")[0];
      expect(getStatus(futureStr)).toBe("pendente");
    });
  });

  describe("getDaysOverdue", () => {
    it("should return 0 for empty dueDate", () => {
      const item = { id: "1", dueDate: "", type: "decision" as const } as any;
      // getDaysOverdue expects valid date, empty string returns NaN -> 0
      const result = getDaysOverdue(item);
      expect(result).toBe(0);
    });

    it("should return positive number for past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const item = {
        id: "1",
        dueDate: pastDate.toISOString().split("T")[0],
      } as any;
      expect(getDaysOverdue(item)).toBeGreaterThanOrEqual(4); // Allow for timezone edge cases
    });

    it("should return 0 for future dates", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const item = {
        id: "1",
        dueDate: futureDate.toISOString().split("T")[0],
      } as any;
      expect(getDaysOverdue(item)).toBe(0);
    });
  });

  describe("getDaysRemaining", () => {
    it("should return positive for future dates", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const item = {
        id: "1",
        dueDate: futureDate.toISOString().split("T")[0],
      } as any;
      expect(getDaysRemaining(item)).toBeGreaterThanOrEqual(4);
    });

    it("should return negative for past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const item = {
        id: "1",
        dueDate: pastDate.toISOString().split("T")[0],
      } as any;
      expect(getDaysRemaining(item)).toBeLessThan(0);
    });
  });
});
