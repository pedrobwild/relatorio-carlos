import { supabase } from "@/integrations/supabase/client";
import { RESET_PASSWORD_PATH } from "@/lib/passwordRecoveryRedirect";

/**
 * Rede de segurança para o fluxo de recuperação: se o Supabase sinalizar
 * PASSWORD_RECOVERY com o usuário fora de /redefinir-senha (ex.: link no
 * formato PKCE `?code=`, que não dá para reconhecer só pela URL), leva o
 * usuário para a tela de nova senha em vez de deixá-lo cair no painel.
 */
export function installPasswordRecoveryListener(): void {
  if (typeof window === "undefined") return;
  supabase.auth.onAuthStateChange((event) => {
    if (event !== "PASSWORD_RECOVERY") return;
    if (window.location.pathname === RESET_PASSWORD_PATH) return;
    window.history.replaceState(window.history.state, "", RESET_PASSWORD_PATH);
    // BrowserRouter só escuta popstate; replaceState não dispara o evento.
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
