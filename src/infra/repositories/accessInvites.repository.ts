/**
 * Link de primeiro acesso (tabela `access_invites`, RPCs SECURITY DEFINER).
 *
 * A equipe gera um link de uso único, válido por 7 dias, e envia ao cliente
 * (WhatsApp/e-mail). O cliente cria a própria senha em /primeiro-acesso.
 */
import { supabase } from "@/infra/supabase";
import { executeQuery, type RepositoryResult } from "./base.repository";

export const FIRST_ACCESS_PATH = "/primeiro-acesso";

export type AccessInviteStatus = "valid" | "invalid" | "used" | "expired";

export interface AccessInviteInfo {
  status: AccessInviteStatus;
  email: string | null;
  displayName: string | null;
}

/** Monta a URL pública do link de primeiro acesso. */
export function buildFirstAccessUrl(token: string, origin: string): string {
  return `${origin}${FIRST_ACCESS_PATH}?t=${encodeURIComponent(token)}`;
}

export interface AccessLinkTarget {
  id: string;
  email: string;
  display_name?: string | null;
}

/** Texto pronto para enviar ao cliente. */
export function buildAccessLinkMessage(
  target: AccessLinkTarget,
  url: string,
): string {
  const firstName = target.display_name?.trim().split(/\s+/)[0];
  return [
    `Olá${firstName ? `, ${firstName}` : ""}! Seu acesso ao Portal Bwild está pronto.`,
    `Crie sua senha por este link (válido por 7 dias): ${url}`,
    `Seu login é: ${target.email}`,
  ].join("\n\n");
}

/** Gera um link novo (invalida o anterior ainda não usado). Só equipe. */
export async function createAccessInvite(
  userId: string,
): Promise<RepositoryResult<string>> {
  return executeQuery(
    async () =>
      await supabase.rpc("create_access_invite", { _user_id: userId }),
  );
}

/** Lê o convite sem consumir o token. */
export async function getAccessInvite(
  token: string,
): Promise<RepositoryResult<AccessInviteInfo>> {
  const result = await executeQuery(
    async () => await supabase.rpc("get_access_invite", { _token: token }),
  );
  if (result.error) return { data: null, error: result.error };
  const row = result.data?.[0];
  return {
    data: {
      status: (row?.status as AccessInviteStatus) ?? "invalid",
      email: row?.email ?? null,
      displayName: row?.display_name ?? null,
    },
    error: null,
  };
}

/** Define a senha e consome o token. Retorna o e-mail para o login. */
export async function redeemAccessInvite(
  token: string,
  password: string,
): Promise<RepositoryResult<string>> {
  return executeQuery(
    async () =>
      await supabase.rpc("redeem_access_invite", {
        _token: token,
        _password: password,
      }),
  );
}

/** Traduz os erros das RPCs (RAISE 'invite_*') para PT-BR. */
export function describeAccessInviteError(err: unknown): string {
  const msg =
    (err as { message?: string } | null)?.message?.toLowerCase() ?? "";
  if (msg.includes("invite_expired"))
    return "Este link expirou. Peça um novo link à equipe Bwild.";
  if (msg.includes("invite_used"))
    return "Este link já foi usado. Entre com sua senha ou peça um novo link.";
  if (msg.includes("invite_invalid"))
    return "Link inválido. Confira se copiou o link completo.";
  if (msg.includes("invite_weak_password"))
    return "A senha precisa ter entre 8 e 72 caracteres.";
  if (msg.includes("invite_user_blocked"))
    return "Esta conta está bloqueada. Fale com a equipe Bwild.";
  if (msg.includes("invite_forbidden_staff"))
    return "Apenas administradores podem gerar link para contas da equipe.";
  if (msg.includes("invite_forbidden"))
    return "Você não tem permissão para gerar este link.";
  if (msg.includes("invite_user_not_found")) return "Usuário não encontrado.";
  return "Não foi possível concluir. Tente novamente.";
}
