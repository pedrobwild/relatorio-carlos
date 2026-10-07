/**
 * Feature-based Permission Matrix
 * Defines what each role can do in the system
 */

import type { AppRole } from "@/hooks/useUserRole";

export type Feature =
  // Documents
  | "documents:upload"
  | "documents:delete"
  | "documents:view"
  // Formalizations
  | "formalizations:create"
  | "formalizations:sign"
  | "formalizations:void"
  | "formalizations:delete"
  | "formalizations:view"
  // Schedule/Activities
  | "schedule:edit"
  | "schedule:save_baseline"
  | "schedule:import"
  | "schedule:view"
  // Purchases
  | "purchases:create"
  | "purchases:edit"
  | "purchases:delete"
  | "purchases:view"
  // Payments
  | "payments:upload_boleto"
  | "payments:mark_paid"
  | "payments:view"
  // Journey
  | "journey:edit_stages"
  | "journey:edit_csm"
  | "journey:manage_slots"
  | "journey:complete_todos"
  | "journey:view"
  // Projects
  | "projects:create"
  | "projects:edit"
  | "projects:delete"
  | "projects:duplicate"
  | "projects:view"
  // Users & Admin
  | "users:create"
  | "users:edit"
  | "users:delete"
  | "admin:view_audit"
  | "admin:manage_system"
  // Reports
  | "reports:export_pdf"
  | "reports:edit_weekly"
  // Inspections
  | "inspections:create"
  | "inspections:edit"
  | "inspections:view"
  | "inspections:complete"
  // Non-conformities
  | "ncs:create"
  | "ncs:treat"
  | "ncs:verify"
  | "ncs:approve"
  | "ncs:view"
  // BWild Assessor (stateful agent)
  | "assessor:use"
  // Observações internas da obra (staff-only; cliente nunca vê)
  | "internal_notes:view"
  | "internal_notes:create"
  | "internal_notes:moderate";

/**
 * Permission matrix: role -> allowed features
 */
