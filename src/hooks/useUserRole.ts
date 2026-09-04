import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { debugAuth } from "@/lib/debugAuth";
import { logError, logInfo } from "@/lib/errorLogger";
import {
  isExpiredSessionError,
  isBackendUnavailableError,
  isConnectionFailure,
  describeError,
  recoverFromAuthError,
} from "@/lib/authRecovery";

export type AppRole =
  | "engineer"
  | "admin"
  | "customer"
  | "manager"
  | "suprimentos"
  | "financeiro"
  | "gestor"
  | "cs"
  | "arquitetura";

interface UserRoleState {
  roles: AppRole[];
  /** @deprecated Use roles array instead. Returns the first/primary role for backwards compatibility */
  role: AppRole | null;
  loading: boolean;
  /**
   * Preenchido quando a leitura de `user_roles` FALHOU (rede, 401, RLS).
   *
   * É diferente de "usuário sem papel": aqui não sabemos qual é o papel. Quem
   * decide navegação (ProtectedRoute/AuthRedirect) deve mostrar um estado de
   * erro com "tentar novamente" em vez de assumir um papel.
   */
  error: Error | null;
  /** A sessão morreu (refresh já tentado e recusado) — mande entrar de novo. */
  sessionExpired: boolean;
  /**
   * O backend está indisponível (503/PGRST002/PGRST003), não a conta do
   * usuário. A UI deve falar em instabilidade, não em permissão.
   */
  backendUnavailable: boolean;
  /** A requisição não chegou ao servidor (rede/DNS/offline). */
  connectionFailed: boolean;
  refetch: () => void;
  isStaff: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isManager: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

// Cache roles by user ID to prevent refetches on re-mounts.
// SÓ guarda resultados que vieram do servidor — nunca um fallback de erro.
const roleCache = new Map<string, AppRole[]>();

/**
 * Fetches em andamento, por usuário.
 *
 * Guardamos a PROMISE, não apenas um marcador booleano. Antes isto era um
 * `Set` e a segunda instância do hook simplesmente dava `return` ao ver o
 * marcador — sem nunca receber o resultado e sem sair de `loading: true`.
 * Como `ProtectedRoute` renderiza um skeleton enquanto `loading` for true,
 * qualquer tela que montasse dois `useUserRole` em paralelo tinha chance de
 * ficar presa no skeleton para sempre ("não consigo entrar").
 */
const inFlightFetches = new Map<string, Promise<AppRole[]>>();

/**
 * Lê os papéis PRESERVANDO o status HTTP.
 *
 * O postgrest-js entrega o corpo cru do PostgREST como `error`
 * (`error = JSON.parse(body)`) e devolve `status` como campo IRMÃO no mesmo
 * objeto de resposta. Um `throw error` simples descarta o status — e com isso
 * as guardas `status === 401` e `status === 503` de authRecovery viravam
 * código morto para TODA leitura via `.from()`.
 *
 * Isso não é teórico: quando o corpo não é JSON conhecido (HTML de gateway,
 * texto do proxy, ou a resposta 503 sintética do service worker), o
 * postgrest-js monta `{ message: body }` — sem `code` e sem `status`. Sem o
 * status anexado aqui, esse erro escapa das duas classificações e o usuário
 * cai na tela de permissões com a sessão perfeitamente saudável.
 */
/**
 * Rejeita se a promise não resolver a tempo.
 *
 * O erro carrega `status: 504` e a palavra "timeout" para ser classificado
 * como indisponibilidade/falha de conexão pelo authRecovery, e não como
 * sessão morta — timeout NUNCA é prova de credencial inválida.
 */
function withDeadline<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        Object.assign(new Error("Tempo esgotado ao falar com o servidor"), {
          name: "TimeoutError",
          status: 504,
        }),
      );
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Teto para a leitura de papéis.
 *
 * Sem isto, uma requisição PENDURADA (rede que aceita a conexão e nunca
 * responde — firewall, portal cativo, DNS sequestrado) deixa `loading` em true
 * para sempre, e o usuário fica olhando o esqueleto do ProtectedRoute
 * indefinidamente: sem mensagem, sem botão, sem saída. Falhar é melhor que
 * pendurar — o erro entra no backoff que já existe e, no fim, vira uma tela
 * explicativa com "Tentar novamente".
 */
