/**
 * authRecovery — detecção e recuperação de sessão expirada.
 *
 * PROBLEMA QUE ISTO RESOLVE
 * -------------------------
 * O app mantém a sessão no localStorage e confia no `autoRefreshToken` do
 * supabase-js. Em abas de vida longa (celular com a aba em segundo plano por
 * horas/dias, PWA na tela de início) os timers do browser são suspensos e o
 * refresh simplesmente não acontece. Quando o usuário volta, o app continua
 * "logado" localmente — o header mostra o nome dele — mas **todo** request ao
 * PostgREST/Storage responde 401 (`JWT expired`).
 *
 * O sintoma que o usuário reporta é "não consigo entrar":
 *  - `user_roles` falha  -> `useUserRole` não resolve o papel;
 *  - `get_user_projects_summary` falha -> "Não foi possível carregar seus projetos";
 *  - salvar relatório / atualizar atividade falha.
 *
 * Nada disso se recupera sozinho porque nenhum código chamava o refresh
 * novamente depois que a aba voltava.
 *
 * ESTRATÉGIA
 * ----------
 * 1. `ensureFreshSession()` — lê a sessão e, se o access token já expirou (ou
 *    está prestes a expirar), força `refreshSession()`. Chamadas concorrentes
 *    são dedupadas por um promise em escopo de módulo.
 * 2. `installSessionRecovery()` — reconecta o ciclo de vida do browser
 *    (`visibilitychange`, `focus`, `online`) ao passo 1, que é justamente o
 *    gatilho que faltava.
 * 3. `recoverFromAuthError()` — chamado quando uma query falha com erro de
 *    sessão: tenta um refresh antes de desistir; só desloga se o refresh
 *    falhar de verdade (refresh token revogado/expirado).
 */

import { supabase } from "@/integrations/supabase/client";
import { debugAuth } from "@/lib/debugAuth";
import { logError, logInfo } from "@/lib/errorLogger";

/** Renova o token quando faltar menos que isto para expirar. */
const REFRESH_MARGIN_SECONDS = 120;

/** Não repete a verificação com mais frequência que isto (exceto `force`). */
const MIN_CHECK_INTERVAL_MS = 10_000;

/**
 * Teto para a verificação inteira.
 *
 * `getSession()`/`refreshSession()` do supabase-js serializam por um lock de
 * navegador compartilhado entre abas. Se um lock ficar preso (aba morta,
 * processo suspenso pelo iOS), a promise nunca resolve — e sem este teto o
 * `inFlight` abaixo ficaria pendurado para sempre, travando toda tentativa
 * futura de recuperação. Exatamente o modo de falha que estamos corrigindo.
 */
const CHECK_TIMEOUT_MS = 15_000;

let inFlight: Promise<boolean> | null = null;
let inFlightForced = false;
let lastCheckAt = 0;
let installed = false;

/** Assinatura textual de um erro Supabase/HTTP, sem `String(obj)`. */
export function describeError(error: unknown): {
  text: string;
  code?: string;
  status?: number;
} {
  if (!error) return { text: "" };
  if (typeof error === "string") return { text: error };
  if (error instanceof Error) {
    const withExtras = error as Error & {
      code?: string | number;
      status?: number;
    };
    return {
      text: `${error.name} ${error.message}`,
      code: withExtras.code != null ? String(withExtras.code) : undefined,
      status: withExtras.status,
    };
  }
  if (typeof error === "object") {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      name?: string;
      code?: string | number;
      status?: number;
      statusCode?: number;
      error?: { message?: string; code?: string };
      error_description?: string;
    };
    const parts = [
      err.message,
      err.details,
      err.hint,
      err.name,
      err.error?.message,
      err.error_description,
      err.code != null ? String(err.code) : undefined,
      err.status != null ? String(err.status) : undefined,
      err.statusCode != null ? String(err.statusCode) : undefined,
    ].filter(Boolean);
    return {
      text: parts.join(" | "),
      code: err.code != null ? String(err.code) : err.error?.code,
      status: err.status ?? err.statusCode,
    };
  }
  return { text: "" };
}

const EXPIRED_SESSION_PATTERNS =
  /jwt\s*expired|jwt\s*is\s*expired|invalid\s*jwt|jwt\s*malformed|token\s*is\s*expired|invalid\s*claim|bad_jwt|session[_\s]*expired|refresh[_\s]*token[_\s]*not[_\s]*found|invalid\s*refresh\s*token|not\s*authenticated|no\s*api\s*key/i;

/**
 * O erro indica que a credencial atual não vale mais (401 / JWT expirado).
 *
 * Não confundir com 403/RLS: ali a sessão é válida, falta permissão — e
 * deslogar o usuário seria errado.
 */
export function isExpiredSessionError(error: unknown): boolean {
  const { text, code, status } = describeError(error);
  if (status === 401) return true;
  // PGRST301 = JWT inválido/expirado no PostgREST.
  if (code === "PGRST301" || code === "401") return true;
  if (!text) return false;
  return EXPIRED_SESSION_PATTERNS.test(text);
}

function withTimeout(promise: Promise<boolean>): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      debugAuth("ensureFreshSession: timeout", { ms: CHECK_TIMEOUT_MS });
      resolve(false);
    }, CHECK_TIMEOUT_MS);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

const BACKEND_UNAVAILABLE_PATTERNS =
  /schema\s*cache|connection\s*pool|service\s*unavailable|bad\s*gateway|gateway\s*time-?out|timed\s*out\s*acquiring/i;

