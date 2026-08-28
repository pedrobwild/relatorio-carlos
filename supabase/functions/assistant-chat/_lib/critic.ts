// Self-critique determinístico (v5).
//
// Roda DEPOIS do Formatter, antes de devolver a resposta para o usuário.
// Não chama LLM — usa heurísticas baratas para detectar resposta ruim:
//   - cita obra/valor que não está nas linhas
//   - omite o headline numérico
//   - esquece o "🎯 Próximo passo"
//   - usa coluna técnica (uuid, project_id) no texto
//   - número formatado errado (sem R$, sem vírgula)
//
// Quando detecta, devolve uma lista de issues que o orquestrador anexa
// como "limitations" silenciosas no log + decide se merece um retry.

export interface CriticIssue {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface CriticInput {
  answer: string;
  rows: Record<string, unknown>[];
  question: string;
  hasEvidences: boolean;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const NUMBER_RE = /R\$\s*\d|[0-9]+([.,][0-9]+)?/;

export function critiqueAnswer(input: CriticInput): CriticIssue[] {
  const out: CriticIssue[] = [];
  const { answer, rows, hasEvidences } = input;

  if (!answer || answer.length < 20) {
    out.push({ id: "too_short", severity: "high", message: "Resposta muito curta." });
    return out;
  }

  // 1. UUID exposto.
  if (UUID_RE.test(answer)) {
    out.push({
      id: "uuid_in_answer",
      severity: "medium",
      message: "Resposta expõe UUID — deveria mostrar nome da obra.",
    });
  }

  // 2. Headline numérico ausente.
  const firstLine = answer.split("\n").find((l) => l.trim().length > 0) ?? "";
  if (rows.length > 0 && !NUMBER_RE.test(firstLine)) {
    out.push({
      id: "no_headline_number",
      severity: "medium",
      message: "Primeira linha não tem número-âncora.",
    });
  }

  // 3. Próximo passo ausente.
  if (!/🎯|pr[óo]ximo passo|a[çc][ãa]o|cobr|peca|peça|pedir|conferi/i.test(answer)) {
    out.push({
      id: "no_next_step",
      severity: "low",
      message: "Resposta não termina em ação concreta.",
    });
  }

  // 4. Fala de fonte externa sem ter evidência.
  if (!hasEvidences && /(BCB|Sinduscon|CUB|INCC|IPCA|Selic|Receita Federal)/i.test(answer)) {
    out.push({
      id: "phantom_external_source",
      severity: "high",
      message: "Cita fonte externa sem evidência anexa.",
    });
  }

  // 5. Cita nomes de obra/cliente que não estão nos dados.
  if (rows.length > 0) {
    const knownNames = new Set<string>();
    for (const r of rows) {
      for (const k of ["obra", "name", "supplier_name", "client_name", "fornecedor"]) {
        const v = r[k];
        if (typeof v === "string" && v.length >= 4) knownNames.add(v.toLowerCase());
      }
    }
    // Pega palavras "Capitalizadas Compostas" (heurística de nome próprio).
    const properNouns = answer.match(/\*\*([^*]{4,40})\*\*/g) ?? [];
    for (const m of properNouns) {
      const inner = m.replace(/\*/g, "").toLowerCase();
      // Ignora termos comuns negritados pelo formatter
      if (/^(r\$|total|saldo|atraso|estouro|fontes|próximo passo)/i.test(inner)) continue;
      if (knownNames.size > 0 && ![...knownNames].some((n) => n.includes(inner) || inner.includes(n))) {
        out.push({
          id: "phantom_entity",
          severity: "medium",
          message: `"${inner}" não consta nos dados retornados.`,
        });
        break; // 1 aviso basta
      }
    }
  }

  return out;
}

/**
 * Retorna true se as issues justificam REGENERAR a resposta (apenas em
 * casos graves — phantom de fonte ou phantom de entidade). UUID + falta
 * de número são apenas anotados.
 */
export function shouldRetry(issues: CriticIssue[]): boolean {
  return issues.some(
    (i) => i.id === "phantom_external_source" || i.id === "phantom_entity",
  );
}
