export interface ActivityFormData {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
  predecessorIds: string[];
}

export interface ColumnMapping {
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
}

export type ImportStep = "upload" | "mapping" | "preview";

export const REQUIRED_FIELDS = [
  "description",
  "plannedStart",
  "plannedEnd",
] as const;
export const OPTIONAL_FIELDS = ["actualStart", "actualEnd", "weight"] as const;

export const FIELD_LABELS: Record<string, string> = {
  description: "Descrição",
  plannedStart: "Início Previsto",
  plannedEnd: "Término Previsto",
  actualStart: "Início Real",
  actualEnd: "Término Real",
  weight: "Peso (%)",
};

export const COLUMN_ALIASES: Record<string, string[]> = {
  description: [
    "descrição",
    "descricao",
    "description",
    "atividade",
    "activity",
    "tarefa",
    "task",
    "nome",
    "name",
  ],
  plannedStart: [
    "início previsto",
    "inicio previsto",
    "planned start",
    "data início",
    "data inicio",
    "start date",
    "início",
    "inicio",
  ],
  plannedEnd: [
    "término previsto",
    "termino previsto",
    "planned end",
    "data término",
    "data termino",
    "end date",
    "término",
    "termino",
    "fim",
  ],
  actualStart: [
    "início real",
    "inicio real",
    "actual start",
    "início efetivo",
    "inicio efetivo",
  ],
  actualEnd: [
    "término real",
    "termino real",
    "actual end",
    "término efetivo",
    "termino efetivo",
  ],
  weight: ["peso", "weight", "%", "percentual", "percentage"],
};
