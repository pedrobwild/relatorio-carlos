/**
 * Parser SSE puro e testável.
 * Recebe um bloco (texto entre `\n\n`) e devolve o evento + payload JSON parseado.
 * Tolera CRLF (`\r\n`), espaços extras após `:` e linhas vazias/whitespace.
 */
export interface ParsedSseBlock {
  event: string;
  data: unknown;
}

export function parseSseBlock(block: string): ParsedSseBlock | null {
  // Normaliza CRLF -> LF e remove BOM eventual
  const normalized = block.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const lines = normalized.split("\n");

  let event = "message";
  let dataStr = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith(":")) continue; // comentário SSE
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      // Spec SSE: um único espaço após `data:` é opcional/ignorado.
      // Aceitamos múltiplos espaços/tabs como tolerância.
      dataStr += line.slice(5).replace(/^[ \t]+/, "");
    }
  }

  if (!dataStr) return null;

  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

/**
 * Divide um buffer em blocos SSE completos (separados por linha em branco),
 * tratando tanto `\n\n` quanto `\r\n\r\n`. Retorna os blocos completos e
 * o resto pendente (último fragmento sem terminador).
 */
export function splitSseBuffer(buffer: string): {
  blocks: string[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  return { blocks: parts, rest };
}
