import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import {
  CLIENT_NAV,
  STAFF_NAV,
  PROFILE_SLOT,
  type MobileNavSlot,
} from "@/config/mobileNav";
import { MobileProfileSheet } from "./MobileProfileSheet";
import { rememberMobileNavSlot, clearMobileNavSlot } from "@/lib/mobileBottomNavMemory";
import { patchPortalViewState } from "@/lib/portalViewState";

const ROUTE_TAB_SLOTS = new Set([
  "financeiro",
  "documentos",
  "formalizacoes",
  "pendencias",
]);

/**
 * Universal mobile bottom navigation — 4 tabs + Profile.
 *
 * Renders the same shape for cliente and staff; the contents are driven by
 * `src/config/mobileNav.ts`. The fifth slot is always the profile sheet
 * (never a "more tools" catalog).
 */
export function MobileBottomNav() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { unreadCount } = useNotifications();
  const { isStaff } = useUserRole();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  // Persist the slot whenever the URL matches one — covers direct navigation,
  // back/forward and deep links, not just taps on the nav itself.
  useEffect(() => {
    if (!projectId) return;
    const segment = location.pathname.split("/")[3];
    if (!segment) return;
    rememberMobileNavSlot(projectId, segment);
    // Mirror direct route navigation (incl. back/forward, deep links) into
    // the portal view state so activeTab stays in sync with the URL when
    // the user returns to the Index page.
    if (ROUTE_TAB_SLOTS.has(segment)) {
      patchPortalViewState(`portal_${projectId}`, { activeTab: segment });
    }
  }, [location.pathname, projectId]);

  const criticalPendencias = stats.overdueCount + stats.urgentCount;
  const hasProject = !!projectId;

  const navItems = useMemo<MobileNavSlot[]>(
    () => (isStaff ? STAFF_NAV : CLIENT_NAV),
    [isStaff],
  );

  const resolveBadge = (slot: MobileNavSlot): number => {
    if (slot.badge === "criticalPendencias") return criticalPendencias;
    if (slot.badge === "unreadNotifications") return unreadCount;
    return 0;
  };

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 inset-x-0 z-shell md:hidden",
          "border-t border-border-subtle bg-card/95 backdrop-blur-xl backdrop-saturate-150",
          "pb-safe pl-safe pr-safe",
          "hide-on-keyboard",
        )}
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch justify-between h-16 px-1">
          {navItems.map((slot) => {
            const to = slot.to({ paths, hasProject, projectId });
            const badge = resolveBadge(slot);
            const Icon = slot.icon;
            return (
              <NavLink
                key={slot.id}
                to={to}
                end={slot.id === "inicio"}
                onClick={() => {
                  rememberMobileNavSlot(projectId, slot.id);
                  // Tapping "Obra" (the project hub) must take the user back
                  // to the project root. The remembered slot is still the
                  // previous route-only tab (financeiro, documentos…) because
                  // "obra" itself is not a restorable slot, so the Index
                  // restore effect would bounce the user right back. Clear
                  // the memory and reset the Index tab to the overview.
                  if (slot.id === "obra" && projectId) {
                    clearMobileNavSlot(projectId);
                    patchPortalViewState(`portal_${projectId}`, {
                      activeTab: "cronograma",
                    });
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 px-1 py-1",
                    "min-h-[56px] transition-all active:scale-[0.94]",
                    "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
                    isActive ? "text-primary" : "text-foreground-muted",
                  )
                }
                aria-label={
                  badge > 0 ? `${slot.label} — ${badge} críticas` : slot.label
                }
                title={slot.label}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute -top-px left-1/2 -translate-x-1/2 h-1 w-8 rounded-b-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.45)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200",
                        isActive
                          ? "bg-primary/15 ring-1 ring-primary/25"
                          : "bg-transparent",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[22px] w-[22px] transition-all",
                          isActive
                            ? "text-primary scale-110"
                            : "text-foreground-muted",
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {badge > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                          aria-hidden="true"
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] min-[360px]:text-[11px] leading-[1.05] text-center max-w-full break-words hyphens-auto line-clamp-2",
                        isActive ? "font-semibold text-primary" : "font-medium",
                      )}
                    >
                      {slot.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Profile slot — opens sheet, never navigates */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 px-1 py-1",
              "min-h-[56px] transition-all active:scale-[0.94]",
              "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
              profileOpen ? "text-primary" : "text-foreground-muted",
            )}
            aria-label={
              unreadCount > 0
                ? `${PROFILE_SLOT.label} — ${unreadCount} avisos não lidos`
                : PROFILE_SLOT.label
            }
            title={PROFILE_SLOT.label}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
          >
            {profileOpen && (
              <span
                className="absolute -top-px left-1/2 -translate-x-1/2 h-1 w-8 rounded-b-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.45)]"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200",
                profileOpen
                  ? "bg-primary/15 ring-1 ring-primary/25"
                  : "bg-transparent",
              )}
            >
              <PROFILE_SLOT.icon
                className={cn(
                  "h-[22px] w-[22px] transition-all",
                  profileOpen
                    ? "text-primary scale-110"
                    : "text-foreground-muted",
                )}
                strokeWidth={profileOpen ? 2.5 : 2}
              />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                  aria-hidden="true"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[10px] min-[360px]:text-[11px] leading-[1.05] text-center max-w-full break-words hyphens-auto line-clamp-2",
                profileOpen ? "font-semibold text-primary" : "font-medium",
              )}
            >
              {PROFILE_SLOT.label}
            </span>
          </button>
        </div>
      </nav>

      <MobileProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
