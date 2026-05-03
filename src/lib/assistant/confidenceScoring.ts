import type { Insight } from "./insightTypes";

export interface ConfidenceInputs {
  rowsReturned: number;
  hasSql: boolean;
  hasGuardrailWarnings?: boolean;
  hasGuardrailErrors?: boolean;
  matchesCatalog?: boolean;
  domainKnown?: boolean;
  isExecutive?: boolean;
  dataQualityIssues?: number;
}

/**
 * Compute a confidence score in [0, 1] based on signals collected during the
 * analysis lifecycle. Used both to gate auto-recommendations and to tell the
 * user when a result is shaky.
 */
export function scoreConfidence(input: ConfidenceInputs): number {
  let score = 0.7;

  if (input.hasGuardrailErrors) return Math.max(0.05, score - 0.6);
  if (input.hasGuardrailWarnings) score -= 0.15;
  if (!input.hasSql) score -= 0.25;
  if (input.matchesCatalog === false) score -= 0.15;
  if (input.domainKnown === false) score -= 0.1;

  if (input.rowsReturned === 0) score -= 0.2;
  else if (input.rowsReturned >= 5 && input.rowsReturned <= 200) score += 0.1;
  else if (input.rowsReturned > 200) score -= 0.05;

  if (input.dataQualityIssues && input.dataQualityIssues > 0) {
    score -= Math.min(0.25, 0.05 * input.dataQualityIssues);
  }

  if (input.isExecutive) score = Math.min(score, 0.85); // Sempre aviso "tendência" em resumos.

  return Math.max(0.05, Math.min(0.99, score));
}

/** Re-rank insights by severity * confidence so the user sees what matters. */
export function rankInsights(insights: Insight[]): Insight[] {
  const severityWeight: Record<Insight["severity"], number> = {
    info: 0.5,
    low: 0.7,
    medium: 1,
    high: 1.4,
    critical: 1.8,
  };
  return [...insights].sort(
    (a, b) =>
      (severityWeight[b.severity] ?? 1) * b.confidence -
      (severityWeight[a.severity] ?? 1) * a.confidence,
  );
}

/** Friendly human label. */
export function confidenceLabel(c: number): "alta" | "média" | "baixa" {
  if (c >= 0.75) return "alta";
  if (c >= 0.45) return "média";
  return "baixa";
}
