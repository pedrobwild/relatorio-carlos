import * as XLSX from "xlsx";
import {
  type ColumnMapping,
  COLUMN_ALIASES,
  type ActivityFormData,
} from "./types";

function stripControlChars(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 31 || code === 127) continue;
    out += s[i];
  }
  return out;
}

export interface NormalizedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

export function normalizeHeaders(
  data: Record<string, unknown>[],
): NormalizedData {
  if (data.length === 0) return { headers: [], rows: [] };

  const original = Object.keys(data[0]);
  const seen = new Map<string, number>();
  const cleaned = original.map((h) => {
    const base = stripControlChars(h.trim().slice(0, 120)) || "Coluna";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const rows = data.map((row) => {
    const out: Record<string, unknown> = {};
    original.forEach((origKey, i) => {
      out[cleaned[i]] = row[origKey];
    });
    return out;
  });

  return { headers: cleaned, rows };
}

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
  const used = new Set<number>();

  // Pass 1: exact match — guarantees "Início Real" wins actualStart over plannedStart's "início" alias.
  Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
    const idx = normalizedHeaders.findIndex(
      (h, i) => !used.has(i) && aliases.includes(h),
    );
    if (idx !== -1) {
      mapping[field as keyof ColumnMapping] = detectedHeaders[idx];
      used.add(idx);
    }
  });

  // Pass 2: substring fallback for fields still unmapped, skipping already-claimed columns.
  Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
    if (mapping[field as keyof ColumnMapping]) return;
    const idx = normalizedHeaders.findIndex(
      (h, i) => !used.has(i) && aliases.some((a) => h.includes(a)),
    );
    if (idx !== -1) {
      mapping[field as keyof ColumnMapping] = detectedHeaders[idx];
      used.add(idx);
    }
  });

  return mapping;
}

export function parseDate(value: unknown): string {
  if (value == null || value === "") return "";

  if (value instanceof Date && !isNaN(value.getTime())) {
    return formatLocalDate(value);
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, "0");
      const day = String(date.d).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return "";
  }

  const strValue = String(value).trim();
  if (!strValue) return "";

  const isoMatch = strValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return strValue;

  const slashMatch = strValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;

  const dashMatch = strValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) return `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`;

  return "";
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  rawData: Record<string, unknown>[],
  columnMapping: ColumnMapping,
): MapResult {
  const valid: ActivityFormData[] = [];
  const errors: ImportError[] = [];

  rawData.forEach((row, index) => {
    const description = columnMapping.description
      ? String(row[columnMapping.description] ?? "").trim()
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
        columnMapping.weight && row[columnMapping.weight] != null
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
