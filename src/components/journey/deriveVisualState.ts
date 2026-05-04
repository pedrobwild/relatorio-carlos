import type { JourneyStage } from "@/hooks/useProjectJourney";

/**
 * Shared visual state derivation for journey stage presentation.
 *
 * Three flavours:
 *  1. `deriveVisualState(stage, index, stages)` — context-aware (used by
 *     timeline, stepper, roadmap — knows which stage is "current" vs "next"
 *     vs "blocked" based on surrounding stages).
 *  2. `deriveVisualStateStandalone(stage)` — standalone (used by summary /
 *     stage-card when the surrounding list isn't available).
 */

export type VisualState =
  | "completed"
  | "current"
  | "next"
  | "blocked"
  | "validating"
  | "future";

/* ─── Context-aware (needs full stage list) ─── */

export function deriveVisualState(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): VisualState {
  if (stage.status === "completed") return "completed";

  const firstNonCompletedIdx = stages.findIndex(
    (s) => s.status !== "completed",
  );

  if (stage.status === "in_progress" || stage.status === "waiting_action") {
    const isVisualCurrent = index === firstNonCompletedIdx;
    if (stage.status === "waiting_action" && isVisualCurrent)
      return "validating";
    if (isVisualCurrent) return "current";
    // Subsequent active stages
    const prevCompleted = index > 0 && stages[index - 1].status === "completed";
    if (prevCompleted) return "next";
    return "future";
  }

  if (stage.status === "pending") {
    if (index > 0 && stages[index - 1].status === "completed") return "next";
    if (stage.dependencies_text) return "blocked";
    if (index > 0) return "blocked"; // previous stage not completed
    return "future";
  }

  return "future";
}

/* ─── Standalone (single stage, no list context) ─── */

export function deriveVisualStateStandalone(stage: JourneyStage): VisualState {
  if (stage.status === "completed") return "completed";
  if (stage.status === "waiting_action") return "validating";
  if (stage.status === "in_progress") return "current";
  if (stage.dependencies_text) return "blocked";
  return "future";
}
