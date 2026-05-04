/**
 * searchNormalize — utilidades padronizadas para busca textual em listagens.
 *
 * Toda comparação de busca por substring no app DEVE usar `normalizeSearch`
 * (ou `matchesSearch`) para garantir comportamento case + accent-insensitive
 * consistente em pt-BR (ex.: "joao" encontra "João Silva").
 *
 * Implementação: NFD + remoção de diacríticos (Unicode block U+0300–U+036F)
 * + lowercase + trim. Aceita valores nulos/indefinidos com fallback "".
 */

/** Normaliza uma string para comparação (sem acento, lowercase, trim). */
export function normalizeSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Verifica se algum dos campos contém o termo de busca (normalizado).
 * Termo vazio sempre retorna `true` (não filtra).
 */
export function matchesSearch(
  query: string | null | undefined,
  fields: Array<string | null | undefined>,
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch(fields.filter(Boolean).join(" "));
  return haystack.includes(q);
}
