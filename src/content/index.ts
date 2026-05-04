/**
 * Centralized copy. All user-facing strings live here, organized by domain.
 *
 * Tom de voz: ver `docs/TOM_DE_VOZ.md`.
 */

export { navigationLabels, getNavLabel } from "./navigationLabels";
export {
  emptyStateLabels,
  type EmptyStateKey,
  type EmptyStateCopy,
} from "./emptyStateLabels";
export {
  errorLabels,
  formatError,
  type ErrorKey,
  type ErrorCopy,
} from "./errorLabels";
export { successLabels, type SuccessKey } from "./successLabels";
export {
  confirmLabels,
  formatConfirm,
  type ConfirmKey,
  type ConfirmCopy,
} from "./confirmLabels";
export {
  glossario,
  getGlossaryEntry,
  type GlossaryEntry,
  type GlossaryKey,
} from "./glossario";
export {
  onboardingFlows,
  getOnboardingFlow,
  type OnboardingFlowKey,
  type OnboardingStep,
  type ObraStatus,
} from "./onboardingFlows";
