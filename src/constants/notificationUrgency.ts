/**
 * Maps notification types to urgency categories.
 * "action" = blocks the project and requires user action.
 * "update" = informational, no action required.
 */

export type UrgencyCategory = "action" | "update";

const ACTION_TYPES = new Set([
  "payment_due",
  "payment_overdue",
  "formalization_pending",
  "pending_item_created",
]);

export function getUrgencyCategory(type: string): UrgencyCategory {
  return ACTION_TYPES.has(type) ? "action" : "update";
}

export function isBlockingNotification(type: string): boolean {
  return ACTION_TYPES.has(type);
}
