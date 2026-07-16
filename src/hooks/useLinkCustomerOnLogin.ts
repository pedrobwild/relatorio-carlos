/**
 * useLinkCustomerOnLogin Hook
 *
 * Automatically links logged-in users to their projects based on email matching.
 * This solves the case where a user is registered as a customer in project_customers
 * (by email) but their user_id hasn't been linked yet.
 *
 * PERFORMANCE: This hook is called from useAuth, which itself is mounted in many
 * components across the app. Without coordination, each mount would issue its own
 * lookup against `project_customers` (1–2s each on cold cache). To avoid this:
 *  1. Staff users are skipped entirely — they are never customers.
 *  2. A module-level promise dedupes parallel invocations across all components.
 *  3. A sessionStorage flag prevents the lookup from repeating within a tab session.
 *
 * OBSERVABILIDADE: Toda invocação é instrumentada com contadores globais e
 * medição de duração (fetch + update no Supabase). Métricas são enviadas via
 * `logInfo` (com estrutura para agregação) e `trackAmplitude` — usadas para
 * identificar gargalos de RLS/latência no `project_customers` e monitorar a
 * eficácia do dedup por sessão.
 */

import { useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logInfo, logError } from "@/lib/errorLogger";
import { trackAmplitude } from "@/lib/amplitude";

const SESSION_FLAG_PREFIX = "bwild:customer-linked:";

// Module-level dedup: only one in-flight link operation per user id at a time
const inFlight = new Map<string, Promise<void>>();

// -------- Métricas / instrumentação --------

type EnsureOutcome =
  | "skipped_no_user"
  | "skipped_session_flag"
  | "skipped_staff"
  | "dedup_hit"
  | "no_unlinked"
  | "linked"
  | "fetch_error"
  | "update_error"
  | "unexpected_error";

interface EnsureMetrics {
  invocations: number;
  forced: number;
  dedup_hits: number;
  session_skips: number;
  staff_skips: number;
  successes: number;
  failures: number;
  total_duration_ms: number;
  total_fetch_ms: number;
  total_update_ms: number;
  last_outcome: EnsureOutcome | null;
}

const metrics: EnsureMetrics = {
  invocations: 0,
  forced: 0,
  dedup_hits: 0,
  session_skips: 0,
  staff_skips: 0,
  successes: 0,
  failures: 0,
  total_duration_ms: 0,
  total_fetch_ms: 0,
  total_update_ms: 0,
  last_outcome: null,
};

// Contagem de tentativas por usuário (útil para detectar loops / retries em
// excesso disparados pelo ProjectContext).
const attemptsByUser = new Map<string, number>();

/**
 * Retorna um snapshot imutável das métricas acumuladas na sessão atual.
 * Útil para inspecionar no console (`window.__bwildEnsureLinkMetrics()`)
 * ou expor em uma tela de debug.
 */
export function getEnsureCustomerProjectLinkMetrics(): Readonly<EnsureMetrics> {
  return { ...metrics };
}

export function getEnsureCustomerProjectLinkAttempts(
  userId: string,
): number {
  return attemptsByUser.get(userId) ?? 0;
}

// Expõe em dev para inspeção rápida no DevTools sem imports.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__bwildEnsureLinkMetrics =
    getEnsureCustomerProjectLinkMetrics;
}

function recordOutcome(
  outcome: EnsureOutcome,
  timings: { total_ms: number; fetch_ms?: number; update_ms?: number },
  context: {
    userId: string;
    email?: string;
    forced: boolean;
    attempt: number;
    linked_count?: number;
    error?: unknown;
  },
): void {
  metrics.last_outcome = outcome;
  metrics.total_duration_ms += timings.total_ms;
  if (timings.fetch_ms != null) metrics.total_fetch_ms += timings.fetch_ms;
  if (timings.update_ms != null) metrics.total_update_ms += timings.update_ms;

  const isFailure =
    outcome === "fetch_error" ||
    outcome === "update_error" ||
    outcome === "unexpected_error";
  if (isFailure) metrics.failures += 1;
  else if (outcome === "linked" || outcome === "no_unlinked") {
    metrics.successes += 1;
  }

  const payload = {
    outcome,
    duration_ms: Math.round(timings.total_ms),
    fetch_ms:
      timings.fetch_ms != null ? Math.round(timings.fetch_ms) : undefined,
    update_ms:
      timings.update_ms != null ? Math.round(timings.update_ms) : undefined,
    forced: context.forced,
    attempt: context.attempt,
    linked_count: context.linked_count ?? 0,
    userId: context.userId,
    email: context.email,
    // Snapshot de métricas globais — permite correlacionar picos de retries.
    global_invocations: metrics.invocations,
    global_dedup_hits: metrics.dedup_hits,
    global_failures: metrics.failures,
  };

  if (isFailure) {
    logError(
      "ensureCustomerProjectLink failure",
      context.error ?? new Error(outcome),
      { component: "useLinkCustomerOnLogin", ...payload },
    );
  } else {
    logInfo("ensureCustomerProjectLink metrics", payload);
  }

  try {
    trackAmplitude("Customer Link Ensure", payload);
  } catch {
    // amplitude opt-out — ignore
  }
}

