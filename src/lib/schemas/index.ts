/**
 * Zod Validation Schemas
 *
 * Centralized validation schemas for form inputs and API data.
 * All schemas include proper error messages in Portuguese.
 */

import { z } from "zod";

// ============================================================================
// Common Validators
// ============================================================================

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email é obrigatório")
  .email("Email inválido")
  .max(255, "Email muito longo");

export const passwordSchema = z
  .string()
  .min(6, "Senha deve ter no mínimo 6 caracteres")
  .max(128, "Senha muito longa");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\s()+-]+$/, "Telefone inválido")
  .min(10, "Telefone deve ter no mínimo 10 dígitos")
  .max(20, "Telefone muito longo")
  .optional()
  .or(z.literal(""));

export const uuidSchema = z.string().uuid("ID inválido");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (formato: AAAA-MM-DD)");

export const urlSchema = z
  .string()
  .trim()
  .url("URL inválida")
  .max(2048, "URL muito longa");

export const positiveNumberSchema = z
  .number()
  .positive("Valor deve ser positivo");

export const nonNegativeNumberSchema = z
  .number()
  .min(0, "Valor não pode ser negativo");

// ============================================================================
// Auth Schemas
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    name: z
      .string()
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres")
      .max(100, "Nome muito longo"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// ============================================================================
// Project Schemas
// ============================================================================

export const projectStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "paused",
  "cancelled",
]);

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(200, "Nome muito longo"),
  unit_name: z
    .string()
    .trim()
    .max(100, "Nome da unidade muito longo")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(500, "Endereço muito longo")
    .optional()
    .or(z.literal("")),
  planned_start_date: dateSchema,
  planned_end_date: dateSchema,
  contract_value: positiveNumberSchema.optional().nullable(),
  customer_name: z
    .string()
    .trim()
    .min(2, "Nome do cliente obrigatório")
    .max(200, "Nome muito longo"),
  customer_email: emailSchema,
  customer_phone: phoneSchema,
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: uuidSchema,
  status: projectStatusSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ============================================================================
// Document Schemas
// ============================================================================

export const documentCategorySchema = z.enum([
  "contrato",
  "aditivo",
  "projeto_3d",
  "executivo",
  "art_rrt",
  "plano_reforma",
  "nota_fiscal",
  "garantia",
  "as_built",
  "termo_entrega",
]);

export const documentStatusSchema = z.enum(["pending", "approved"]);

export const uploadDocumentSchema = z.object({
  project_id: uuidSchema,
  document_type: documentCategorySchema,
  name: z
    .string()
    .trim()
    .min(1, "Nome do documento obrigatório")
    .max(200, "Nome muito longo"),
  description: z
    .string()
    .trim()
    .max(1000, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
});

export type DocumentCategory = z.infer<typeof documentCategorySchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

// ============================================================================
// Formalization Schemas
// ============================================================================

export const formalizationTypeSchema = z.enum([
  "meeting_minutes",
  "budget_item_swap",
  "exception_custody",
  "general",
]);

export const formalizationStatusSchema = z.enum([
  "draft",
  "pending_signatures",
  "signed",
  "voided",
]);

export const partyTypeSchema = z.enum([
  "customer",
  "contractor",
  "witness",
  "manager",
]);

export const partySchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(200, "Nome muito longo"),
  email: emailSchema.optional().or(z.literal("")),
  role_label: z
    .string()
    .trim()
    .max(100, "Função muito longa")
    .optional()
    .or(z.literal("")),
  party_type: partyTypeSchema,
  must_sign: z.boolean().default(true),
});

export const createFormalizationSchema = z.object({
  project_id: uuidSchema.optional().nullable(),
  type: formalizationTypeSchema,
  title: z
    .string()
    .trim()
    .min(5, "Título deve ter no mínimo 5 caracteres")
    .max(300, "Título muito longo"),
  summary: z
    .string()
    .trim()
    .min(10, "Resumo deve ter no mínimo 10 caracteres")
    .max(1000, "Resumo muito longo"),
  body_md: z
    .string()
    .min(20, "Conteúdo deve ter no mínimo 20 caracteres")
    .max(50000, "Conteúdo muito longo"),
  parties: z.array(partySchema).min(1, "Adicione pelo menos uma parte"),
});

