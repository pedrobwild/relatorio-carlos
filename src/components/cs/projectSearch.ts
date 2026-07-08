/**
 * Busca de obras no seletor do diálogo de tickets de CS.
 *
 * Isolado do componente para permitir teste unitário direto e evitar o aviso
 * de fast-refresh (`react-refresh/only-export-components`) ao exportar
 * utilitários de um arquivo de componente.
 */

/** Modo de busca da obra no seletor. */
export type ProjectSearchMode = "tokens" | "substring";

/**
 * Pontua um item do seletor de obras para o cmdk.
 *
 * A normalização remove acentos **e** baixa a caixa em ambos os lados (texto
 * do item e termo digitado). Sem o `toLowerCase` no lado do item, uma busca em
 * minúsculas não casava com obras cujo nome começa com maiúscula (a maioria) e
 * elas "sumiam" da lista — este era o bug corrigido.
 *
 * Retorna 1 (mantém na lista) ou 0 (esconde), no formato esperado pelo cmdk.
 */
export function scoreProjectOption(
  value: string,
  search: string,
  mode: ProjectSearchMode,
): number {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const haystack = normalize(value);
  const needle = normalize(search).trim();
  if (!needle) return 1;

  if (mode === "substring") {
    // Qualquer parte contígua do texto digitado
    return haystack.includes(needle) ? 1 : 0;
  }
  // tokens: todas as palavras precisam aparecer (qualquer ordem)
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t)) ? 1 : 0;
}
