/**
 * Condições de atividades de template (`showIf`).
 *
 * Sintaxe: `chave=Valor`, `chave!=Valor`, combinadas com `&` (todas precisam
 * valer). Vazio/ausente = sempre aparece. As chaves são as dos `custom_fields`
 * do template (perguntados na Nova Obra).
 */

export interface ShowIfClause {
  key: string;
  op: "=" | "!=";
  value: string;
}

export function parseShowIf(expr: string | null | undefined): ShowIfClause[] {
  if (!expr || !expr.trim()) return [];
  return expr
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const neq = part.indexOf("!=");
      if (neq > 0) {
        return {
          key: part.slice(0, neq).trim(),
          op: "!=" as const,
          value: part.slice(neq + 2).trim(),
        };
      }
      const eq = part.indexOf("=");
      if (eq > 0) {
        return {
          key: part.slice(0, eq).trim(),
          op: "=" as const,
          value: part.slice(eq + 1).trim(),
        };
      }
      return { key: part, op: "=" as const, value: "" };
    });
}

export function serializeShowIf(clauses: ShowIfClause[]): string {
  return clauses
    .filter((c) => c.key && c.value)
    .map((c) => `${c.key}${c.op}${c.value}`)
    .join("&");
}

/** Avalia a condição. Valor não respondido conta como "" (não igual a nada). */
export function evaluateShowIf(
  expr: string | null | undefined,
  values: Record<string, string | undefined>,
): boolean {
  return parseShowIf(expr).every((c) => {
    const v = (values[c.key] ?? "").trim();
    return c.op === "=" ? v === c.value : v !== c.value;
  });
}

interface FieldLike {
  key: string;
  type?: string;
  options?: string[];
}

/** Erros de validação da condição contra os campos do template (pt-BR). */
export function validateShowIf(
  expr: string | null | undefined,
  fields: FieldLike[],
): string[] {
  const errors: string[] = [];
  for (const c of parseShowIf(expr)) {
    const field = fields.find((f) => f.key === c.key);
    if (!field) {
      errors.push(`Condição usa o campo "${c.key}", que não existe no template`);
      continue;
    }
    if (!c.value) {
      errors.push(`Condição do campo "${c.key}" está sem valor`);
      continue;
    }
    if (field.options?.length && !field.options.includes(c.value)) {
      errors.push(`"${c.value}" não é uma opção do campo "${c.key}"`);
    }
  }
  return errors;
}
