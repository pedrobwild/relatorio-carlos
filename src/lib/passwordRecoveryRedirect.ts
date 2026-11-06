/**
 * Garante que o link de "esqueci minha senha" sempre caia em /redefinir-senha.
 *
 * O e-mail de recuperação do Supabase só respeita o `redirectTo` quando a URL
 * está na allowlist do projeto. Fora dela (domínio novo, preview, app aberto
 * pelo navegador interno do Gmail/iOS), o Supabase manda o usuário para a Site
 * URL — a raiz `/` — com os tokens no hash. A raiz faz o redirecionamento por
 * papel (cliente → /minhas-obras), o usuário entra logado e nunca vê o
 * formulário de nova senha. Na próxima vez, a senha antiga continua valendo
 * e ele fica sem acesso.
 *
 * Este módulo NÃO pode importar nada: precisa rodar antes do cliente do
 * Supabase ser criado (ele lê e limpa o hash da URL ao inicializar). Por isso
 * é o primeiro import de `main.tsx`.
 */

export const RESET_PASSWORD_PATH = "/redefinir-senha";

function parseParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.replace(/^[#?]/, ""));
}

/** O hash/query traz um retorno do fluxo de recuperação (sucesso ou erro). */
export function isRecoveryCallback(hash: string, search: string): boolean {
  const h = parseParams(hash);
  const q = parseParams(search);
  if (h.get("type") === "recovery" || q.get("type") === "recovery") return true;
  // Link expirado/já usado: o Supabase devolve só o erro, sem `type`.
  const errorCode = h.get("error_code") ?? q.get("error_code");
  return errorCode === "otp_expired";
}

/**
 * Erro devolvido pelo Supabase no link (ex.: `otp_expired` quando o link já
 * foi usado — inclusive por antivírus/pré-visualização do e-mail — ou venceu).
 * Capturado aqui porque o cliente do Supabase limpa o hash ao inicializar.
 */
export let initialRecoveryError: { code: string; description: string } | null =
  null;

function captureRecoveryError(hash: string, search: string): void {
  const h = parseParams(hash);
  const q = parseParams(search);
  const code = h.get("error_code") ?? q.get("error_code");
  if (!code) return;
  initialRecoveryError = {
    code,
    description: h.get("error_description") ?? q.get("error_description") ?? "",
  };
}

export function redirectRecoveryLinkToResetPage(): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  if (!isRecoveryCallback(hash, search)) return;
  captureRecoveryError(hash, search);
  if (pathname === RESET_PASSWORD_PATH) return;

  // Mantém query e hash: o cliente do Supabase lê os tokens daí.
  window.history.replaceState(
    window.history.state,
    "",
    `${RESET_PASSWORD_PATH}${search}${hash}`,
  );
}

redirectRecoveryLinkToResetPage();
