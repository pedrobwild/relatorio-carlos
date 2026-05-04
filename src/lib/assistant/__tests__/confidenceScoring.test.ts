import { describe, expect, it } from "vitest";
import {
  scoreConfidence,
  rankInsights,
  confidenceLabel,
} from "../confidenceScoring";
import type { Insight } from "../insightTypes";

describe("scoreConfidence", () => {
  it("returns high score for clean inputs", () => {
    const c = scoreConfidence({
      rowsReturned: 20,
      hasSql: true,
      matchesCatalog: true,
      domainKnown: true,
    });
    expect(c).toBeGreaterThan(0.7);
  });

  it("drops sharply on guardrail errors", () => {
    const c = scoreConfidence({
      rowsReturned: 0,
      hasSql: false,
      hasGuardrailErrors: true,
    });
    expect(c).toBeLessThanOrEqual(0.2);
  });

  it("penalizes data quality issues", () => {
    const clean = scoreConfidence({ rowsReturned: 10, hasSql: true });
    const dirty = scoreConfidence({
      rowsReturned: 10,
      hasSql: true,
      dataQualityIssues: 4,
    });
    expect(dirty).toBeLessThan(clean);
  });

  it("penalizes empty results", () => {
    const empty = scoreConfidence({ rowsReturned: 0, hasSql: true });
    const filled = scoreConfidence({ rowsReturned: 10, hasSql: true });
    expect(empty).toBeLessThan(filled);
  });

  it("clamps between 0.05 and 0.99", () => {
    const c = scoreConfidence({
      rowsReturned: 0,
      hasSql: false,
      hasGuardrailErrors: true,
      dataQualityIssues: 99,
    });
    expect(c).toBeGreaterThanOrEqual(0.05);
    expect(c).toBeLessThanOrEqual(0.99);
  });
});

describe("rankInsights", () => {
  const make = (
    severity: Insight["severity"],
    confidence: number,
    id = severity,
  ): Insight => ({
    id,
    type: "descriptive",
    domain: "outros",
    title: id,
    summary: "",
    evidence: [],
    severity,
    confidence,
  });

  it("orders by severity * confidence desc", () => {
    const ranked = rankInsights([
      make("low", 0.9, "low"),
      make("critical", 0.6, "critical"),
      make("info", 0.99, "info"),
    ]);
    expect(ranked[0].id).toBe("critical");
  });
});

describe("confidenceLabel", () => {
  it("maps to PT-BR labels", () => {
    expect(confidenceLabel(0.9)).toBe("alta");
    expect(confidenceLabel(0.5)).toBe("média");
    expect(confidenceLabel(0.2)).toBe("baixa");
  });
});
