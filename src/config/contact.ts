/**
 * BWild contact channels surfaced from the mobile profile sheet and other
 * support entrypoints. Keep this file as the single source of truth so support
 * numbers / messages can be updated without hunting through components.
 */

/** WhatsApp number in E.164 (no spaces, no `+`). */
export const SUPPORT_WHATSAPP_NUMBER = "5511999999999";

export const SUPPORT_WHATSAPP_DEFAULT_MESSAGE =
  "Olá, preciso de ajuda no Portal BWild.";

export function buildSupportWhatsappUrl(
  message: string = SUPPORT_WHATSAPP_DEFAULT_MESSAGE,
): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${text}`;
}
