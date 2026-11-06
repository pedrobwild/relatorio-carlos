export interface ActivityItem {
  description: string;
  durationDays: number;
  weight: number;
  etapa?: string;
  detailed_description?: string;
  week?: number;
  weekEnd?: number;
  kind?: "execucao" | "marco";
  showIf?: string;
  note?: string;
  purchases?: unknown[];
}

export interface FormState {
  name: string;
  description: string;
  is_project_phase: boolean;
  default_contract_value: string;
  selected_activity_template: string;
  custom_activities: ActivityItem[];
  category: string;
  custom_fields: import("@/hooks/useProjectTemplates").TemplateCustomField[];
  /** Modelo semanal (semanas de calendário). */
  is_weekly: boolean;
  weeks: string;
  default_contract_business_days: string;
  /** Demais chaves do schedule_model, preservadas como vieram. */
  schedule_model_extra: Record<string, unknown>;
}

export type SortField =
  | "name"
  | "created_at"
  | "is_project_phase"
  | "usage_count";

export const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "reforma", label: "Reforma" },
  { value: "projeto", label: "Projeto" },
];

export const emptyForm: FormState = {
  name: "",
  description: "",
  is_project_phase: false,
  default_contract_value: "",
  selected_activity_template: "",
  custom_activities: [],
  category: "geral",
  custom_fields: [],
  is_weekly: false,
  weeks: "12",
  default_contract_business_days: "60",
  schedule_model_extra: {},
};

export const totalWeight = (acts: ActivityItem[]) =>
  acts.reduce((s, a) => s + a.weight, 0);
export const totalDays = (acts: ActivityItem[]) =>
  acts.reduce((s, a) => s + a.durationDays, 0);
export const getCategoryLabel = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
