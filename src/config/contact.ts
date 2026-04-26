/**
 * Centralized contact info for support entry points.
 * The WhatsApp number is intentionally kept as a constant (not env) — it is the
 * public BWild support channel and is the same across environments.
 */
export const BWILD_SUPPORT = {
  whatsappNumber: '5547999999999',
  whatsappMessage: 'Olá! Preciso de ajuda com minha obra no Portal BWild.',
} as const;

export function getWhatsappSupportUrl(message?: string) {
  const text = encodeURIComponent(message ?? BWILD_SUPPORT.whatsappMessage);
  return `https://wa.me/${BWILD_SUPPORT.whatsappNumber}?text=${text}`;
}
