/**
 * BWild contact channels surfaced from the mobile profile sheet and other
 * support entrypoints. Keep this file as the single source of truth so support
 * numbers / messages can be updated without hunting through components.
 */

/** WhatsApp number in E.164 (no spaces, no `+`). */
export const SUPPORT_WHATSAPP_NUMBER = "5511911906183";

export const SUPPORT_WHATSAPP_DEFAULT_MESSAGE =
  "Olá, preciso de ajuda no Portal BWild.";

export interface SupportWhatsappContext {
  /** Motivo curto (1 frase) — vira a primeira linha. Ex.: "Não consigo ver minha obra". */
  reason?: string;
  /** Nome do usuário (preferir nome completo; primeiro nome também serve). */
  userName?: string | null;
  /** E-mail logado — ajuda o atendente a localizar o cadastro. */
  userEmail?: string | null;
  /** Nome amigável da obra/projeto, quando o contexto for de uma obra específica. */
  projectName?: string | null;
  /** ID curto da obra — útil para o time interno cruzar com o backoffice. */
  projectId?: string | null;
}

function shortenId(id?: string | null): string | null {
  if (!id) return null;
  return id.length > 8 ? id.slice(0, 8) : id;
}

/**
 * Monta uma mensagem estruturada e identificada para o suporte, evitando que
 * o atendente precise pedir nome, e-mail ou identificador da obra. Mantém o
 * tom natural ("Olá, sou …") e adiciona linhas de contexto apenas quando há
 * informação útil — mensagem nunca fica poluída para usuários anônimos.
 */
export function buildSupportWhatsappMessage(
  ctx: SupportWhatsappContext = {},
): string {
  const reason = ctx.reason?.trim();
  const name = ctx.userName?.trim();
  const email = ctx.userEmail?.trim();
  const project = ctx.projectName?.trim();
  const projectIdShort = shortenId(ctx.projectId);

  const lines: string[] = [];

  // Saudação personalizada
  if (name) {
    lines.push(`Olá, sou ${name} e preciso de ajuda no Portal BWild.`);
  } else {
    lines.push(SUPPORT_WHATSAPP_DEFAULT_MESSAGE);
  }

  // Motivo (quando informado pelo CTA chamador)
  if (reason) {
    lines.push("");
    lines.push(`Motivo: ${reason}`);
  }

  // Bloco de contexto — só renderiza se há ao menos 1 campo
  const ctxLines: string[] = [];
  if (project) ctxLines.push(`• Obra: ${project}`);
  if (projectIdShort) ctxLines.push(`• ID: ${projectIdShort}`);
  if (email) ctxLines.push(`• E-mail: ${email}`);
  if (ctxLines.length > 0) {
    lines.push("");
    lines.push("Meus dados:");
    lines.push(...ctxLines);
  }

  return lines.join("\n");
}

/**
 * Compatível com a assinatura antiga (string) e com a nova (contexto).
 * Garante que chamadas legadas (`buildSupportWhatsappUrl("…")`) continuem
 * funcionando sem alteração.
 */
export function buildSupportWhatsappUrl(
  messageOrContext: string | SupportWhatsappContext = SUPPORT_WHATSAPP_DEFAULT_MESSAGE,
): string {
  const message =
    typeof messageOrContext === "string"
      ? messageOrContext
      : buildSupportWhatsappMessage(messageOrContext);
  const text = encodeURIComponent(message);
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${text}`;
}
