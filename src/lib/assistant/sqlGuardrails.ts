import { CATALOG_BY_TABLE, DATA_CATALOG } from "./dataCatalog";

export interface GuardrailIssue {
  level: "error" | "warning";
  code:
    | "empty"
    | "multiple_statements"
    | "non_select"
    | "forbidden_keyword"
    | "select_star"
    | "unknown_table"
    | "forbidden_column"
    | "internal_schema"
    | "anonymous_block";
  message: string;
}

export interface GuardrailResult {
  ok: boolean;
  errors: GuardrailIssue[];
  warnings: GuardrailIssue[];
  cleanedSql: string;
}

const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "grant",
  "revoke",
  "create",
  "comment",
  "vacuum",
  "analyze",
  "reindex",
  "cluster",
  "lock",
  "execute",
  "copy",
  "call",
];

const DANGEROUS_FUNCTIONS = [
  "pg_sleep",
  "pg_read_server_files",
  "pg_ls_dir",
  "pg_write_server_files",
  "lo_import",
  "lo_export",
  "pg_terminate",
  "pg_cancel",
];

const INTERNAL_SCHEMAS = ["auth.", "storage.", "vault.", "supabase_functions."];

const KNOWN_TABLES = new Set(DATA_CATALOG.map((t) => t.table));

/**
 * Validate a generated SQL string. The same rules are enforced server-side by
 * `execute_assistant_query`, but we run them client-side too to give faster
 * feedback and to compose richer error messages.
 */
export function validateSql(rawSql: string): GuardrailResult {
  const errors: GuardrailIssue[] = [];
  const warnings: GuardrailIssue[] = [];

  if (!rawSql || !rawSql.trim()) {
    errors.push({ level: "error", code: "empty", message: "SQL vazio." });
    return { ok: false, errors, warnings, cleanedSql: "" };
  }

  const cleanedSql = rawSql.trim().replace(/;+\s*$/, "");
  const lower = cleanedSql.toLowerCase();

  if (cleanedSql.includes(";")) {
    errors.push({
      level: "error",
      code: "multiple_statements",
      message: "Múltiplas instruções SQL não são permitidas.",
    });
  }

  if (!/^\s*(select|with)\s/i.test(cleanedSql)) {
    errors.push({
      level: "error",
      code: "non_select",
      message: "Apenas SELECT/WITH é permitido.",
    });
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(lower)) {
      errors.push({
        level: "error",
        code: "forbidden_keyword",
        message: `Comando proibido detectado: ${kw}.`,
      });
    }
  }

  for (const fn of DANGEROUS_FUNCTIONS) {
    if (new RegExp(`\\b${fn}\\b`, "i").test(lower)) {
      errors.push({
        level: "error",
        code: "forbidden_keyword",
        message: `Função proibida detectada: ${fn}.`,
      });
    }
  }

  for (const sch of INTERNAL_SCHEMAS) {
    if (lower.includes(sch)) {
      errors.push({
        level: "error",
        code: "internal_schema",
        message: `Acesso a esquema interno proibido: ${sch.replace(".", "")}.`,
      });
    }
  }

  if (lower.includes("$$") || /\bdo\s+\$/.test(lower)) {
    errors.push({
      level: "error",
      code: "anonymous_block",
      message: "Blocos anônimos não são permitidos.",
    });
  }

  if (/\bselect\s+\*/i.test(cleanedSql)) {
    warnings.push({
      level: "warning",
      code: "select_star",
      message: "Evite SELECT * — prefira colunas explícitas.",
    });
  }

  // Attempt to parse referenced tables (simplistic — best-effort warning only).
  const referenced = new Set<string>();
  const tableRe = /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(cleanedSql)) != null) {
    referenced.add(m[1]);
  }

  for (const t of referenced) {
    if (!KNOWN_TABLES.has(t)) {
      warnings.push({
        level: "warning",
        code: "unknown_table",
        message: `Tabela "${t}" não está no catálogo. Verifique se é uma CTE válida.`,
      });
    } else {
      const def = CATALOG_BY_TABLE[t];
      const known = new Set(def.columns.map((c) => c.name));
      // Look for columns referenced as <table>.<column> ou <alias>.<column> com nome dessa tabela.
      const colRe = new RegExp(`\\b${t}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, "g");
      let cm: RegExpExecArray | null;
      while ((cm = colRe.exec(cleanedSql)) != null) {
        const col = cm[1];
        if (col === "*") continue;
        if (def.forbiddenColumns?.includes(col)) {
          errors.push({
            level: "error",
            code: "forbidden_column",
            message: `Coluna "${t}.${col}" não existe no schema. Use a derivação documentada.`,
          });
        } else if (!known.has(col)) {
          warnings.push({
            level: "warning",
            code: "unknown_table",
            message: `Coluna "${t}.${col}" não está no catálogo curado.`,
          });
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    cleanedSql,
  };
}