const ROLE_FETCH_TIMEOUT_MS = 12_000;

async function fetchRolesFromServer(userId: string): Promise<AppRole[]> {
  const response = await withDeadline(
    supabase.from("user_roles").select("role").eq("user_id", userId),
    ROLE_FETCH_TIMEOUT_MS,
  );

  if (response.error) {
    throw Object.assign(
      new Error(response.error.message || "Falha ao ler permissões"),
      response.error,
      { status: response.status, statusText: response.statusText },
    );
  }

  return (response.data ?? []).map((r) => r.role as AppRole);
}

/**
 * Espera com jitter, para que N abas nao voltem todas no mesmo instante e
 * recriem a avalanche que derrubou o backend.
 */
function wait(ms: number): Promise<void> {
  const jitter = Math.floor(Math.random() * 400);
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

/** Backoff para indisponibilidade do backend. LIMITADO de proposito. */
const UNAVAILABLE_DELAYS_MS = [2000, 6000, 15000];

/**
 * Busca os papéis lidando com as duas falhas que travam a entrada.
 *
 * Esta leitura não passa pelo TanStack Query — é chamada direta ao Supabase —
 * então a recuperação de sessão do `queryClient` nunca a alcança.
 *
 * 1. 401 / sessão expirada → renova o token e refaz a leitura uma vez.
 *    Sem isso, um token vencido no boot (a renovação de installSessionRecovery
 *    ainda em voo quando o React monta) travava o usuário na tela de
 *    permissões, e o botão de tentar novamente só repetia o mesmo 401.
 *
 * 2. 503 / backend indisponível (PGRST002 schema cache, PGRST003 pool
 *    esgotado) → tenta de novo com backoff limitado. Foi este o caso que
 *    manteve o portal fora do ar: a credencial estava boa, o PostgREST é que
 *    não respondia, e o app tratava isso como problema da conta do usuário.
 *
 * O número de tentativas é PEQUENO e com jitter de propósito: o incidente que
 * originou este código foi causado por retentativa sem limite martelando o
 * banco. Esgotado o orçamento, o erro sobe e quem decide é o usuário.
 */
async function fetchRolesWithRecovery(userId: string): Promise<AppRole[]> {
  let sessionRetryUsed = false;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchRolesFromServer(userId);
    } catch (err) {
      if (isExpiredSessionError(err)) {
        if (sessionRetryUsed) throw err;
        sessionRetryUsed = true;
        debugAuth("useUserRole: 401 ao ler papéis, renovando a sessão", {
          userId,
        });
        const recovered = await recoverFromAuthError();
        if (!recovered) throw err;
        continue;
      }

      if (!isBackendUnavailableError(err)) throw err;

      const delay = UNAVAILABLE_DELAYS_MS[attempt];
      if (delay === undefined) throw err;

      debugAuth("useUserRole: backend indisponível, tentando de novo", {
        userId,
        attempt: attempt + 1,
        delay,
      });
      await wait(delay);
    }
  }
}

function loadRoles(userId: string): Promise<AppRole[]> {
  const cached = roleCache.get(userId);
  if (cached) return Promise.resolve(cached);

  const existing = inFlightFetches.get(userId);
  if (existing) return existing;

  const promise = fetchRolesWithRecovery(userId)
    .then((roles) => {
      // NUNCA cachear lista vazia.
      //
      // A policy de user_roles é `user_id = auth.uid()`. Quando o supabase-js
      // não tem sessão carregada ainda, ele envia a chave anônima como Bearer:
      // `auth.uid()` é NULL, a leitura devolve 200 com [] e NENHUM erro.
      // Verificado no banco: o papel `anon` enxerga 0 linhas em user_roles.
      //
      // Cachear isso gravava "usuário sem papel" de forma definitiva — o
      // usuário passava a ser expulso para /auth sem nenhuma mensagem de erro,
      // porque do ponto de vista do código a resposta foi um sucesso.
      if (roles.length > 0) {
        roleCache.set(userId, roles);
      }
      return roles;
    })
    .finally(() => {
      if (inFlightFetches.get(userId) === promise) {
        inFlightFetches.delete(userId);
      }
    });

  inFlightFetches.set(userId, promise);
  return promise;
}