export type FormalizationType = z.infer<typeof formalizationTypeSchema>;
export type FormalizationStatus = z.infer<typeof formalizationStatusSchema>;
export type PartyType = z.infer<typeof partyTypeSchema>;
export type PartyInput = z.infer<typeof partySchema>;
export type CreateFormalizationInput = z.infer<
  typeof createFormalizationSchema
>;

// ============================================================================
// Payment Schemas
// ============================================================================

export const createPaymentSchema = z.object({
  project_id: uuidSchema,
  description: z
    .string()
    .trim()
    .min(3, "Descrição obrigatória")
    .max(300, "Descrição muito longa"),
  amount: positiveNumberSchema,
  due_date: dateSchema,
  installment_number: z.number().int().positive("Número da parcela inválido"),
});

export const markPaymentPaidSchema = z.object({
  payment_id: uuidSchema,
  paid_at: z.string().datetime().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type MarkPaymentPaidInput = z.infer<typeof markPaymentPaidSchema>;

// ============================================================================
// Purchase Schemas
// ============================================================================

export const purchaseStatusSchema = z.enum([
  "pending",
  "ordered",
  "in_transit",
  "delivered",
  "cancelled",
]);

export const createPurchaseSchema = z.object({
  project_id: uuidSchema,
  item_name: z
    .string()
    .trim()
    .min(2, "Nome do item obrigatório")
    .max(200, "Nome muito longo"),
  description: z
    .string()
    .trim()
    .max(1000, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  quantity: positiveNumberSchema.default(1),
  unit: z.string().trim().max(50, "Unidade muito longa").default("un"),
  required_by_date: dateSchema,
  lead_time_days: nonNegativeNumberSchema.default(7),
  supplier_name: z
    .string()
    .trim()
    .max(200, "Nome do fornecedor muito longo")
    .optional()
    .or(z.literal("")),
  supplier_contact: z
    .string()
    .trim()
    .max(200, "Contato muito longo")
    .optional()
    .or(z.literal("")),
  estimated_cost: positiveNumberSchema.optional().nullable(),
  activity_id: uuidSchema.optional().nullable(),
});

export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

// ============================================================================
// Activity Schemas
// ============================================================================

export const createActivitySchema = z.object({
  project_id: uuidSchema,
  description: z
    .string()
    .trim()
    .min(3, "Descrição obrigatória")
    .max(500, "Descrição muito longa"),
  planned_start: dateSchema,
  planned_end: dateSchema,
  weight: positiveNumberSchema.max(100, "Peso máximo é 100").default(1),
  predecessor_ids: z.array(uuidSchema).optional().default([]),
});

export const updateActivitySchema = createActivitySchema.partial().extend({
  id: uuidSchema,
  actual_start: dateSchema.optional().nullable(),
  actual_end: dateSchema.optional().nullable(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

// ============================================================================
// File Upload Schemas
// ============================================================================

export const MAX_FILE_SIZE_MB = 500;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const fileUploadSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, "Arquivo inválido"),
  project_id: uuidSchema.optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

/**
 * Validate file before upload
 */
export function validateFileUpload(file: File): {
  valid: boolean;
  error?: string;
} {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB}MB`,
    };
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: "Tipo de arquivo não permitido",
    };
  }

  return { valid: true };
}

// ============================================================================
// Weekly Report Schemas
// ============================================================================

export const weeklyReportSchema = z.object({
  project_id: uuidSchema,
  week_start: dateSchema,
  week_end: dateSchema,
  data: z.record(z.unknown()).default({}),
  is_published: z.boolean().default(false),
});

export type WeeklyReportInput = z.infer<typeof weeklyReportSchema>;

// ============================================================================
// Pending Item Schemas
// ============================================================================

export const pendingItemTypeSchema = z.enum([
  "decision",
  "signature",
  "invoice",
  "approve_3d",
  "approve_executive",
  "document",
]);

export const pendingItemStatusSchema = z.enum([
  "pending",
  "completed",
  "cancelled",
]);

export const resolvePendingItemSchema = z.object({
  pending_item_id: uuidSchema,
  resolution_notes: z
    .string()
    .trim()
    .max(1000, "Notas muito longas")
    .optional()
    .or(z.literal("")),
  status: z.enum(["completed", "cancelled"]),
});

export type PendingItemType = z.infer<typeof pendingItemTypeSchema>;
export type PendingItemStatus = z.infer<typeof pendingItemStatusSchema>;
export type ResolvePendingItemInput = z.infer<typeof resolvePendingItemSchema>;