const PERMISSIONS: Record<AppRole, Feature[]> = {
  customer: [
    "documents:view",
    "formalizations:sign",
    "formalizations:view",
    "schedule:view",
    "purchases:view",
    "payments:view",
    "journey:complete_todos",
    "journey:view",
    "projects:view",
    "reports:export_pdf",
    "inspections:view",
    "ncs:view",
  ],

  engineer: [
    // All features (same as admin)
    "documents:upload",
    "documents:delete",
    "documents:view",
    "formalizations:create",
    "formalizations:sign",
    "formalizations:void",
    "formalizations:delete",
    "formalizations:view",
    "schedule:edit",
    "schedule:save_baseline",
    "schedule:import",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:delete",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:edit_stages",
    "journey:edit_csm",
    "journey:manage_slots",
    "journey:complete_todos",
    "journey:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "projects:duplicate",
    "projects:view",
    "users:create",
    "users:edit",
    "users:delete",
    "admin:view_audit",
    "admin:manage_system",
    "reports:export_pdf",
    "reports:edit_weekly",
    "inspections:create",
    "inspections:edit",
    "inspections:view",
    "inspections:complete",
    "ncs:create",
    "ncs:treat",
    "ncs:verify",
    "ncs:approve",
    "ncs:view",
    "assessor:use",
    "internal_notes:view",
    "internal_notes:create",
  ],

  manager: [
    // All features (same as admin)
    "documents:upload",
    "documents:delete",
    "documents:view",
    "formalizations:create",
    "formalizations:sign",
    "formalizations:void",
    "formalizations:delete",
    "formalizations:view",
    "schedule:edit",
    "schedule:save_baseline",
    "schedule:import",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:delete",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:edit_stages",
    "journey:edit_csm",
    "journey:manage_slots",
    "journey:complete_todos",
    "journey:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "projects:duplicate",
    "projects:view",
    "users:create",
    "users:edit",
    "users:delete",
    "admin:view_audit",
    "admin:manage_system",
    "reports:export_pdf",
    "reports:edit_weekly",
    "inspections:create",
    "inspections:edit",
    "inspections:view",
    "inspections:complete",
    "ncs:create",
    "ncs:treat",
    "ncs:verify",
    "ncs:approve",
    "ncs:view",
    "assessor:use",
    "internal_notes:view",
    "internal_notes:create",
  ],

  admin: [
    // All features
    "documents:upload",
    "documents:delete",
    "documents:view",
    "formalizations:create",
    "formalizations:sign",
    "formalizations:void",
    "formalizations:delete",
    "formalizations:view",
    "schedule:edit",
    "schedule:save_baseline",
    "schedule:import",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:delete",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:edit_stages",
    "journey:edit_csm",
    "journey:manage_slots",
    "journey:complete_todos",
    "journey:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "projects:duplicate",
    "projects:view",
    "users:create",
    "users:edit",
    "users:delete",
    "admin:view_audit",
    "admin:manage_system",
    "reports:export_pdf",
    "reports:edit_weekly",
    // Inspections & NCs
    "inspections:create",
    "inspections:edit",
    "inspections:view",
    "inspections:complete",
    "ncs:create",
    "ncs:treat",
    "ncs:verify",
    "ncs:approve",
    "ncs:view",
    "assessor:use",
    "internal_notes:view",
    "internal_notes:create",
    "internal_notes:moderate",
  ],

  gestor: [
    // All features (same as admin)
    "documents:upload",
    "documents:delete",
    "documents:view",
    "formalizations:create",
    "formalizations:sign",
    "formalizations:void",
    "formalizations:delete",
    "formalizations:view",
    "schedule:edit",
    "schedule:save_baseline",
    "schedule:import",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:delete",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:edit_stages",
    "journey:edit_csm",
    "journey:manage_slots",
    "journey:complete_todos",
    "journey:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "projects:duplicate",
    "projects:view",
    "users:create",
    "users:edit",
    "users:delete",
    "admin:view_audit",
    "admin:manage_system",
    "reports:export_pdf",
    "reports:edit_weekly",
    "inspections:create",
    "inspections:edit",
    "inspections:view",
    "inspections:complete",
    "ncs:create",
    "ncs:treat",
    "ncs:verify",
    "ncs:approve",
    "ncs:view",
    "assessor:use",
    "internal_notes:view",
    "internal_notes:create",
    "internal_notes:moderate",
  ],

  suprimentos: [
    // Focused on purchases and supply chain
    "documents:view",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:view",
    "payments:view",
    "journey:view",
    "projects:view",
    "reports:export_pdf",
    "inspections:view",
    "ncs:view",
    "internal_notes:view",
    "internal_notes:create",
  ],

  financeiro: [
    // Focused on payments, reports, and high-value approvals
    "documents:view",
    "formalizations:view",
    "schedule:view",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:view",
    "projects:view",
    "reports:export_pdf",
    "inspections:view",
    "ncs:view",
    "internal_notes:view",
    "internal_notes:create",
  ],

  cs: [
    // All features (same as engineer)
    "documents:upload",
    "documents:delete",
    "documents:view",
    "formalizations:create",
    "formalizations:sign",
    "formalizations:void",
    "formalizations:delete",
    "formalizations:view",
    "schedule:edit",
    "schedule:save_baseline",
    "schedule:import",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:delete",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:edit_stages",
    "journey:edit_csm",
    "journey:manage_slots",
    "journey:complete_todos",
    "journey:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "projects:duplicate",
    "projects:view",
    "users:create",
    "users:edit",
    "users:delete",
    "admin:view_audit",
    "admin:manage_system",
    "reports:export_pdf",
    "reports:edit_weekly",
    "inspections:create",
    "inspections:edit",
    "inspections:view",
    "inspections:complete",
    "ncs:create",
    "ncs:treat",
    "ncs:verify",
    "ncs:approve",
    "ncs:view",
    "assessor:use",
    "internal_notes:view",
    "internal_notes:create",
  ],

  arquitetura: [
    // Technical role — same scope as engineer
    "documents:upload",
    "documents:delete",
    "documents:view",
    "formalizations:create",
    "formalizations:sign",
    "formalizations:void",
    "formalizations:delete",
    "formalizations:view",
    "schedule:edit",
    "schedule:save_baseline",
    "schedule:import",
    "schedule:view",
    "purchases:create",
    "purchases:edit",
    "purchases:delete",
    "purchases:view",
    "payments:upload_boleto",
    "payments:mark_paid",
    "payments:view",
    "journey:edit_stages",
    "journey:edit_csm",
    "journey:manage_slots",
    "journey:complete_todos",
    "journey:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "projects:duplicate",
    "projects:view",
    "users:create",
    "users:edit",
    "users:delete",
    "admin:view_audit",
    "admin:manage_system",
    "reports:export_pdf",
    "reports:edit_weekly",
    "inspections:create",
    "inspections:edit",
    "inspections:view",
    "inspections:complete",
    "ncs:create",
    "ncs:treat",
    "ncs:verify",
    "ncs:approve",
    "ncs:view",
    "assessor:use",
    "internal_notes:view",
    "internal_notes:create",
  ],
};

/**
 * Check if a role has permission for a feature
 */
export function can(role: AppRole | null, feature: Feature): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(feature) ?? false;
}

/**
 * Check if any of the roles has permission for a feature
 */
export function canAny(roles: AppRole[], feature: Feature): boolean {
  return roles.some((role) => can(role, feature));
}

/**
 * Get all features for a role
 */
export function getFeaturesForRole(role: AppRole): Feature[] {
  return PERMISSIONS[role] ?? [];
}

/**
 * Check if a role has ALL specified features
 */
export function canAll(roles: AppRole[], features: Feature[]): boolean {
  return features.every((feature) => canAny(roles, feature));
}
