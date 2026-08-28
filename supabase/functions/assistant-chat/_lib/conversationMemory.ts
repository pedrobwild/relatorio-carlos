// Memória de conversa estendida (v5).
//
// Antes: o orquestrador puxava as últimas 10 mensagens cruas e mandava no
// prompt. Resultado: conversa longa estourava contexto OU perdia o começo.
//
// Agora: pegamos as últimas N mensagens cruas (recência) + um RESUMO
// estruturado das anteriores (continuidade). O resumo destaca:
//   - obras/fornecedores/períodos já mencionados,
//   - decisões/intents anteriores ("ele quer ver só compras pendentes"),
//   - números-chave ("saldo total mencionado: R$ 230k").
//
// O resumo é gerado apenas quando há >= MEMORY_RAW_LIMIT mensagens.

export const MEMORY_RAW_LIMIT = 8; // últimas N mensagens cruas
export const MEMORY_TOTAL_LIMIT = 30; // janela total considerada

export interface RawMessage {
  role: string;
  content: string;
  created_at?: string;
}

export interface MemoryWindow {
  /** Mensagens cruas mais recentes (últimas MEMORY_RAW_LIMIT). */
  recent: RawMessage[];
  /** Resumo das mensagens anteriores. Vazio quando histórico é curto. */
  summary: string | null;
  /** Total considerado (raw + summarized). */
  total_considered: number;
}

/**
 * Resumo BARATO e DETERMINÍSTICO — sem LLM. Extrai entidades comuns
 * (nomes em **negrito**, valores R$, datas) e monta um briefing.
 * Para resumo via LLM, use buildMemoryWindowWithLLM em vez deste.
 */
export function buildMemoryWindow(history: RawMessage[]): MemoryWindow {
  const considered = history.slice(-MEMORY_TOTAL_LIMIT);
  if (considered.length <= MEMORY_RAW_LIMIT) {
    return { recent: considered, summary: null, total_considered: considered.length };
  }

  const olderSlice = considered.slice(0, considered.length - MEMORY_RAW_LIMIT);
  const recent = considered.slice(-MEMORY_RAW_LIMIT);

  const obras = new Set<string>();
  const fornecedores = new Set<string>();
  const valores: string[] = [];
  const datas: string[] = [];
  const userIntents: string[] = [];
  const assistantTopics: string[] = [];

  for (const m of olderSlice) {
    const content = m.content ?? "";
    // Nomes em negrito (formatter sempre destaca obra/fornecedor assim).
    for (const match of content.matchAll(/\*\*([^*]{3,60})\*\*/g)) {
      const tok = match[1].trim();
      if (/r\$/i.test(tok)) {
        valores.push(tok);
      } else if (/^\d{1,2}\/\d{1,2}/i.test(tok)) {
        datas.push(tok);
      } else if (/(obra|reforma|studio|apto)/i.test(tok)) {
        obras.add(tok);
      } else if (/(fornec|construt|eletr|hidr|mar[óo])/i.test(tok)) {
        fornecedores.add(tok);
      } else {
        // Genérico: provavelmente nome de obra (ex: "Vila Mariana", "Pinheiros 42").
        obras.add(tok);
      }
    }
    if (m.role === "user") {
      const trimmed = content.trim();
      if (trimmed.length >= 6 && trimmed.length <= 140) userIntents.push(trimmed);
    } else if (m.role === "assistant") {
      const firstLine = (content.split("\n").find((l) => l.trim().length > 0) ?? "").trim();
      if (firstLine && firstLine.length <= 200) assistantTopics.push(firstLine);
    }
  }

  const parts: string[] = [];
  parts.push(`Conversa anterior (${olderSlice.length} mensagens condensadas):`);
  if (userIntents.length) {
    parts.push(`- Perguntas anteriores: ${userIntents.slice(-5).map((q) => `"${q}"`).join(" · ")}`);
  }
  if (assistantTopics.length) {
    parts.push(`- Headlines anteriores: ${assistantTopics.slice(-5).join(" · ")}`);
  }
  if (obras.size) parts.push(`- Obras/projetos citadas: ${[...obras].slice(0, 8).join(", ")}`);
  if (fornecedores.size)
    parts.push(`- Fornecedores citados: ${[...fornecedores].slice(0, 5).join(", ")}`);
  if (valores.length) parts.push(`- Valores mencionados: ${valores.slice(0, 5).join(", ")}`);
  if (datas.length) parts.push(`- Datas mencionadas: ${datas.slice(0, 5).join(", ")}`);

  return {
    recent,
    summary: parts.join("\n"),
    total_considered: considered.length,
  };
}

/**
 * Renderiza a memória como mensagens prontas pra ir no payload do chat.
 * O resumo entra como mensagem 'system' anterior ao resto.
 */
export function memoryToChatMessages(window: MemoryWindow): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = [];
  if (window.summary) {
    out.push({
      role: "system",
      content: `# Memória da conversa\n${window.summary}\n\nUse esse contexto para entender referências curtas ("aquela obra", "o mesmo fornecedor", "como antes").`,
    });
  }
  for (const m of window.recent) {
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
  }
  return out;
}
