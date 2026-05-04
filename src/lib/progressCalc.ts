/**
 * Unified progress calculation based on completed activity weights.
 * This is the SINGLE SOURCE OF TRUTH for project progress across the entire app.
 */

export interface ProgressActivity {
  weight?: number;
  actualEnd?: string | null;
}

/**
 * Calculate weighted progress percentage based on completed activities.
 * An activity is "completed" if it has an `actualEnd` date set.
 */
export function calcWeightedProgress(activities: ProgressActivity[]): number {
  if (activities.length === 0) return 0;

  const hasWeights = activities.some(
    (a) => a.weight !== undefined && a.weight > 0,
  );
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;

  if (totalWeight === 0) return 0;

  const completedWeight = activities.reduce((sum, a) => {
    if (a.actualEnd) {
      return sum + (hasWeights ? a.weight || 0 : 1);
    }
    return sum;
  }, 0);

  return Math.round((completedWeight / totalWeight) * 100);
}
