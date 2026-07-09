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
 * Separador invisível (Unit Separator, U+001F) entre o rótulo pesquisável e o
 * id de unicidade dentro do `value` de cada item do cmdk. Não aparece em nomes
 * de obra/cliente, então nunca colide com o texto real.
 */
export const PROJECT_OPTION_ID_SEP = String.fromCharCode(31);

/**
 * Monta o `value` de um item do seletor de obras.
 *
 * O cmdk usa o `value` como **identidade** do item (seleção, navegação por
 * teclado, `aria-selected`). Obras com nome+cliente idênticos colidiriam se o
 * value fosse apenas o rótulo, então anexamos o id para garantir unicidade.
 *
 * O id fica depois de um separador invisível para que `scoreProjectOption`
 * possa removê-lo antes de casar a busca — assim o texto do id (um UUID) não
 * vira conteúdo pesquisável (senão buscas como "a" ou "4" casariam fragmentos
 * hexadecimais e manteriam obras não relacionadas na lista).
 */
export function buildProjectOptionValue(label: string, id: string): string {
  return `${label}${PROJECT_OPTION_ID_SEP}${id}`;
}

/**
 * Pontua um item do seletor de obras para o cmdk.
 *
 * Casa **apenas contra o rótulo visível** (a parte antes do separador de id);
 * o id anexado serve só para dar identidade única ao item e não é pesquisável.
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
  // Considera só o rótulo visível: descarta o sufixo de id (se houver).
  const label = value.split(PROJECT_OPTION_ID_SEP)[0];
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const haystack = normalize(label);
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
