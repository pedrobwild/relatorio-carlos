/**
 * Shared health score estimation for the portfolio module.
 *
 * Used by: KPI strip, Insights panel, Drawer, Advanced filters.
 * Single source of truth — do NOT duplicate this logic elsewhere.
 */

import type { ProjectSummary } from '@/infra/repositories/projects.repository';

export type HealthTierKey = 'excellent' | 'good' | 'attention' | 'critical';

export interface HealthResult {
  score: number;
  tier: HealthTierKey;
  label: string;
  /** Tailwind text-color class (includes dark mode variant) */
  color: string;
}

const tiers: { min: number; tier: HealthTierKey; label: string; color: string }[] = [
  { min: 80, tier: 'excellent', label: 'Excelente', color: 'text-emerald-600 dark:text-emerald-400' },
  { min: 60, tier: 'good',      label: 'Bom',       color: 'text-blue-600 dark:text-blue-400' },
  { min: 40, tier: 'attention', label: 'Atenção',   color: 'text-amber-600 dark:text-amber-400' },
  { min: 0,  tier: 'critical',  label: 'Crítico',   color: 'text-destructive' },
];

/**
 * Estimate a project's health score from its summary metrics.
 *
 * Heuristic weights:
 * - Overdue items: −15 each (cap −40)
 * - Unsigned formalizations: −10 each (cap −20)
 * - Pending documents: −5 each (cap −15)
 * - Low progress on active project: −10
 */
export function estimateHealthScore(s: ProjectSummary): number {
  let score = 100;
  if (s.overdue_count > 0) score -= Math.min(40, s.overdue_count * 15);
  if (s.unsigned_formalizations > 0) score -= Math.min(20, s.unsigned_formalizations * 10);
  if (s.pending_documents > 0) score -= Math.min(15, s.pending_documents * 5);
  if (s.progress_percentage < 20 && s.status === 'active') score -= 10;
  return Math.max(0, Math.min(100, score));
}

/** Get full health result with tier label and color */
export function getHealthResult(s: ProjectSummary): HealthResult {
  const score = estimateHealthScore(s);
  const match = tiers.find(t => score >= t.min) ?? tiers[tiers.length - 1];
  return { score, tier: match.tier, label: match.label, color: match.color };
}

/** Get tier key from raw score */
export function healthTierFromScore(score: number): HealthTierKey {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

/** Visual config for each health tier (bars, legends, dots) */
export const HEALTH_TIER_CONFIG = [
  { tier: 'excellent' as const, label: 'Excelente', range: '80–100', barColor: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
  { tier: 'good' as const,      label: 'Bom',       range: '60–79',  barColor: 'bg-blue-500',    textColor: 'text-blue-600 dark:text-blue-400' },
  { tier: 'attention' as const, label: 'Atenção',   range: '40–59',  barColor: 'bg-amber-500',   textColor: 'text-amber-600 dark:text-amber-400' },
  { tier: 'critical' as const,  label: 'Crítico',   range: '0–39',   barColor: 'bg-destructive', textColor: 'text-destructive' },
] as const;
