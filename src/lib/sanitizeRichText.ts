/**
 * Sanitização de HTML para editores rich-text inline.
 * Permite apenas formatação básica (negrito, itálico, sublinhado, listas, parágrafos, quebras).
 * Remove scripts, handlers, estilos e atributos perigosos.
 */
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "span",
  "div",
];

export function sanitizeInlineRichText(
  html: string | null | undefined,
): string {
  if (!html) return "";
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  });
  // Normaliza: remove espaços excessivos e tags vazias residuais
  const trimmed = cleaned
    .replace(/<p>(\s|&nbsp;)*<\/p>/gi, "")
    .replace(/<div>(\s|&nbsp;)*<\/div>/gi, "")
    .trim();
  return trimmed;
}

/** Extrai texto puro de um HTML para validações de tamanho/preenchimento. */
export function extractRichTextPlain(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
