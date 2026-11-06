/**
 * Importar/exportar templates em JSON preservando TODOS os campos
 * (inclusive `purchases` e `schedule_model`, que ficam opacos nesta etapa).
 */
import { z } from "zod";
import type {
  ProjectTemplate,
  TemplateActivity,
  TemplateCustomField,
  TemplateScheduleModel,
} from "@/hooks/useProjectTemplates";

const activitySchema = z
  .object({
    description: z.string().trim().min(1).max(200),
    durationDays: z.number().optional(),
    weight: z.number().optional(),
    week: z.number().int().min(1).max(104).optional(),
    weekEnd: z.number().int().min(1).max(104).optional(),
    kind: z.enum(["execucao", "marco"]).optional(),
    showIf: z.string().max(300).optional(),
    note: z.string().max(1000).optional(),
    purchases: z.array(z.unknown()).optional(),
  })
  .passthrough();

const customFieldSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["text", "number", "select"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const scheduleModelSchema = z
  .object({
    type: z.literal("weekly"),
    weeks: z.number().int().min(1).max(104),
    default_contract_business_days: z.number().int().min(1).optional(),
  })
  .passthrough();

const templateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(500).nullish(),
  is_project_phase: z.boolean().optional(),
  category: z.string().nullish(),
  default_contract_value: z.number().nullish(),
  default_activities: z.array(z.unknown()).nullish(),
  custom_fields: z.array(z.unknown()).nullish(),
  schedule_model: z.unknown().optional(),
});

export interface ImportedTemplate {
  name: string;
  description?: string;
  is_project_phase: boolean;
  category: string;
  default_contract_value: number | null;
  default_activities: TemplateActivity[];
  custom_fields: TemplateCustomField[];
  schedule_model: TemplateScheduleModel | null;
}

export function normalizeImportedTemplate(raw: unknown): ImportedTemplate | null {
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return null;
  const t = parsed.data;
  const activities: TemplateActivity[] = (t.default_activities ?? [])
    .map((a) => activitySchema.safeParse(a))
    .filter((r) => r.success)
    .map((r) => {
      const a = r.data!;
      return {
        ...a,
        description: a.description,
        durationDays: Math.max(1, Math.round(a.durationDays ?? 5)),
        weight: Math.max(0, Math.min(100, Math.round(a.weight ?? 0))),
      } as TemplateActivity;
    });
  const fields = (t.custom_fields ?? [])
    .map((f) => customFieldSchema.safeParse(f))
    .filter((r) => r.success)
    .map((r) => r.data as TemplateCustomField);
  const sm = scheduleModelSchema.safeParse(t.schedule_model);
  return {
    name: t.name,
    description: t.description ?? undefined,
    is_project_phase: !!t.is_project_phase,
    category: t.category || "geral",
    default_contract_value: t.default_contract_value ?? null,
    default_activities: activities,
    custom_fields: fields,
    schedule_model: sm.success ? (sm.data as TemplateScheduleModel) : null,
  };
}

export function toExportShape(t: ProjectTemplate) {
  return {
    name: t.name,
    description: t.description,
    is_project_phase: t.is_project_phase,
    category: t.category,
    default_contract_value: t.default_contract_value,
    custom_fields: t.custom_fields ?? [],
    schedule_model: t.schedule_model ?? null,
    default_activities: t.default_activities ?? [],
  };
}
