import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { debugAuth } from "@/lib/debugAuth";
import { logError, logInfo } from "@/lib/errorLogger";
import {
  isExpiredSessionError,
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

async function fetchRolesFromServer(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;

  return (data ?? []).map((r) => r.role as AppRole);
}

/**
 * Busca os papéis, RENOVANDO a sessão e tentando de novo quando o servidor
 * responde 401.
 *
 * Esta leitura não passa pelo TanStack Query — é uma chamada direta ao
 * Supabase — então a recuperação de sessão do `queryClient` nunca a alcança.
 * Sem este retry, um token vencido no primeiro carregamento (a renovação de
 * `installSessionRecovery` ainda em voo quando o React monta) deixava o
 * usuário parado na tela "Não conseguimos confirmar suas permissões", e o
 * botão de tentar novamente só repetia o mesmo 401.
 */
async function fetchRolesWithRecovery(userId: string): Promise<AppRole[]> {
  try {
    return await fetchRolesFromServer(userId);
  } catch (err) {
    if (!isExpiredSessionError(err)) throw err;

    debugAuth("useUserRole: 401 ao ler papéis, renovando a sessão", { userId });
    const recovered = await recoverFromAuthError();
    if (!recovered) throw err;

    return await fetchRolesFromServer(userId);
  }
}

function loadRoles(userId: string): Promise<AppRole[]> {
  const cached = roleCache.get(userId);
  if (cached) return Promise.resolve(cached);

  const existing = inFlightFetches.get(userId);
  if (existing) return existing;

  const promise = fetchRolesWithRecovery(userId)
    .then((roles) => {
      // Só cacheia resposta REAL do servidor.
      roleCache.set(userId, roles);
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
      setLoading(false);
      return;
    }

    const userId = user.id;

    const cached = roleCache.get(userId);
    if (cached) {
      setRoles(cached);
      setError(null);
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
        setRoles([]);
        setError(normalized);
        setSessionExpired(sessionIsDead);
        logError("Error fetching user roles", err, {
          component: "useUserRole",
          userId,
          isSessionError: sessionIsDead,
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
