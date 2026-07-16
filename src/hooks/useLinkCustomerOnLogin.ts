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
 */

import { useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logInfo, logError } from "@/lib/errorLogger";

const SESSION_FLAG_PREFIX = "bwild:customer-linked:";

// Module-level dedup: only one in-flight link operation per user id at a time
const inFlight = new Map<string, Promise<void>>();

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

async function linkCustomerToProjects(user: User): Promise<void> {
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
    return;
  }

  const normalizedEmail = user.email.trim().toLowerCase();

  try {
    const { data: unlinkedProjects, error: fetchError } = await supabase
      .from("project_customers")
      .select("id, project_id, customer_name")
      .eq("customer_email", normalizedEmail)
      .is("customer_user_id", null);

    if (fetchError) {
      logError("Error fetching unlinked projects", fetchError, {
        component: "useLinkCustomerOnLogin",
        email: normalizedEmail,
      });
      return;
    }

    if (!unlinkedProjects || unlinkedProjects.length === 0) {
      setSessionFlag(user.id);
      return;
    }

    const { error: updateError } = await supabase
      .from("project_customers")
      .update({ customer_user_id: user.id })
      .eq("customer_email", normalizedEmail)
      .is("customer_user_id", null);

    if (updateError) {
      logError("Error linking customer to projects", updateError, {
        component: "useLinkCustomerOnLogin",
        userId: user.id,
        email: normalizedEmail,
      });
      return;
    }

    // As linhas de project_members são criadas no banco pelo trigger
    // trg_ensure_project_member_for_customer (migration 20260716120000) quando
    // customer_user_id é preenchido acima — o cliente não tem permissão de
    // INSERT em project_members, então não tentamos criar aqui.

    const projectNames = unlinkedProjects
      .map((p) => p.customer_name || p.project_id)
      .join(", ");
    logInfo("Customer linked to projects on login", {
      userId: user.id,
      email: normalizedEmail,
      linkedCount: unlinkedProjects.length,
      projects: projectNames,
    });

    setSessionFlag(user.id);
  } catch (err) {
    logError("Unexpected error linking customer", err, {
      component: "useLinkCustomerOnLogin",
      userId: user.id,
    });
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

  if (!opts.force && getSessionFlag(user.id)) return Promise.resolve();

  const existing = inFlight.get(user.id);
  if (existing) return existing;

  const promise: Promise<void> = Promise.resolve().then(() =>
    linkCustomerToProjects(user).finally(() => {
      if (inFlight.get(user.id) === promise) {
        inFlight.delete(user.id);
      }
    }),
  );
  inFlight.set(user.id, promise);
  return promise;
}

export function useLinkCustomerOnLogin(user: User | null) {
  useEffect(() => {
    void ensureCustomerProjectLink(user);
  }, [user]);
}
