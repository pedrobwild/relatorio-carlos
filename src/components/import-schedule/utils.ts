import * as XLSX from "xlsx";
import {
  type ColumnMapping,
  COLUMN_ALIASES,
  type ActivityFormData,
} from "./types";

export function autoMapColumns(detectedHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    description: "",
    plannedStart: "",
    plannedEnd: "",
    actualStart: "",
    actualEnd: "",
    weight: "",
  };

  const normalizedHeaders = detectedHeaders.map((h) => h.toLowerCase().trim());

  Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
    const matchIndex = normalizedHeaders.findIndex((header) =>
      aliases.some((alias) => header.includes(alias)),
    );
    if (matchIndex !== -1) {
      mapping[field as keyof ColumnMapping] = detectedHeaders[matchIndex];
    }
  });

  return mapping;
}

export function parseDate(value: string | number | undefined): string {
  if (!value) return "";

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, "0");
      const day = String(date.d).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const strValue = String(value).trim();
  if (!strValue) return "";

  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];

  if (formats[0].test(strValue)) return strValue;

  const match1 = strValue.match(formats[1]);
  if (match1) return `${match1[3]}-${match1[2]}-${match1[1]}`;

  const match2 = strValue.match(formats[2]);
  if (match2) return `${match2[3]}-${match2[2]}-${match2[1]}`;

  const parsed = new Date(strValue);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];

  return "";
}

export interface ImportError {
  row: number;
  reason: string;
}

export interface MapResult {
  valid: ActivityFormData[];
  errors: ImportError[];
}

export function mapRawToActivities(
  rawData: Record<string, string>[],
  columnMapping: ColumnMapping,
): MapResult {
  const valid: ActivityFormData[] = [];
  const errors: ImportError[] = [];

  rawData.forEach((row, index) => {
    const description = columnMapping.description
      ? String(row[columnMapping.description] || "").trim()
      : "";
    if (!description) {
      errors.push({ row: index + 2, reason: "Descrição vazia" });
      return;
    }

    const plannedStart = parseDate(
      columnMapping.plannedStart ? row[columnMapping.plannedStart] : "",
    );
    const plannedEnd = parseDate(
      columnMapping.plannedEnd ? row[columnMapping.plannedEnd] : "",
    );

    if (!plannedStart) {
      errors.push({ row: index + 2, reason: "Data início inválida" });
      return;
    }
    if (!plannedEnd) {
      errors.push({ row: index + 2, reason: "Data término inválida" });
      return;
    }

    valid.push({
      id: crypto.randomUUID(),
      description,
      plannedStart,
      plannedEnd,
      actualStart: parseDate(
        columnMapping.actualStart ? row[columnMapping.actualStart] : "",
      ),
      actualEnd: parseDate(
        columnMapping.actualEnd ? row[columnMapping.actualEnd] : "",
      ),
      weight:
        columnMapping.weight && row[columnMapping.weight]
          ? String(
              parseFloat(
                String(row[columnMapping.weight])
                  .replace(",", ".")
                  .replace("%", ""),
              ) || 0,
            )
          : "0",
      predecessorIds: [],
    });
  });

  return { valid, errors };
}
