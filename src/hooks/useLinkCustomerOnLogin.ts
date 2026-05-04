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

  // Skip staff users — they are never linked customers, so the lookup is wasted.
  // Staff is detected via the JWT user_metadata.role written by our auth flow.
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

  try {
    const { data: unlinkedProjects, error: fetchError } = await supabase
      .from("project_customers")
      .select("id, project_id, customer_name")
      .eq("customer_email", user.email)
      .is("customer_user_id", null);

    if (fetchError) {
      logError("Error fetching unlinked projects", fetchError, {
        component: "useLinkCustomerOnLogin",
        email: user.email,
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
      .eq("customer_email", user.email)
      .is("customer_user_id", null);

    if (updateError) {
      logError("Error linking customer to projects", updateError, {
        component: "useLinkCustomerOnLogin",
        userId: user.id,
        email: user.email,
      });
      return;
    }

    // Ensure project_members entries exist (needed for RLS and queries)
    for (const proj of unlinkedProjects) {
      await supabase
        .from("project_members")
        .upsert(
          { project_id: proj.project_id, user_id: user.id, role: "viewer" },
          { onConflict: "project_id,user_id" },
        );
    }

    const projectNames = unlinkedProjects
      .map((p) => p.customer_name || p.project_id)
      .join(", ");
    logInfo("Customer linked to projects on login", {
      userId: user.id,
      email: user.email,
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

export function useLinkCustomerOnLogin(user: User | null) {
  useEffect(() => {
    if (!user?.email || !user?.id) return;

    // Already linked in this tab session — skip entirely.
    if (getSessionFlag(user.id)) return;

    // A link operation for this user is already in flight in another component.
    if (inFlight.has(user.id)) return;

    const promise = linkCustomerToProjects(user).finally(() => {
      inFlight.delete(user.id);
    });
    inFlight.set(user.id, promise);
  }, [user?.id, user?.email]);
}