async function linkCustomerToProjects(
  user: User,
  meta: { forced: boolean; attempt: number; startedAt: number },
): Promise<void> {
  if (!user.email) return;

  const role = (user.user_metadata as { role?: string } | null)?.role;
  const STAFF_ROLES = new Set([
    "admin",
    "manager",
    "engineer",
    "gestor",
    "suprimentos",
    "financeiro",
    "cs",
    "arquitetura",
  ]);
  if (role && STAFF_ROLES.has(role)) {
    setSessionFlag(user.id);
    metrics.staff_skips += 1;
    recordOutcome(
      "skipped_staff",
      { total_ms: performance.now() - meta.startedAt },
      { userId: user.id, forced: meta.forced, attempt: meta.attempt },
    );
    return;
  }

  const normalizedEmail = user.email.trim().toLowerCase();

  const fetchStart = performance.now();
  try {
    const { data: unlinkedProjects, error: fetchError } = await supabase
      .from("project_customers")
      .select("id, project_id, customer_name")
      .eq("customer_email", normalizedEmail)
      .is("customer_user_id", null);
    const fetch_ms = performance.now() - fetchStart;

    if (fetchError) {
      recordOutcome(
        "fetch_error",
        { total_ms: performance.now() - meta.startedAt, fetch_ms },
        {
          userId: user.id,
          email: normalizedEmail,
          forced: meta.forced,
          attempt: meta.attempt,
          error: fetchError,
        },
      );
      return;
    }

    if (!unlinkedProjects || unlinkedProjects.length === 0) {
      setSessionFlag(user.id);
      recordOutcome(
        "no_unlinked",
        { total_ms: performance.now() - meta.startedAt, fetch_ms },
        {
          userId: user.id,
          email: normalizedEmail,
          forced: meta.forced,
          attempt: meta.attempt,
          linked_count: 0,
        },
      );
      return;
    }

    const updateStart = performance.now();
    const { error: updateError } = await supabase
      .from("project_customers")
      .update({ customer_user_id: user.id })
      .eq("customer_email", normalizedEmail)
      .is("customer_user_id", null);
    const update_ms = performance.now() - updateStart;

    if (updateError) {
      recordOutcome(
        "update_error",
        {
          total_ms: performance.now() - meta.startedAt,
          fetch_ms,
          update_ms,
        },
        {
          userId: user.id,
          email: normalizedEmail,
          forced: meta.forced,
          attempt: meta.attempt,
          error: updateError,
        },
      );
      return;
    }

    // As linhas de project_members são criadas no banco pelo trigger
    // trg_ensure_project_member_for_customer (migration 20260716120000) quando
    // customer_user_id é preenchido acima — o cliente não tem permissão de
    // INSERT em project_members, então não tentamos criar aqui.

    setSessionFlag(user.id);
    recordOutcome(
      "linked",
      {
        total_ms: performance.now() - meta.startedAt,
        fetch_ms,
        update_ms,
      },
      {
        userId: user.id,
        email: normalizedEmail,
        forced: meta.forced,
        attempt: meta.attempt,
        linked_count: unlinkedProjects.length,
      },
    );
  } catch (err) {
    recordOutcome(
      "unexpected_error",
      { total_ms: performance.now() - meta.startedAt },
      {
        userId: user.id,
        email: normalizedEmail,
        forced: meta.forced,
        attempt: meta.attempt,
        error: err,
      },
    );
  }
}

function getSessionFlag(userId: string): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

function setSessionFlag(userId: string): void {
  try {
    sessionStorage.setItem(SESSION_FLAG_PREFIX + userId, "1");
  } catch {
    // ignore
  }
}

/**
 * Garante que o usuário logado está vinculado aos seus projetos por e-mail.
 *
 * Com `force: true` ignora a flag de sessionStorage — necessário quando um
 * projeto foi criado DEPOIS de a flag ter sido gravada nesta aba (ex.: cliente
 * antigo recebendo uma obra nova) e o deep link cai em "Projeto não
 * encontrado". Invocações paralelas são dedupadas pelo mapa in-flight.
 */
export function ensureCustomerProjectLink(
  user: User | null,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (!user?.email || !user?.id) return Promise.resolve();

  const forced = !!opts.force;
  metrics.invocations += 1;
  if (forced) metrics.forced += 1;

  if (!forced && getSessionFlag(user.id)) {
    metrics.session_skips += 1;
    metrics.last_outcome = "skipped_session_flag";
    return Promise.resolve();
  }

  const existing = inFlight.get(user.id);
  if (existing) {
    metrics.dedup_hits += 1;
    metrics.last_outcome = "dedup_hit";
    return existing;
  }

  const attempt = (attemptsByUser.get(user.id) ?? 0) + 1;
  attemptsByUser.set(user.id, attempt);
  const startedAt = performance.now();

  const promise: Promise<void> = Promise.resolve().then(() =>
    linkCustomerToProjects(user, { forced, attempt, startedAt }).finally(
      () => {
        if (inFlight.get(user.id) === promise) {
          inFlight.delete(user.id);
        }
      },
    ),
  );
  inFlight.set(user.id, promise);
  return promise;
}

export function useLinkCustomerOnLogin(user: User | null) {
  useEffect(() => {
    void ensureCustomerProjectLink(user);
  }, [user]);
}