export function useUserRole(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>(() => {
    if (user?.id && roleCache.has(user.id)) {
      return roleCache.get(user.id) ?? [];
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /**
   * True quando a leitura falhou porque a sessão morreu de vez — o refresh
   * token não vale mais e a renovação já foi tentada. Aqui não adianta
   * "tentar novamente": o caminho de saída é entrar na conta de novo.
   */
  const [sessionExpired, setSessionExpired] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRoles([]);
      setError(null);
      setSessionExpired(false);
      setBackendUnavailable(false);
      setConnectionFailed(false);
      setLoading(false);
      return;
    }

    const userId = user.id;

    const cached = roleCache.get(userId);
    if (cached) {
      setRoles(cached);
      setError(null);
      // Limpar TAMBÉM os dois sinalizadores de falha. Sem isto, uma instância
      // que já tinha marcado `sessionExpired` continuava mandando para /auth
      // mesmo com os papéis carregados do cache — expulsando um usuário
      // perfeitamente autenticado.
      setSessionExpired(false);
      setBackendUnavailable(false);
      setConnectionFailed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    debugAuth("useUserRole: fetching roles", { userId });

    loadRoles(userId)
      .then((fetched) => {
        if (cancelled || !isMounted.current) return;
        setRoles(fetched);
        setError(null);
        setSessionExpired(false);
        setBackendUnavailable(false);
        setConnectionFailed(false);
      setConnectionFailed(false);
        logInfo("User roles fetched", { userId, roles: fetched });
        debugAuth("useUserRole: roles fetched", { userId, roles: fetched });
      })
      .catch((err) => {
        if (cancelled || !isMounted.current) return;

        // NÃO assumimos "customer" aqui.
        //
        // O fallback antigo (`roles = ["customer"]`, ainda por cima cacheado)
        // rebaixava um admin a cliente sempre que a leitura falhasse — era
        // por isso que um admin com o token vencido caía no "Portal do
        // Cliente" em vez de ver o erro de sessão. Agora o erro sobe.
        const normalized =
          err instanceof Error
            ? err
            : new Error(describeError(err).text || "Erro ao carregar permissões");
        const sessionIsDead = isExpiredSessionError(err);
        const backendIsDown = !sessionIsDead && isBackendUnavailableError(err);
        // Só é "falha de conexão" quando o servidor não chegou a responder.
        // Um 5xx é resposta: o problema é do lado de lá, não do usuário.
        const cannotReach =
          !sessionIsDead && !backendIsDown && isConnectionFailure(err);
        setRoles([]);
        setError(normalized);
        setSessionExpired(sessionIsDead);
        setBackendUnavailable(backendIsDown);
        setConnectionFailed(cannotReach);
        const { code, status } = describeError(err);
        logError("Error fetching user roles", err, {
          component: "useUserRole",
          userId,
          isSessionError: sessionIsDead,
          isBackendUnavailable: backendIsDown,
          isConnectionFailure: cannotReach,
          httpStatus: status,
          errorCode: code,
        });
      })
      .finally(() => {
        if (cancelled || !isMounted.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, attempt]);

  const refetch = useCallback(() => {
    if (user?.id) {
      roleCache.delete(user.id);
      inFlightFetches.delete(user.id);
    }
    setAttempt((n) => n + 1);
  }, [user?.id]);

  // Helper functions
  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback(
    (checkRoles: AppRole[]) => checkRoles.some((r) => roles.includes(r)),
    [roles],
  );

  // Compute derived states based on all roles
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isStaff =
    roles.includes("engineer") ||
    isAdmin ||
    isManager ||
    roles.includes("gestor") ||
    roles.includes("suprimentos") ||
    roles.includes("financeiro") ||
    roles.includes("cs") ||
    roles.includes("arquitetura");
  const isCustomer = roles.includes("customer");

  return {
    roles,
    // Backwards compatibility: return first role (prioritize staff roles)
    role: isAdmin
      ? "admin"
      : isManager
        ? "manager"
        : roles.includes("engineer")
          ? "engineer"
          : roles[0] || null,
    loading: loading || authLoading,
    error,
    sessionExpired,
    backendUnavailable,
    connectionFailed,
    refetch,
    isStaff,
    isAdmin,
    isCustomer,
    isManager,
    hasRole,
    hasAnyRole,
  };
}

// Export function to clear cache (useful for testing or logout)
export function clearRoleCache(): void {
  roleCache.clear();
  inFlightFetches.clear();
}
