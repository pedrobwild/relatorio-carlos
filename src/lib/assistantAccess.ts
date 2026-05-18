/**
 * O Assistente de IA é restrito a colaboradores BWild (e-mail
 * `@bwild.com.br`). Contas de cliente com pseudo-e-mail de CPF
 * (`<cpf>@cpf.bwild.com.br`) não correspondem — o caractere antes de
 * `bwild.com.br` é `.`, não `@` — então ficam corretamente de fora.
 */
export const BWILD_EMAIL_DOMAIN = "bwild.com.br";

export function isAssistantAllowed(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${BWILD_EMAIL_DOMAIN}`);
}