/**
 * O BACKEND esta indisponivel — a credencial do usuario esta boa.
 *
 * Foi exatamente este caso que derrubou o portal por horas: o PostgREST ficou
 * sem conexoes no proprio pool (PGRST003) e nao conseguiu recarregar o schema
 * cache (PGRST002), passando a responder 503 em TODA requisicao REST. Como a
 * leitura de papeis falhava, o app mostrava "Nao conseguimos confirmar suas
 * permissoes" — uma mensagem que joga a culpa na conta do usuario e nao se
 * recupera sozinha quando o backend volta.
 *
 * Isto NAO e sessao expirada (renovar token nao resolve) nem falta de
 * permissao (o papel existe). E indisponibilidade temporaria: o certo e
 * avisar que ha instabilidade e tentar de novo.
 */
export function isBackendUnavailableError(error: unknown): boolean {
  const { text, code, status } = describeError(error);
  if (status === 502 || status === 503 || status === 504) return true;
  // PGRST002: nao conseguiu ler o schema cache. PGRST003: estourou o tempo
  // esperando uma conexao do pool do PostgREST.
  if (code === "PGRST002" || code === "PGRST003") return true;
  if (!text) return false;
  if (/\b(502|503|504)\b/.test(text)) return true;
  return BACKEND_UNAVAILABLE_PATTERNS.test(text);
}

async function checkAndRefresh(force: boolean): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    debugAuth("ensureFreshSession: getSession error", {
      message: describeError(error).text,
    });
    return false;
  }

  const session = data?.session ?? null;
  if (!session) {
    debugAuth("ensureFreshSession: sem sessão");
    return false;
  }

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const msToExpiry = expiresAtMs ? expiresAtMs - Date.now() : Number.NaN;
  const needsRefresh =
    force ||
    !expiresAtMs ||
    Number.isNaN(msToExpiry) ||
    msToExpiry <= REFRESH_MARGIN_SECONDS * 1000;

  if (!needsRefresh) {
    debugAuth("ensureFreshSession: token ainda válido", {
      secondsToExpiry: Math.round(msToExpiry / 1000),
    });
    return true;
  }

  debugAuth("ensureFreshSession: renovando token", {
    secondsToExpiry: Number.isNaN(msToExpiry)
      ? null
      : Math.round(msToExpiry / 1000),
    force,
  });

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession();

  if (refreshError || !refreshed?.session) {
    // Refresh token revogado/expirado — a sessão morreu de verdade.
    logError(
      "Falha ao renovar a sessão",
      refreshError ?? new Error("refreshSession sem sessão"),
      { component: "authRecovery", secondsExpired: Math.round(-msToExpiry / 1000) },
    );
    return false;
  }

  logInfo("Sessão renovada", {
    component: "authRecovery",
    wasExpired: msToExpiry <= 0,
  });
  return true;
}

/**
 * Garante que o access token está válido. Resolve `true` quando há sessão
 * utilizável e `false` quando o usuário precisa entrar de novo.
 *
 * Chamadas concorrentes compartilham a mesma promise — várias telas podem
 * chamar em paralelo sem multiplicar refreshes (e sem correr o risco de
 * invalidar o refresh token uma na outra, já que ele é rotativo).
 */
export function ensureFreshSession(
  opts: { force?: boolean } = {},
): Promise<boolean> {
  const force = !!opts.force;

  if (inFlight) {
    // Um pedido FORÇADO não pode ser atendido por uma verificação passiva já em
    // voo: a passiva devolve `true` sem renovar quando o token ainda não está
    // perto de expirar, e quem chamou forçado acabou de tomar um 401. Espera a
    // que está rodando e então força de verdade.
    if (!force || inFlightForced) return inFlight;
    return inFlight.then(() => ensureFreshSession({ force: true }));
  }

  if (!force && Date.now() - lastCheckAt < MIN_CHECK_INTERVAL_MS) {
    return Promise.resolve(true);
  }

  const promise = withTimeout(checkAndRefresh(force))
    .catch((err) => {
      logError("Erro inesperado ao verificar a sessão", err, {
        component: "authRecovery",
      });
      return false;
    })
    .finally(() => {
      lastCheckAt = Date.now();
      if (inFlight === promise) {
        inFlight = null;
        inFlightForced = false;
      }
    });

  inFlight = promise;
  inFlightForced = force;
  return promise;
}

/**
 * Chamado quando uma requisição falhou com erro de sessão.
 *
 * Tenta renovar antes de desistir: na maioria das vezes o token só expirou
 * enquanto a aba estava em segundo plano e o refresh resolve sem que o
 * usuário perceba. Retorna `true` se a sessão foi recuperada.
 */
export function recoverFromAuthError(): Promise<boolean> {
  return ensureFreshSession({ force: true });
}

/**
 * Liga o ciclo de vida do browser à verificação de sessão.
 *
 * Este é o gatilho que faltava: sem ele, uma aba que ficou horas em segundo
 * plano volta com um token expirado e nunca o renova.
 */
export function installSessionRecovery(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const check = (reason: string) => {
    debugAuth("installSessionRecovery: verificando", { reason });
    void ensureFreshSession();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check("visibilitychange");
  });
  window.addEventListener("focus", () => check("focus"));
  window.addEventListener("online", () => check("online"));
  window.addEventListener("pageshow", () => check("pageshow"));

  // Verificação inicial: cobre o carregamento a partir de uma sessão antiga
  // restaurada do localStorage (o caso do "abri o app e não carrega nada").
  check("bootstrap");
}

/** Somente para testes. */
export function __resetAuthRecoveryForTests(): void {
  inFlight = null;
  inFlightForced = false;
  lastCheckAt = 0;
  installed = false;
}
