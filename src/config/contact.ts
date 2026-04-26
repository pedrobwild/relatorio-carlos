/**
 * Centralized contact info for support entry points.
 * Source of truth for the WhatsApp phone number — Auth and the mobile profile
 * sheet both consume it so the user always lands in the same chat.
 */
export const BWILD_SUPPORT = {
  whatsappNumber: '5521989362122',
  whatsappMessage: 'Olá! Preciso de ajuda com minha obra no Portal BWild.',
} as const;

export function getWhatsappSupportUrl(message?: string) {
  const text = encodeURIComponent(message ?? BWILD_SUPPORT.whatsappMessage);
  return `https://wa.me/${BWILD_SUPPORT.whatsappNumber}?text=${text}`;
}
