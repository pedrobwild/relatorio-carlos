import { describe, expect, it } from "vitest";
import { maskBRDate, parseFlexibleBRDate } from "../dates";

describe("maskBRDate", () => {
  it("returns empty for null/undefined/empty", () => {
    expect(maskBRDate(null)).toBe("");
    expect(maskBRDate(undefined)).toBe("");
    expect(maskBRDate("")).toBe("");
  });

  it("keeps up to two digits without separators", () => {
    expect(maskBRDate("1")).toBe("1");
    expect(maskBRDate("12")).toBe("12");
  });

  it("inserts the first slash after day", () => {
    expect(maskBRDate("123")).toBe("12/3");
    expect(maskBRDate("1234")).toBe("12/34");
  });

  it("inserts both slashes for a complete date", () => {
    expect(maskBRDate("12345")).toBe("12/34/5");
    expect(maskBRDate("12345678")).toBe("12/34/5678");
  });

  it("strips non-digit characters", () => {
    expect(maskBRDate("12abc34xy5678")).toBe("12/34/5678");
    expect(maskBRDate("12/34/5678")).toBe("12/34/5678");
  });

  it("caps at 8 digits, dropping extras", () => {
    expect(maskBRDate("123456789999")).toBe("12/34/5678");
  });
});

describe("parseFlexibleBRDate", () => {
  it("returns null for empty/whitespace/nullish", () => {
    expect(parseFlexibleBRDate(null)).toBeNull();
    expect(parseFlexibleBRDate(undefined)).toBeNull();
    expect(parseFlexibleBRDate("")).toBeNull();
    expect(parseFlexibleBRDate("   ")).toBeNull();
  });

  it("parses dd/MM/yyyy", () => {
    expect(parseFlexibleBRDate("23/04/2025")).toBe("2025-04-23");
    expect(parseFlexibleBRDate("01/01/2024")).toBe("2024-01-01");
  });

  it("parses dd-MM-yy expanding to 20yy", () => {
    expect(parseFlexibleBRDate("23-04-25")).toBe("2025-04-23");
    expect(parseFlexibleBRDate("05-12-30")).toBe("2030-12-05");
  });

  it("parses dd.MM.yyyy", () => {
    expect(parseFlexibleBRDate("23.04.2025")).toBe("2025-04-23");
  });

  it("parses ISO yyyy-MM-dd", () => {
    expect(parseFlexibleBRDate("2025-04-23")).toBe("2025-04-23");
    expect(parseFlexibleBRDate("2024-02-29")).toBe("2024-02-29");
  });

  it("trims surrounding whitespace", () => {
    expect(parseFlexibleBRDate("  23/04/2025  ")).toBe("2025-04-23");
  });

  it("rejects calendar-invalid dates", () => {
    expect(parseFlexibleBRDate("31/02/2025")).toBeNull();
    expect(parseFlexibleBRDate("31/04/2025")).toBeNull();
    expect(parseFlexibleBRDate("29/02/2025")).toBeNull(); // not a leap year
    expect(parseFlexibleBRDate("2025-02-31")).toBeNull();
  });

  it("rejects out-of-range months and days", () => {
    expect(parseFlexibleBRDate("00/01/2025")).toBeNull();
    expect(parseFlexibleBRDate("15/13/2025")).toBeNull();
    expect(parseFlexibleBRDate("15/00/2025")).toBeNull();
  });

  it("rejects malformed inputs", () => {
    expect(parseFlexibleBRDate("abc")).toBeNull();
    expect(parseFlexibleBRDate("23/04")).toBeNull();
    expect(parseFlexibleBRDate("2025/04/23")).toBeNull();
    expect(parseFlexibleBRDate("23-04-2025-extra")).toBeNull();
  });

  it("rejects implausible years", () => {
    expect(parseFlexibleBRDate("01/01/1800")).toBeNull();
    expect(parseFlexibleBRDate("01/01/3000")).toBeNull();
  });
});
